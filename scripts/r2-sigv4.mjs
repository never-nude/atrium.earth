// Minimal AWS Signature Version 4 signing for Cloudflare R2's S3-compatible API.
// Dependency-free so uploads run the same on GitHub runners and local machines.
import { createHash, createHmac } from 'node:crypto';

export function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest();
}

// RFC 3986 encoding per path segment, as S3 canonical requests require.
export function encodeKeyPath(pathname) {
  return pathname.split('/').map((segment) => encodeURIComponent(segment)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)).join('/');
}

export function amzDateFor(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

// Returns { headers, signature }. `headers` are what to send, including
// Authorization; host is signed from `url` so it matches what fetch sends.
export function signRequest({
  method,
  url,
  headers = {},
  payloadHash,
  accessKeyId,
  secretAccessKey,
  region = 'auto',
  service = 's3',
  date = new Date(),
}) {
  const target = new URL(url);
  const amzDate = amzDateFor(date);
  const day = amzDate.slice(0, 8);
  const all = {
    ...Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value).trim().replace(/\s+/g, ' ')])),
    host: target.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const names = Object.keys(all).sort();
  const canonicalQuery = [...target.searchParams.entries()]
    .map(([name, value]) => [encodeURIComponent(name), encodeURIComponent(value)])
    .sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0))
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
  const canonicalRequest = [
    method,
    encodeKeyPath(decodeURIComponent(target.pathname)),
    canonicalQuery,
    names.map((name) => `${name}:${all[name]}\n`).join(''),
    names.join(';'),
    payloadHash,
  ].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, day), region), service), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const { host, ...send } = all;
  return {
    signature,
    headers: {
      ...send,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
    },
  };
}
