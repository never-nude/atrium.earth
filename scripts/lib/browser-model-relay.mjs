import { requestWithFreshConnection } from './fresh-https-request.mjs';

const cdn = 'https://models.atrium.earth';
const site = 'https://atrium.earth';
const mime = 'model/gltf-binary';

async function errorExcerpt(response) {
  if (!/^(?:text\/|application\/(?:json|problem\+json))/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel().catch(() => {});
    return '';
  }
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let bytes = 0;
  try {
    while (bytes < 512) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, 512 - bytes);
      chunks.push(chunk);
      bytes += chunk.length;
    }
    return Buffer.concat(chunks).toString('utf8').replace(/\s+/g, ' ').trim();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// Test-only CORS relay: request the production address once with production
// headers, never inherited loopback/browser headers, redirects or retries.
export async function readBrowserModel(url, { timeout = 20000, request = requestWithFreshConnection } = {}) {
  const target = new URL(url);
  const pathname = decodeURIComponent(target.pathname);
  if (target.origin !== cdn || target.username || target.password || target.search || target.hash
    || target.href !== target.origin + target.pathname
    || !/^\/models\/(?:previews|first-views)\/[a-z0-9_./-]+\.glb$/i.test(pathname)
    || pathname.split('/').some(part => part === '.' || part === '..')) {
    throw new Error(`Unexpected browser model address: ${url}`);
  }
  if (!Number.isSafeInteger(timeout) || timeout <= 0) throw new Error('Invalid browser model timeout');
  const response = await request(target.href, {
    headers: { Origin: site, 'Accept-Encoding': 'identity' },
    signal: AbortSignal.timeout(timeout),
    redirect: 'error',
  });
  if (response.status !== 200) {
    const excerpt = await errorExcerpt(response);
    throw new Error(`CDN model ${target.href}: HTTP ${response.status}; Content-Type ${response.headers.get('content-type') || 'missing'}${excerpt ? `; ${excerpt}` : ''}`);
  }
  const type = response.headers.get('content-type');
  const cors = response.headers.get('access-control-allow-origin');
  const vary = response.headers.get('vary');
  const encoding = response.headers.get('content-encoding');
  const length = response.headers.get('content-length');
  let issue;
  if (cors !== site) issue = `Expected production CORS, received ${cors || 'no header'}`;
  else if (!vary?.split(',').some(value => value.trim().toLowerCase() === 'origin')) issue = 'Expected Vary: Origin';
  else if (type?.split(';')[0].trim().toLowerCase() !== mime) issue = `Expected Content-Type ${mime}, received ${type || 'no header'}`;
  else if (encoding && encoding.toLowerCase() !== 'identity') issue = `Unexpected content encoding ${encoding}`;
  else if (!/^\d+$/.test(length || '') || !Number.isSafeInteger(Number(length)) || Number(length) < 12) issue = 'Invalid model Content-Length';
  else if (!response.body) issue = 'Missing model response body';
  if (issue) {
    await response.body?.cancel().catch(() => {});
    throw new Error(`CDN model ${target.href}: ${issue}`);
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length !== Number(length)) throw new Error(`CDN model ${target.href}: Expected ${length} body bytes, received ${body.length}`);
  if (body.toString('ascii', 0, 4) !== 'glTF' || body.readUInt32LE(4) !== 2 || body.readUInt32LE(8) !== body.length) {
    throw new Error(`CDN model ${target.href}: Invalid GLB header or declared size`);
  }
  return {
    status: 200,
    headers: { 'content-type': mime, 'content-length': String(body.length), 'access-control-allow-origin': cors, vary },
    body,
  };
}
