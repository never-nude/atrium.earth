import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { once } from 'node:events';

const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.ico': 'image/x-icon',
};

export async function serveBrowserChecks(directory = 'dist') {
  const root = resolve(directory);
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
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
