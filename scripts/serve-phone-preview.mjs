import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { previewAssets } from './lib/preview-assets.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const { values } = parseArgs({ options: { port: { type: 'string', default: '5196' }, dist: { type: 'string', default: path.join(repo, 'dist') } } });
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Choose a port from 1 to 65535.');
const dist = await realpath(values.dist);
if (!(await stat(path.join(dist, 'index.html'))).isFile()) throw new Error('Build the site before starting the phone preview.');

const manifest = JSON.parse(await readFile(path.join(repo, 'src/data/previews.json'), 'utf8'));
const origins = new Set(['https://atrium.earth', 'https://models.atrium.earth']);
const byModelPath = new Map();
const absoluteModels = new Map();
for (const [slug, record] of Object.entries(manifest)) {
  const url = new URL(record.url, 'https://atrium.earth');
  if (!origins.has(url.origin) || url.username || url.password || url.search || url.hash
    || !url.pathname.startsWith(`/models/previews/${slug}/`)
    || !/^preview(?:-[a-f0-9]+)?\.glb$/.test(url.pathname.split('/').at(-1))) {
    throw new Error(`Unexpected model binding for ${slug}`);
  }
  if (byModelPath.has(url.pathname)) throw new Error(`Duplicate model path for ${slug}`);
  const relayPath = `/__atrium-model/${encodeURIComponent(slug)}`;
  byModelPath.set(url.pathname, relayPath);
  absoluteModels.set(url.href, url.pathname);
}

// Use the development relay's origin restrictions, streaming, content length,
// GLB header and hash checks. The build's text is adapted only in this server.
process.env.ATRIUM_PREVIEW_PUBLIC_DIR ??= dist;
let previewMiddleware;
await previewAssets().configureServer({
  config: { root: repo, base: '/' },
  middlewares: { use(handler) { previewMiddleware = handler; } },
});

const types = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
};
const rewrittenTypes = new Set(['.html', '.js', '.mjs', '.json']);
const absoluteModel = /https:\/\/(?:models\.)?atrium\.earth\/models\/previews\/[a-z0-9_/%.-]+\.glb\b/gi;

async function fileInBuild(pathname) {
  try {
    const candidate = await realpath(path.join(dist, `.${pathname}`));
    const relative = path.relative(dist, candidate);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
    const info = await stat(candidate);
    return info.isFile() ? { candidate, info } : null;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

function plain(res, code, message) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

async function sendFile(req, res, file, status = 200) {
  const extension = path.extname(file.candidate);
  const mime = types[extension] || 'application/octet-stream';
  if (rewrittenTypes.has(extension)) {
    const source = await readFile(file.candidate, 'utf8');
    const body = source.replace(absoluteModel, url => absoluteModels.get(url) ?? url);
    res.writeHead(status, { 'Content-Type': `${mime}; charset=utf-8`, 'Content-Length': Buffer.byteLength(body) });
    res.end(req.method === 'HEAD' ? undefined : body);
    return;
  }
  res.writeHead(status, { 'Content-Type': mime, 'Content-Length': file.info.size });
  if (req.method === 'HEAD') res.end();
  else await pipeline(createReadStream(file.candidate), res);
}

const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    plain(res, 405, 'Method not allowed');
    return;
  }
  let pathname;
  try {
    if (!req.url?.startsWith('/') || req.url.startsWith('//')) throw new Error('Expected a local path');
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (/[\\\u0000-\u001f]/.test(pathname)) throw new Error('Invalid path');
  } catch {
    plain(res, 400, 'Invalid path');
    return;
  }
  try {
    const relayPath = byModelPath.get(pathname);
    if (relayPath) {
      await previewMiddleware({ url: relayPath, method: req.method }, res, () => plain(res, 404, 'Unknown preview model'));
      return;
    }
    if (/^\/(?:models\/previews|__atrium-model)(?:\/|$)/.test(pathname) || /\.glb$/i.test(pathname)) {
      plain(res, 404, 'Unknown preview model');
      return;
    }

    const file = await fileInBuild(pathname) || await fileInBuild(`${pathname.replace(/\/$/, '')}/index.html`);
    if (file) {
      await sendFile(req, res, file);
      return;
    }
    await previewMiddleware(req, res, async () => {
      const missing = await fileInBuild('/404.html');
      if (missing) await sendFile(req, res, missing, 404);
      else plain(res, 404, 'Page not found');
    });
  } catch {
    if (res.destroyed || res.writableEnded) return;
    if (res.headersSent) res.destroy();
    else plain(res, 500, 'Preview file unavailable');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Phone preview is serving ${dist}`);
  const interfaces = Object.entries(networkInterfaces());
  const preferred = interfaces.filter(([name]) => /^(?:en|eth|wlan|wifi)/i.test(name));
  const addresses = (preferred.length ? preferred : interfaces).flatMap(([, entries]) => entries)
    .filter(entry => entry.family === 'IPv4' && !entry.internal);
  for (const address of new Set(addresses.map(entry => entry.address))) console.log(`Phone on the same Wi-Fi: http://${address}:${port}/`);
  console.log(`On this computer: http://localhost:${port}/`);
});
