#!/usr/bin/env node
// Publish only a reviewed six-room USDZ package. Never edits catalog/model maps.
// Input: {schema:'atrium-room-ar-upload/1', rooms:[{roomId,localPath,bytes,sha256}]}.
// localPath resolves beside the input manifest; it never appears in receipts.
// Validate only: --manifest=<file> --dry-run [--report=<file>]
// Publish:       --manifest=<file> --allow-upload --report=<file>
// R2 env names match upload-previews-r2.mjs. No verification bypass is offered.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Hex, signRequest } from './r2-sigv4.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MIME = 'model/vnd.usdz+zip';
const ORIGIN = 'https://atrium.earth';
const MAX_ROOM_BYTES = 512 * 1024 * 1024;
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024 * 1024;
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

// USDZ is an uncompressed ZIP with every member's data aligned to 64 bytes.
// Both headers and CRCs are checked, so a renamed ZIP or truncated package fails
// before any upload. ZIP64/data descriptors are deliberately outside this bound.
export function validateUsdz(body) {
  check(Buffer.isBuffer(body) && body.length >= 86, 'USDZ package is too short');
  let end = -1;
  for (let offset = body.length - 22; offset >= Math.max(0, body.length - 22 - 65535); offset -= 1) {
    if (body.readUInt32LE(offset) === 0x06054b50 && offset + 22 + body.readUInt16LE(offset + 20) === body.length) {
      end = offset;
      break;
    }
  }
  check(end >= 0, 'USDZ ZIP end record is missing');
  const count = body.readUInt16LE(end + 10);
  const centralBytes = body.readUInt32LE(end + 12);
  const centralOffset = body.readUInt32LE(end + 16);
  check(body.readUInt16LE(end + 4) === 0 && body.readUInt16LE(end + 6) === 0
    && body.readUInt16LE(end + 8) === count && count > 0 && count < 65535
    && centralOffset !== 0xffffffff && centralBytes !== 0xffffffff
    && centralOffset + centralBytes === end, 'USDZ ZIP directory is invalid or unsupported');
  let cursor = centralOffset;
  const names = new Set();
  const members = [];
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (let index = 0; index < count; index += 1) {
    check(cursor + 46 <= end && body.readUInt32LE(cursor) === 0x02014b50, 'USDZ ZIP directory member is invalid');
    const flags = body.readUInt16LE(cursor + 8);
    const method = body.readUInt16LE(cursor + 10);
    const crc = body.readUInt32LE(cursor + 16);
    const compressed = body.readUInt32LE(cursor + 20);
    const bytes = body.readUInt32LE(cursor + 24);
    const nameBytes = body.readUInt16LE(cursor + 28);
    const extraBytes = body.readUInt16LE(cursor + 30);
    const commentBytes = body.readUInt16LE(cursor + 32);
    const localOffset = body.readUInt32LE(cursor + 42);
    check(cursor + 46 + nameBytes + extraBytes + commentBytes <= end, 'USDZ ZIP directory exceeds its bounds');
    check((flags & ~0x0800) === 0 && method === 0 && compressed === bytes && bytes !== 0xffffffff
      && localOffset !== 0xffffffff && body.readUInt16LE(cursor + 34) === 0, 'USDZ members must be stored without encryption, descriptors or ZIP64');
    check(((body.readUInt32LE(cursor + 38) >>> 16) & 0xf000) !== 0xa000, 'USDZ symbolic links are not allowed');
    const rawName = body.subarray(cursor + 46, cursor + 46 + nameBytes);
    let name;
    try { name = decoder.decode(rawName); } catch { throw new Error('USDZ member name is not UTF-8'); }
    check(name.length > 0 && !name.startsWith('/') && !name.includes('\\') && !name.includes('\0')
      && !name.includes(':') && name.split('/').every((part) => part && part !== '.' && part !== '..')
      && !names.has(name), 'USDZ member path is unsafe or repeated');
    names.add(name);
    check(localOffset + 30 <= centralOffset && body.readUInt32LE(localOffset) === 0x04034b50, 'USDZ local ZIP header is invalid');
    const localNameBytes = body.readUInt16LE(localOffset + 26);
    const localExtraBytes = body.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameBytes + localExtraBytes;
    check(body.readUInt16LE(localOffset + 6) === flags && body.readUInt16LE(localOffset + 8) === method
      && body.readUInt32LE(localOffset + 14) === crc && body.readUInt32LE(localOffset + 18) === compressed
      && body.readUInt32LE(localOffset + 22) === bytes && localNameBytes === nameBytes
      && body.subarray(localOffset + 30, localOffset + 30 + localNameBytes).equals(rawName), 'USDZ local/directory headers disagree');
    check(dataOffset % 64 === 0 && dataOffset + bytes <= centralOffset, 'USDZ member data must be bounded and 64-byte aligned');
    const content = body.subarray(dataOffset, dataOffset + bytes);
    check(crc32(content) === crc, 'USDZ member CRC mismatch');
    members.push({ name, localOffset, dataOffset, bytes });
    cursor += 46 + nameBytes + extraBytes + commentBytes;
  }
  check(cursor === end, 'USDZ directory has unexpected records');
  members.sort((a, b) => a.localOffset - b.localOffset);
  check(members[0].localOffset === 0, 'USDZ must begin with the first USD member');
  for (let index = 1; index < members.length; index += 1) {
    check(members[index - 1].dataOffset + members[index - 1].bytes === members[index].localOffset, 'USDZ has overlapping members or unexpected ZIP data');
  }
  check(members.at(-1).dataOffset + members.at(-1).bytes === centralOffset, 'USDZ has unexpected data before its directory');
  const first = members[0];
  const magic = body.subarray(first.dataOffset, first.dataOffset + Math.min(first.bytes, 9)).toString('ascii');
  check((/\.(?:usd|usdc)$/i.test(first.name) && magic.startsWith('PXR-USDC'))
    || (/\.(?:usd|usda)$/i.test(first.name) && magic.startsWith('#usda 1.0')), 'USDZ first member must be a USD crate or USDA scene');
  return { members: members.length, firstMember: first.name };
}

