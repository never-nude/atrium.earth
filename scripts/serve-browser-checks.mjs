import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { once } from 'node:events';
import { Readable } from 'node:stream';

const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.ico': 'image/x-icon',
};

export async function serveBrowserChecks(directory = 'dist', { measureModels = false } = {}) {
  const root = resolve(directory);
  const modelHost = 'https://models.atrium.earth';
  const modelPrefix = '/__performance-model';
  const models = new Set();
  let performanceHomepage;
  if (measureModels) {
    const homepage = await readFile(resolve(root, 'index.html'), 'utf8');
    const previews = JSON.parse(await readFile(new URL('../src/data/previews.json', import.meta.url), 'utf8'));
    for (const { url } of Object.values(previews)) {
      if (url?.startsWith(`${modelHost}/models/previews/`) && homepage.includes(`data-glb="${url}"`)) {
        models.add(new URL(url).pathname);
      }
    }
    performanceHomepage = Buffer.from(homepage.replaceAll(`data-glb="${modelHost}/models/previews/`, `data-glb="${modelPrefix}/models/previews/`));
  }
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (measureModels && (pathname === '/' || pathname === '/index.html')) {
        response.writeHead(200, { 'Content-Type': contentTypes['.html'], 'Content-Length': performanceHomepage.length });
        return response.end(request.method === 'HEAD' ? undefined : performanceHomepage);
      }
      if (measureModels && pathname.startsWith(modelPrefix + '/')) {
        const modelPath = pathname.slice(modelPrefix.length);
        if (request.method !== 'GET' || !models.has(modelPath)) return response.writeHead(404).end();
        const upstream = await fetch(new URL(modelPath, modelHost), {
          headers: { Origin: 'https://atrium.earth', 'Accept-Encoding': 'identity' },
          redirect: 'error',
          signal: AbortSignal.timeout(20000),
        });
        if (!upstream.ok || !upstream.body) return response.writeHead(502).end();
        const headers = { 'Content-Type': contentTypes['.glb'] };
        const length = upstream.headers.get('content-length');
        if (length && !upstream.headers.has('content-encoding')) headers['Content-Length'] = length;
        response.writeHead(200, headers);
        const body = Readable.fromWeb(upstream.body);
        response.once('close', () => body.destroy());
        return body.on('error', error => response.destroy(error)).pipe(response);
      }
      let file = resolve(root, '.' + pathname);
      if (file !== root && !file.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
      }
      if (pathname.endsWith('/') || !extname(file)) file = resolve(file, 'index.html');
      let status = 200;
      let info = await stat(file).catch(() => null);
      if (!info?.isFile()) {
        status = 404;
        file = resolve(root, '404.html');
        info = await stat(file);
      }
      response.writeHead(status, {
        'Content-Type': contentTypes[extname(file)] || 'application/octet-stream',
        'Content-Length': info.size,
      });
      if (request.method === 'HEAD') response.end();
      else createReadStream(file).on('error', error => response.destroy(error)).pipe(response);
    } catch {
      if (!response.headersSent) response.writeHead(500).end();
      else response.destroy();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(done => {
      server.close(done);
      server.closeAllConnections();
    }),
  };
}
