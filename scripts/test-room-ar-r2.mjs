#!/usr/bin/env node
// Focused safety/integrity regression checks; all network traffic is loopback.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { sha256Hex, signRequest } from './r2-sigv4.mjs';
import { validateUsdz } from './upload-room-ar-r2.mjs';
import { validateRoomArchive } from './stage-room-ar-release.mjs';

const exec = promisify(execFile);
const script = path.join(import.meta.dirname, 'upload-room-ar-r2.mjs');
const collection = JSON.parse(await readFile(new URL('../public/spatial-museum/collection-manifest.json', import.meta.url), 'utf8'));
const ids = collection.rooms.map((room) => room.id);
function crc32(body) {
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// A small, genuine stored/aligned ZIP writer independent of the validator.
function packageUsdz(entries = [{ name: 'model.usda', body: Buffer.from('#usda 1.0\n( metersPerUnit = 1 )\n') }]) {
  let offset = 0;
  const locals = [];
  const centrals = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    // Include a conventional extra-field header as emitted by USD ZIP tools.
    let extraLength = (64 - ((offset + 30 + name.length) % 64)) % 64;
    if (extraLength < 4) extraLength += 64;
    const extra = Buffer.alloc(extraLength);
    extra.writeUInt16LE(0x1986, 0);
    extra.writeUInt16LE(extraLength - 4, 2);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc32(entry.body), 14);
    local.writeUInt32LE(entry.body.length, 18);
    local.writeUInt32LE(entry.body.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(extra.length, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc32(entry.body), 16);
    central.writeUInt32LE(entry.body.length, 20);
    central.writeUInt32LE(entry.body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, extra, entry.body);
    centrals.push(central, name);
    offset += local.length + name.length + extra.length + entry.body.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const usd = packageUsdz();
assert.deepEqual(validateUsdz(usd), { members: 1, firstMember: 'model.usda' });
assert.equal(validateUsdz(packageUsdz([{ name: 'model.usdc', body: Buffer.from('PXR-USDC\0crate') }, { name: 'textures/color.png', body: Buffer.from('pixels') }])).members, 2);
assert.throws(() => validateUsdz(packageUsdz([{ name: 'image.png', body: Buffer.from('pixels') }])), /first member/);
assert.throws(() => validateUsdz(packageUsdz([{ name: '../model.usda', body: Buffer.from('#usda 1.0') }])), /unsafe/);
assert.throws(() => validateUsdz(packageUsdz([{ name: 'model.usda', body: Buffer.from('#usda 1.0') }, { name: 'model.usda', body: Buffer.from('#usda 1.0') }])), /repeated/);
const badCrc = Buffer.from(usd);
badCrc[64] ^= 1;
assert.throws(() => validateUsdz(badCrc), /CRC/);
const compressed = Buffer.from(usd);
compressed.writeUInt16LE(8, 8);
compressed.writeUInt16LE(8, compressed.readUInt32LE(compressed.length - 6) + 10);
assert.throws(() => validateUsdz(compressed), /stored/);
const misaligned = Buffer.from(usd);
misaligned.writeUInt16LE(misaligned.readUInt16LE(28) - 1, 28);
assert.throws(() => validateUsdz(misaligned), /aligned/);
assert.throws(() => validateUsdz(usd.subarray(0, usd.length - 1)), /end record/);
console.log('USDZ: aligned USDA/USDC, normal extras, member CRC, first scene, paths, duplicates, compression and truncation checks pass.');

function packageTar(files) {
  const blocks = [];
  for (const file of files) {
    const header = Buffer.alloc(512);
    header.write(file.name, 0, 100, 'ascii');
    header.write('0000644\0', 100, 'ascii');
    header.write('0000000\0', 108, 'ascii');
    header.write('0000000\0', 116, 'ascii');
    header.write(`${file.body.length.toString(8).padStart(11, '0')}\0`, 124, 'ascii');
    header.write('00000000000\0', 136, 'ascii');
    header.fill(0x20, 148, 156);
    header[156] = (file.type || '0').charCodeAt(0);
    header.write('ustar\0', 257, 'ascii');
    header.write('00', 263, 'ascii');
    if (file.prefix) header.write(file.prefix, 345, 155, 'ascii');
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii');
    blocks.push(header, file.body, Buffer.alloc((512 - file.body.length % 512) % 512));
  }
  return Buffer.concat([...blocks, Buffer.alloc(1024)]);
}
const stagedRooms = ids.map((roomId) => ({ roomId, localPath: `${roomId}.usdz`, bytes: usd.length, sha256: sha256Hex(usd) }));
const tarFiles = [{ name: 'manifest.json', body: Buffer.from(JSON.stringify({ schema: 'atrium-room-ar-upload/1', rooms: stagedRooms })) }, ...stagedRooms.map((room) => ({ name: room.localPath, body: usd }))];
const tar = packageTar(tarFiles);
const checkTar = (body, expected = { bytes: body.length, sha256: sha256Hex(body) }) => validateRoomArchive(body, expected, ids);
assert.deepEqual(checkTar(tar).manifest.rooms, stagedRooms);
assert.throws(() => checkTar(tar, { bytes: tar.length, sha256: '0'.repeat(64) }), /archive complete SHA-256/);
assert.throws(() => checkTar(tar, { bytes: tar.length + 1, sha256: sha256Hex(tar) }), /archive complete SHA-256/);
assert.throws(() => checkTar(packageTar([...tarFiles, { name: 'unexpected.txt', body: Buffer.from('extra') }])), /extra members/);
assert.throws(() => checkTar(packageTar(tarFiles.map((file, index) => index === 1 ? { ...file, name: `../${file.name}` } : file))), /flat regular/);
assert.throws(() => checkTar(packageTar(tarFiles.map((file, index) => index === 1 ? { ...file, type: '2' } : file))), /flat regular/);
assert.throws(() => checkTar(packageTar(tarFiles.map((file, index) => index === 1 ? { ...file, prefix: 'private/path' } : file))), /flat regular/);
assert.throws(() => checkTar(packageTar([tarFiles[0], tarFiles[1], ...tarFiles.slice(1, 6)])), /unique/);
assert.throws(() => checkTar(packageTar(tarFiles.slice(0, 6))), /exactly/);
const unsafeManifest = { schema: 'atrium-room-ar-upload/1', rooms: stagedRooms.map((room, index) => index ? room : { ...room, localPath: `../${room.localPath}` }) };
assert.throws(() => checkTar(packageTar([{ ...tarFiles[0], body: Buffer.from(JSON.stringify(unsafeManifest)) }, ...tarFiles.slice(1)])), /localPath/);
const wrongMember = packageTar(tarFiles.map((file, index) => index === 6 ? { ...file, body: Buffer.alloc(file.body.length) } : file));
assert.throws(() => checkTar(wrongMember), /derivative SHA-256/);
const badTarHeader = Buffer.from(tar);
badTarHeader[100] ^= 1;
assert.throws(() => checkTar(badTarHeader), /checksum/);
assert.throws(() => checkTar(tar.subarray(0, tar.length - 512)), /end markers/);
console.log('Room tar staging: exact seven USTAR files, whole/member hashes, checksums, traversal/prefix/symlink/duplicate/extra-file rejection and confined manifest paths pass.');

const tmp = await mkdtemp(path.join(os.tmpdir(), 'atrium-room-ar-'));
const objects = new Map();
let puts = 0;
let getCount = 0;
let badCors = false;
let badMime = false;
let badBody = false;
const creds = { accessKeyId: 'room-test-key', secretAccessKey: 'room-test-secret' };
const server = createServer(async (req, res) => {
  try {
    if (req.method === 'PUT' && req.url.startsWith('/test-bucket/')) {
      const body = Buffer.concat(await Array.fromAsync(req));
      const key = req.url.slice('/test-bucket/'.length);
      const auth = String(req.headers.authorization);
      const amz = String(req.headers['x-amz-date']);
      const date = new Date(`${amz.slice(0, 4)}-${amz.slice(4, 6)}-${amz.slice(6, 8)}T${amz.slice(9, 11)}:${amz.slice(11, 13)}:${amz.slice(13, 15)}Z`);
      const signed = auth.match(/SignedHeaders=([^,]+)/)[1].split(';');
      const headers = Object.fromEntries(signed.filter((name) => !['host', 'x-amz-content-sha256', 'x-amz-date'].includes(name)).map((name) => [name, req.headers[name]]));
      const { signature } = signRequest({ method: 'PUT', url: `http://${req.headers.host}${req.url}`, headers, payloadHash: sha256Hex(body), ...creds, date });
      assert.equal(auth.match(/Signature=([a-f0-9]+)/)[1], signature);
      assert.equal(req.headers['content-type'], 'model/vnd.usdz+zip');
      assert.equal(req.headers['if-none-match'], '*');
      assert.match(req.headers['cache-control'], /immutable/);
      assert.equal(req.headers['x-amz-content-sha256'], sha256Hex(body));
      puts += 1;
      if (objects.has(key)) return res.writeHead(412).end();
      objects.set(key, body);
      return res.writeHead(200).end();
    }
    if (req.method === 'GET' && req.url.startsWith('/public/')) {
      assert.equal(req.headers.origin, 'https://atrium.earth');
      getCount += 1;
      const body = objects.get(req.url.slice('/public/'.length));
      if (!body) return res.writeHead(404).end();
      return res.writeHead(200, {
        'content-type': badMime ? 'application/octet-stream' : 'model/vnd.usdz+zip',
        'access-control-allow-origin': badCors ? 'https://other.invalid' : 'https://atrium.earth',
        'content-length': body.length,
      }).end(badBody ? Buffer.alloc(body.length) : body);
    }
    res.writeHead(400).end();
  } catch (error) { res.writeHead(403).end(error.message); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  const rooms = ids.map((roomId) => ({ roomId, localPath: `${roomId}.usdz`, bytes: usd.length, sha256: sha256Hex(usd) }));
  const manifest = path.join(tmp, 'manifest.json');
  const report = path.join(tmp, 'receipt.json');
  for (const room of rooms) await writeFile(path.join(tmp, room.localPath), usd);
  await writeFile(manifest, JSON.stringify({ schema: 'atrium-room-ar-upload/1', rooms }));
  const baseArgs = [script, `--manifest=${manifest}`, `--report=${report}`];
  const env = { ...process.env, R2_ACCOUNT_ID: 'test-account', R2_ACCESS_KEY_ID: creds.accessKeyId, R2_SECRET_ACCESS_KEY: creds.secretAccessKey, R2_BUCKET: 'test-bucket', R2_ENDPOINT: origin, R2_PUBLIC_BASE: `${origin}/public` };
  const invoke = async (args, activeEnv = env) => {
    try { return { ...(await exec(process.execPath, args, { env: activeEnv })), code: 0 }; }
    catch (error) { return { code: error.code, stdout: error.stdout, stderr: error.stderr }; }
  };
  const dryEnv = { ...env };
  for (const name of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']) delete dryEnv[name];
  assert.equal((await invoke([...baseArgs, '--dry-run'], dryEnv)).code, 0, 'dry run needs no credentials');
  assert.equal(puts, 0);
  assert.equal(getCount, 0);
  const dry = JSON.parse(await readFile(report, 'utf8'));
  assert.equal(dry.rooms.length, 6);
  assert.equal(dry.complete, true);
  assert.ok(dry.rooms.every((room) => room.status === 'validated'));
  assert.ok(!JSON.stringify(dry).includes(tmp), 'receipt has no local paths');
  assert.equal((await invoke(baseArgs)).code, 1, 'mode must be explicit');
  assert.equal((await invoke([...baseArgs, '--dry-run', '--allow-upload'])).code, 1);
  assert.equal((await invoke([...baseArgs, '--dry-run', '--skip-verify'])).code, 1);
  await writeFile(manifest, JSON.stringify({ schema: 'atrium-room-ar-upload/1', rooms: rooms.slice(1) }));
  assert.equal((await invoke([...baseArgs, '--allow-upload'])).code, 1, 'exact six-room set is required');
  await writeFile(manifest, JSON.stringify({ schema: 'atrium-room-ar-upload/1', rooms: [rooms[0], ...rooms.slice(0, 5)] }));
  assert.equal((await invoke([...baseArgs, '--allow-upload'])).code, 1, 'duplicate room fails');
  await writeFile(manifest, JSON.stringify({ schema: 'atrium-room-ar-upload/1', rooms }));
  await writeFile(path.join(tmp, rooms.at(-1).localPath), Buffer.alloc(usd.length));
  const preflight = await invoke([...baseArgs, '--allow-upload']);
  assert.equal(preflight.code, 1);
  assert.ok(!preflight.stderr.includes(tmp), 'error does not disclose local path');
  assert.equal(puts, 0, 'bad sixth source prevents every upload');
  await writeFile(path.join(tmp, rooms.at(-1).localPath), usd);
  assert.equal((await invoke([...baseArgs, '--allow-upload'])).code, 0);
  const uploaded = JSON.parse(await readFile(report, 'utf8'));
  assert.equal(uploaded.complete, true);
  assert.equal(puts, 6);
  assert.equal(getCount, 6);
  assert.ok(uploaded.rooms.every((room) => room.status === 'uploaded-verified' && room.verification.sha256 === sha256Hex(usd) && room.verification.contentType === 'model/vnd.usdz+zip'));
  assert.ok(uploaded.rooms.every((room) => room.key === `models/rooms/${room.roomId}/room-${sha256Hex(usd).slice(0, 12)}.usdz`));
  assert.ok(!JSON.stringify(uploaded).includes(tmp) && !JSON.stringify(uploaded).includes(creds.secretAccessKey));
  assert.equal((await invoke([...baseArgs, '--allow-upload'])).code, 0);
  assert.ok(JSON.parse(await readFile(report, 'utf8')).rooms.every((room) => room.status === 'existing-verified'), 'conditional PUT only reuses exact verified objects');
  badCors = true;
  assert.equal((await invoke([...baseArgs, '--allow-upload'])).code, 1, 'wrong production CORS fails');
  assert.match(JSON.parse(await readFile(report, 'utf8')).rooms[0].reason, /CORS/);
  badCors = false;
  badMime = true;
  assert.equal((await invoke([...baseArgs, '--allow-upload'])).code, 1, 'wrong MIME fails');
  badMime = false;
  badBody = true;
  assert.equal((await invoke([...baseArgs, '--allow-upload'])).code, 1, 'same-length wrong public body fails');
  assert.match(JSON.parse(await readFile(report, 'utf8')).rooms[0].reason, /SHA-256/);
  assert.ok(objects.size === 6 && [...objects.values()].every((body) => body.equals(usd)), 'existing immutable objects are never overwritten');
  assert.deepEqual(JSON.parse(await readFile(manifest, 'utf8')), { schema: 'atrium-room-ar-upload/1', rooms }, 'input manifest is unchanged');
  console.log('Room uploader: explicit modes, exact-six/preflight gates, source hashes, private-path-free receipts, signed serial conditional uploads, full public hashes/MIME/production CORS and immutable reruns pass.');
} finally {
  server.close();
  await rm(tmp, { recursive: true, force: true });
}