function parseArguments(argv) {
  const args = {};
  for (const item of argv) {
    const match = /^--(manifest|report)=(.+)$/.exec(item);
    const name = match?.[1] || (item === '--dry-run' ? 'dry-run' : item === '--allow-upload' ? 'allow-upload' : '');
    check(name && !(name in args), 'Unknown, empty or repeated argument');
    args[name] = match ? match[2] : true;
  }
  check(args.manifest, '--manifest=<file> is required');
  check(Boolean(args['dry-run']) !== Boolean(args['allow-upload']), 'Choose exactly one of --dry-run or --allow-upload');
  check(args['dry-run'] || args.report, 'Uploads require --report=<file>');
  return args;
}

async function readJson(file, label) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { throw new Error(`${label} cannot be read as JSON`); }
}

async function readPinned(entry) {
  let body;
  try {
    const info = await stat(entry.localPath);
    check(info.isFile() && info.size === entry.bytes, 'source byte count mismatch');
    body = await readFile(entry.localPath);
  } catch { throw new Error(`${entry.roomId}: source is missing or has incorrect bytes`); }
  check(body.length === entry.bytes && sha256Hex(body) === entry.sha256, `${entry.roomId}: source SHA-256/bytes mismatch`);
  return { body, ...validateUsdz(body) };
}

async function retry(attempts, fn) {
  let failure;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try { return await fn(); } catch (error) {
      failure = error;
      if (error.retryable === false) break;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, Math.min(500 * 2 ** (attempt - 1), 2000)));
    }
  }
  throw failure;
}

async function fullPublicReadback(url, expected) {
  let response;
  try {
    response = await fetch(url, { headers: { origin: ORIGIN, 'cache-control': 'no-cache' }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(120000) });
  } catch { throw new Error('Public GET failed'); }
  const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const cors = response.headers.get('access-control-allow-origin') || '';
  const length = response.headers.get('content-length');
  try {
    check(response.ok, `Public GET returned HTTP ${response.status}`);
    check(mime === MIME, 'Public USDZ MIME is incorrect');
    check(cors === '*' || cors === ORIGIN, 'Public production-origin CORS is missing or incorrect');
    if (length !== null) check(Number(length) === expected.bytes, 'Public Content-Length mismatch');
  } catch (error) {
    await response.body?.cancel().catch(() => {});
    throw error;
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > expected.bytes) {
      await response.body.cancel().catch(() => {});
      throw new Error('Public response exceeds pinned byte count');
    }
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks, bytes);
  check(bytes === expected.bytes && sha256Hex(body) === expected.sha256, 'Public complete SHA-256/bytes mismatch');
  return { status: response.status, bytes, sha256: expected.sha256, contentType: mime, corsOrigin: ORIGIN, accessControlAllowOrigin: cors, verifiedAt: new Date().toISOString() };
}

function requiredEnv(name) {
  check(process.env[name], `${name} is required`);
  return process.env[name];
}

