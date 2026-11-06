import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const modelPrefix = '/__atrium-model/';
const allowedOrigins = new Set(['https://models.atrium.earth', 'https://atrium.earth']);
const contentTypes = { '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.html': 'text/html', '.css': 'text/css' };
const isInside = (root, file) => {
  const relative = path.relative(root, file);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

async function existingFile(root, pathname) {
  if (!root) return null;
  try {
    const resolvedRoot = await realpath(root);
    const file = await realpath(path.resolve(resolvedRoot, `.${pathname}`));
    if (!isInside(resolvedRoot, file)) return null;
    const info = await stat(file);
    return info.isFile() ? { file, info } : null;
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes(error.code)) return null;
    throw error;
  }
}

function validHeader(header, bytes) {
  return header.length >= 12 && header.toString('ascii', 0, 4) === 'glTF'
    && header.readUInt32LE(4) === 2 && header.readUInt32LE(8) === bytes;
}

async function validLocalModel(candidate, record, hashPrefix) {
  if (!candidate || candidate.info.size !== record.bytes) return false;
  let header = Buffer.alloc(0);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(candidate.file)) {
    if (header.length < 12) header = Buffer.concat([header, chunk.subarray(0, 12 - header.length)]);
    hash.update(chunk);
  }
  return validHeader(header, record.bytes) && (!hashPrefix || hash.digest('hex').startsWith(hashPrefix));
}

// Registered only by Vite's development server. No serving copy or model cache
// is written; every remote URL must come from this checkout's fixed preview map.
export function previewAssets() {
  return {
    name: 'atrium-read-only-preview-assets',
    apply: 'serve',
    config(config) {
      return { cacheDir: path.resolve(config.root || process.cwd(), '.astro/vite-cache') };
    },
    async configureServer(server) {
      const previews = JSON.parse(await readFile(path.join(server.config.root, 'src/data/previews.json'), 'utf8'));
      const externalPublic = process.env.ATRIUM_PREVIEW_PUBLIC_DIR;
      const roots = [...new Set([externalPublic, path.join(server.config.root, 'public')].filter(Boolean))];
      const base = server.config.base.replace(/\/$/, '');
      server.middlewares.use(async (req, res, next) => {
        const controller = new AbortController();
        try {
          let pathname = new URL(req.url || '/', 'http://localhost').pathname;
          if (base && pathname.startsWith(`${base}/`)) pathname = pathname.slice(base.length);
          const model = pathname.startsWith(modelPrefix);
          const assetPath = path.posix.normalize(decodeURIComponent(pathname));
          const staticAsset = /^\/(?:previews|spatial-museum|vendor|images)\//.test(assetPath)
            || ['/model-render-utils.js', '/favicon.svg'].includes(assetPath);
          if (!model && !staticAsset) return next();
          if (!['GET', 'HEAD'].includes(req.method || 'GET')) { res.statusCode = 405; res.end(); return; }
          res.once('close', () => controller.abort());

          if (!model) {
            for (const root of roots) {
              const candidate = await existingFile(root, assetPath);
              if (!candidate) continue;
              res.setHeader('Content-Type', contentTypes[path.extname(candidate.file)] || 'application/octet-stream');
              res.setHeader('Content-Length', candidate.info.size);
              res.setHeader('Cache-Control', 'private, max-age=300');
              if (req.method === 'HEAD') res.end();
              else await pipeline(createReadStream(candidate.file), res);
              return;
            }
            return next();
          }

          const slug = decodeURIComponent(pathname.slice(modelPrefix.length));
          const record = Object.hasOwn(previews, slug) ? previews[slug] : null;
          if (!record) { res.statusCode = 404; res.end('Unknown preview model'); return; }
          const url = new URL(record.url, 'https://atrium.earth');
          if (!allowedOrigins.has(url.origin) || url.username || url.password || url.search || url.hash
            || !url.pathname.startsWith(`/models/previews/${slug}/`) || !url.pathname.endsWith('.glb')
            || !Number.isSafeInteger(record.bytes) || record.bytes < 12) throw new Error('Invalid preview binding');
          const hashPrefix = /\/preview-([a-f0-9]{12,64})\.glb$/.exec(url.pathname)?.[1];
          // A cloud URL without a content hash cannot prove that an old local
          // mirror is the current revision. Request that version from its host.
          if (hashPrefix || record.url.startsWith('/')) {
            const modelPaths = [...new Set([url.pathname, `/models/previews/${slug}/preview.glb`])];
            for (const root of roots) for (const modelPath of modelPaths) {
              const candidate = await existingFile(root, modelPath);
              if (!await validLocalModel(candidate, record, hashPrefix)) continue;
              res.setHeader('Content-Type', 'model/gltf-binary');
              res.setHeader('Content-Length', record.bytes);
              res.setHeader('Cache-Control', 'private, max-age=300');
              if (req.method === 'HEAD') res.end();
              else await pipeline(createReadStream(candidate.file), res);
              return;
            }
          }

          // Deliberately omit Range: an ordinary full GLB response is supported
          // by the viewer and avoids forwarding partial compressed representations.
          const upstream = await fetch(url, {
            method: req.method, redirect: 'error', signal: controller.signal,
            headers: { Origin: 'https://atrium.earth', 'User-Agent': 'AtriumLocalPreview/1.0' },
          });
          if (!upstream.ok) { res.statusCode = upstream.status; res.end('Preview model unavailable'); return; }
          const length = Number(upstream.headers.get('content-length'));
          const encoded = upstream.headers.has('content-encoding');
          if (!encoded && length > record.bytes) throw new Error('Preview exceeds its recorded size');
          res.setHeader('Content-Type', 'model/gltf-binary');
          // Node fetch decodes gzip/br but retains their compressed length header.
          if (!encoded && length === record.bytes) res.setHeader('Content-Length', length);
          res.setHeader('Cache-Control', 'private, max-age=300');
          if (req.method === 'HEAD' || !upstream.body) { res.end(); return; }
          let bytes = 0;
          let header = Buffer.alloc(0);
          const hash = createHash('sha256');
          const verify = new Transform({
            transform(chunk, encoding, done) {
              bytes += chunk.length;
              if (bytes > record.bytes) { done(new Error('Preview exceeds its recorded size')); return; }
              if (header.length < 12) header = Buffer.concat([header, chunk.subarray(0, 12 - header.length)]);
              hash.update(chunk);
              done(null, chunk);
            },
            flush(done) {
              const valid = bytes === record.bytes && validHeader(header, record.bytes)
                && (!hashPrefix || hash.digest('hex').startsWith(hashPrefix));
              done(valid ? null : new Error('Preview bytes do not match the configured model'));
            },
          });
          await pipeline(Readable.fromWeb(upstream.body), verify, res);
        } catch (error) {
          if (controller.signal.aborted || res.writableEnded || res.destroyed) return;
          if (!res.headersSent) { res.statusCode = 502; res.setHeader('Content-Type', 'text/plain'); res.removeHeader('Content-Length'); }
          res.end('This preview asset is unavailable.');
        }
      });
    },
  };
}
