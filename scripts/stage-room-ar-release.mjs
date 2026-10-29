#!/usr/bin/env node
// Download a pinned reviewed release asset from this repository, verify the entire
// reviewed tar, then stage only its selected room derivatives. Never logs its URL/token.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Hex } from './r2-sigv4.mjs';
import { validateUsdz, validateRoomManifest, validRoomId, MAX_ROOM_COUNT, MAX_ROOM_BYTES, MAX_PACKAGE_BYTES } from './upload-room-ar-r2.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const REPOSITORY = 'never-nude/atrium.earth';
const MAX_ARCHIVE_BYTES = MAX_PACKAGE_BYTES + 65536 + (MAX_ROOM_COUNT + 1) * 1024 + 10240;
const ZERO = Buffer.alloc(512);

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function octal(field, label) {
  const text = field.toString('ascii').replace(/\0.*$/, '').trim();
  check(/^[0-7]+$/.test(text), `USTAR ${label} must be an octal field`);
  const value = Number.parseInt(text, 8);
  check(Number.isSafeInteger(value) && value >= 0, `USTAR ${label} is out of bounds`);
  return value;
}

function text(field) {
  const end = field.indexOf(0);
  const raw = end < 0 ? field : field.subarray(0, end);
  check([...raw].every((byte) => byte >= 0x20 && byte <= 0x7e), 'USTAR text must use printable ASCII');
  return raw.toString('ascii');
}

// All checks run before any extraction. No general-purpose tar extraction runs.
export function validateRoomArchive(archive, expected, expectedRoomIds) {
  check(Buffer.isBuffer(archive) && Number.isSafeInteger(expected?.bytes) && expected.bytes > 0
    && expected.bytes <= MAX_ARCHIVE_BYTES && /^[a-f0-9]{64}$/.test(expected.sha256 || '')
    && archive.length === expected.bytes && sha256Hex(archive) === expected.sha256, 'Reviewed archive complete SHA-256/bytes mismatch');
  check(archive.length % 512 === 0, 'USTAR archive must have complete blocks');
  const files = new Map();
  let offset = 0;
  let ended = false;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.equals(ZERO)) {
      check(offset + 1024 <= archive.length && archive.subarray(offset + 512, offset + 1024).equals(ZERO)
        && archive.subarray(offset).every((byte) => byte === 0), 'USTAR end markers or padding are invalid');
      ended = true;
      break;
    }
    check(files.size < MAX_ROOM_COUNT + 1, 'USTAR contains extra members');
    let checksum = 0;
    for (let index = 0; index < 512; index += 1) checksum += index >= 148 && index < 156 ? 0x20 : header[index];
    check(octal(header.subarray(148, 156), 'checksum') === checksum, 'USTAR header checksum mismatch');
    check(header.subarray(257, 263).equals(Buffer.from('ustar\0')) && header.toString('ascii', 263, 265) === '00', 'Only standard USTAR headers are accepted');
    const name = text(header.subarray(0, 100));
    check((name === 'manifest.json' || name.endsWith('.usdz') && validRoomId(name.slice(0, -5)))
      && !files.has(name) && !text(header.subarray(345, 500))
      && !text(header.subarray(157, 257)) && (header[156] === 0 || header[156] === 0x30), 'USTAR member must be an expected, unique, flat regular file');
    const bytes = octal(header.subarray(124, 136), 'member size');
    check(bytes > 0 && bytes <= (name === 'manifest.json' ? 65536 : MAX_ROOM_BYTES), 'USTAR member exceeds its reviewed size bound');
    const start = offset + 512;
    const end = start + bytes;
    const next = start + Math.ceil(bytes / 512) * 512;
    check(next <= archive.length && archive.subarray(end, next).every((byte) => byte === 0), 'USTAR member is truncated or has invalid padding');
    files.set(name, archive.subarray(start, end));
    offset = next;
  }
  check(ended && files.has('manifest.json'), 'USTAR must contain exactly one reviewed manifest and its selected room files');
  let input;
  try { input = JSON.parse(files.get('manifest.json').toString('utf8')); } catch { throw new Error('Reviewed room manifest is invalid JSON'); }
  const reviewed = validateRoomManifest(input, expectedRoomIds);
  const allowed = new Set(['manifest.json', ...reviewed.rooms.map(room => room.localPath)]);
  check(files.size === allowed.size && [...allowed].every(name => files.has(name)), 'USTAR must contain exactly the manifest and its selected room files; extra or missing members are forbidden');
  const rooms = reviewed.rooms.map((room) => {
    const body = files.get(room.localPath);
    check(body.length === room.bytes && sha256Hex(body) === room.sha256, `${room.roomId}: complete derivative SHA-256/bytes mismatch`);
    validateUsdz(body);
    return { roomId: room.roomId, localPath: `${room.roomId}.usdz`, bytes: room.bytes, sha256: room.sha256 };
  });
  return { manifest: { schema: 'atrium-room-ar-upload/1', rooms }, files };
}