function safeBase(value, label, allowLoopback = false) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} URL is invalid`); }
  check(!url.username && !url.password && !url.search && !url.hash
    && (url.protocol === 'https:' || (allowLoopback && url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))), `${label} URL must use HTTPS without credentials, query or fragment`);
  return url.toString().replace(/\/+$/, '');
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArguments(argv);
  const manifestPath = path.resolve(args.manifest);
  const collectionPath = path.join(ROOT, 'public/spatial-museum/collection-manifest.json');
  const collection = await readJson(collectionPath, 'Public collection manifest');
  const ids = collection.rooms?.map((room) => room.id);
  check(collection.schema === 'atrium-public-spatial-museum/1' && Array.isArray(ids) && ids.length === 6
    && new Set(ids).size === 6 && ids.every((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)), 'Public collection must identify exactly six reviewed rooms');
  const input = await readJson(manifestPath, 'Upload manifest');
  check(input.schema === 'atrium-room-ar-upload/1' && Array.isArray(input.rooms) && input.rooms.length === ids.length, 'Upload manifest must contain exactly six rooms');
  const seen = new Set();
  let totalBytes = 0;
  const entries = input.rooms.map((room) => {
    check(room && ids.includes(room.roomId) && !seen.has(room.roomId) && typeof room.localPath === 'string' && room.localPath.length > 0
      && Number.isSafeInteger(room.bytes) && room.bytes > 0 && room.bytes <= MAX_ROOM_BYTES
      && typeof room.sha256 === 'string' && /^[a-f0-9]{64}$/.test(room.sha256), 'Upload manifest room binding is invalid or repeated');
    seen.add(room.roomId);
    totalBytes += room.bytes;
    return { roomId: room.roomId, localPath: path.resolve(path.dirname(manifestPath), room.localPath), bytes: room.bytes, sha256: room.sha256 };
  });
  check(totalBytes <= MAX_PACKAGE_BYTES, 'Reviewed room package exceeds the bounded upload limit');
  const reportPath = args.report ? path.resolve(args.report) : null;
  check(!reportPath || ![manifestPath, collectionPath, ...entries.map((entry) => entry.localPath)].includes(reportPath), 'Receipt cannot overwrite an input file');
  const publicBase = safeBase(process.env.R2_PUBLIC_BASE || 'https://models.atrium.earth', 'Public base', true);
  const report = { schema: 'atrium-room-ar-receipt/1', generatedAt: new Date().toISOString(), mode: args['dry-run'] ? 'dry-run' : 'upload', complete: false, publicBase, productionOrigin: ORIGIN, rooms: [] };
  // Complete all six input checks before writing even the first object.
  for (const entry of entries) {
    const { members, firstMember } = await readPinned(entry);
    const key = `models/rooms/${entry.roomId}/room-${entry.sha256.slice(0, 12)}.usdz`;
    report.rooms.push({ roomId: entry.roomId, key, url: `${publicBase}/${key}`, bytes: entry.bytes, sha256: entry.sha256, contentType: MIME, members, firstMember, status: 'validated' });
  }
  const persist = async () => {
    if (reportPath) {
      try {
        await mkdir(path.dirname(reportPath), { recursive: true });
        await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
      } catch { throw new Error('Public-safe receipt could not be saved'); }
    }
  };
  if (!args['dry-run']) {
    const credentials = { accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'), secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY') };
    const bucket = requiredEnv('R2_BUCKET');
    check(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket), 'R2_BUCKET is invalid');
    const endpoint = safeBase(process.env.R2_ENDPOINT || `https://${requiredEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`, 'R2 endpoint', true);
    await persist();
    for (const [index, entry] of entries.entries()) {
      const item = report.rooms[index];
      try {
        const { body } = await readPinned(entry);
        const url = `${endpoint}/${bucket}/${item.key}`;
        const result = await retry(3, async () => {
          const { headers } = signRequest({ method: 'PUT', url, headers: { 'content-type': MIME, 'cache-control': 'public, max-age=31536000, immutable', 'if-none-match': '*' }, payloadHash: entry.sha256, ...credentials });
          let response;
          try { response = await fetch(url, { method: 'PUT', headers, body, redirect: 'error', signal: AbortSignal.timeout(120000) }); } catch { throw new Error('R2 PUT failed'); }
          await response.body?.cancel();
          if (response.status === 412) return 'existing';
          if (!response.ok) {
            const error = new Error(`R2 PUT returned HTTP ${response.status}`);
            error.retryable = response.status === 429 || response.status >= 500;
            throw error;
          }
          return 'uploaded';
        });
        item.verification = await retry(4, () => fullPublicReadback(item.url, entry));
        item.status = result === 'existing' ? 'existing-verified' : 'uploaded-verified';
        await persist();
      } catch (error) {
        item.status = 'failed';
        item.reason = error.message;
        await persist();
        throw new Error(`${entry.roomId}: ${error.message}`);
      }
    }
  }
  report.complete = report.rooms.every((room) => args['dry-run'] ? room.status === 'validated' : room.status.endsWith('-verified'));
  await persist();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`Room AR upload failed: ${error.message}`); process.exitCode = 1; });
}