async function downloadAsset({ assetId, bytes, sha256, token }) {
  check(/^[1-9][0-9]*$/.test(assetId || ''), 'ASSET_ID must be a positive decimal GitHub asset ID');
  check(/^[1-9][0-9]*$/.test(bytes || '') && Number.isSafeInteger(Number(bytes)) && Number(bytes) <= MAX_ARCHIVE_BYTES, 'ASSET_BYTES is invalid or exceeds the archive bound');
  check(/^[a-f0-9]{64}$/.test(sha256 || ''), 'ASSET_SHA256 must be a complete lowercase hash');
  check(token, 'GH_TOKEN is required');
  let url = `https://api.github.com/repos/${REPOSITORY}/releases/assets/${assetId}`;
  let response;
  for (let hop = 0; hop <= 3; hop += 1) {
    const headers = { accept: 'application/octet-stream', 'x-github-api-version': '2022-11-28', 'user-agent': 'atrium-reviewed-room-ar' };
    // The token only goes to the exact initial GitHub API endpoint, never an
    // object-storage redirect or URL supplied by the input manifest.
    if (hop === 0) headers.authorization = `Bearer ${token}`;
    try { response = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(180000) }); }
    catch { throw new Error('Authenticated release-asset download failed'); }
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const next = response.headers.get('location');
    await response.body?.cancel();
    let target;
    try { target = new URL(next); } catch { throw new Error('GitHub asset redirect is invalid'); }
    check(target.protocol === 'https:' && !target.username && !target.password
      && (target.hostname === 'release-assets.githubusercontent.com' || target.hostname === 'objects.githubusercontent.com'), 'GitHub asset redirected outside the allowed release-storage hosts');
    url = target.href;
    check(hop < 3, 'GitHub asset redirected too many times');
  }
  if (!response.ok || (response.headers.get('content-type') || '').includes('application/json')) {
    await response.body?.cancel();
    throw new Error(`GitHub release asset is unavailable (HTTP ${response.status})`);
  }
  const length = response.headers.get('content-length');
  if (length !== null && Number(length) !== Number(bytes)) {
    await response.body?.cancel();
    throw new Error('GitHub asset Content-Length differs from the reviewed size');
  }
  const chunks = [];
  let received = 0;
  for await (const chunk of response.body) {
    received += chunk.byteLength;
    check(received <= Number(bytes), 'GitHub asset exceeds the reviewed byte count');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, received);
}

export async function main() {
  check(process.env.GITHUB_REPOSITORY === REPOSITORY, 'Room upload must run in the reviewed repository');
  const expected = { bytes: Number(process.env.ASSET_BYTES), sha256: process.env.ASSET_SHA256 };
  const archive = await downloadAsset({ assetId: process.env.ASSET_ID, bytes: process.env.ASSET_BYTES, sha256: expected.sha256, token: process.env.GH_TOKEN });
  const staged = validateRoomArchive(archive, expected);
  const destination = path.join(ROOT, '.atrium-ingest/room-ar-upload');
  try {
    await mkdir(path.dirname(destination), { recursive: true });
    // Fail on an existing staging directory rather than overwrite prior work.
    await mkdir(destination);
    for (const room of staged.manifest.rooms) await writeFile(path.join(destination, room.localPath), staged.files.get(room.localPath), { flag: 'wx' });
    await writeFile(path.join(destination, 'manifest.json'), `${JSON.stringify(staged.manifest, null, 2)}\n`, { flag: 'wx' });
  } catch { throw new Error('Reviewed room staging could not be completed in its fresh private directory'); }
  console.log(`Verified and staged exactly ${staged.manifest.rooms.length} selected room USDZ derivatives; complete archive and member hashes match.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`Room AR staging failed: ${error.message}`); process.exitCode = 1; });
}
