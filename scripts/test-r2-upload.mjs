#!/usr/bin/env node
// Checks the R2 SigV4 signer against AWS's published S3 examples, then runs
// upload-previews-r2.mjs end to end against a local mock R2 + public origin.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { sha256Hex, signRequest } from './r2-sigv4.mjs';

const exec = promisify(execFile);
const EMPTY = sha256Hex('');
const aws = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
  service: 's3',
  date: new Date('2013-05-24T00:00:00Z'),
};

// AWS S3 "Signature Calculations for the Authorization Header" examples.
const vectors = [
  {
    name: 'GET object',
    method: 'GET',
    url: 'https://examplebucket.s3.amazonaws.com/test.txt',
    headers: { range: 'bytes=0-9' },
    payloadHash: EMPTY,
    signature: 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
  },
  {
    name: 'PUT object',
    method: 'PUT',
    url: 'https://examplebucket.s3.amazonaws.com/test$file.text',
    headers: { date: 'Fri, 24 May 2013 00:00:00 GMT', 'x-amz-storage-class': 'REDUCED_REDUNDANCY' },
    payloadHash: sha256Hex('Welcome to Amazon S3.'),
    signature: '98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd',
  },
  {
    name: 'GET bucket lifecycle',
    method: 'GET',
    url: 'https://examplebucket.s3.amazonaws.com/?lifecycle',
    headers: {},
    payloadHash: EMPTY,
    signature: 'fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543',
  },
  {
    name: 'GET bucket list objects',
    method: 'GET',
    url: 'https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J',
    headers: {},
    payloadHash: EMPTY,
    signature: '34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7',
  },
];

for (const vector of vectors) {
  const { signature } = signRequest({ ...aws, ...vector });
  assert.equal(signature, vector.signature, `SigV4 vector: ${vector.name}`);
}
console.log(`SigV4: ${vectors.length} AWS reference signatures match.`);

// End-to-end against a mock R2 that re-verifies each signature independently.
const creds = { accessKeyId: 'test-key', secretAccessKey: 'test-secret' };
const objects = new Map();
let putCount = 0;
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'PUT' && url.pathname.startsWith('/atrium-models/')) {
      const auth = String(req.headers.authorization || '');
      const signedNames = auth.match(/SignedHeaders=([^,]+)/)?.[1].split(';') || [];
      const sent = auth.match(/Signature=([a-f0-9]+)/)?.[1];
      const amz = String(req.headers['x-amz-date']);
      const date = new Date(`${amz.slice(0, 4)}-${amz.slice(4, 6)}-${amz.slice(6, 8)}T${amz.slice(9, 11)}:${amz.slice(11, 13)}:${amz.slice(13, 15)}Z`);
      const headers = Object.fromEntries(signedNames
        .filter((name) => !['host', 'x-amz-date', 'x-amz-content-sha256'].includes(name))
        .map((name) => [name, req.headers[name]]));
      assert.ok(signedNames.includes('host') && signedNames.includes('content-type'), 'host and content-type are signed');
      assert.equal(req.headers['x-amz-content-sha256'], sha256Hex(body), 'payload hash header matches body');
      const { signature } = signRequest({
        method: 'PUT', url: url.toString(), headers, payloadHash: sha256Hex(body), ...creds, region: 'auto', service: 's3', date,
      });
      assert.equal(sent, signature, 'server-side signature recomputation');
      assert.equal(req.headers['content-type'], 'model/gltf-binary');
      assert.match(String(req.headers['cache-control']), /immutable/);
      putCount += 1;
      objects.set(url.pathname.slice('/atrium-models/'.length), body);
      res.writeHead(200).end();
      return;
    }
    if (req.method === 'GET' && url.pathname.startsWith('/public/')) {
      const object = objects.get(url.pathname.slice('/public/'.length));
      if (!object) return res.writeHead(404).end();
      res.writeHead(200, { 'content-type': 'model/gltf-binary', 'content-length': object.length }).end(object);
      return;
    }
    res.writeHead(400).end('unexpected request');
  } catch (error) {
    res.writeHead(403).end(error.message);
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const tmp = await mkdtemp(path.join(os.tmpdir(), 'atrium-r2-'));
try {
  const slugs = ['sub-saharan-africa/test-mask', 'africa/test-figure', 'single-segment-work'];
  const bound = 'europe/bound-work';
  await mkdir(path.join(tmp, 'previews', bound), { recursive: true });
  await writeFile(path.join(tmp, 'previews', bound, 'preview.glb'), Buffer.from('glTF bound model'));
  const physical = path.join(tmp, 'physical-dimensions.json');
  await writeFile(physical, JSON.stringify({ [bound]: { spatial: { previewUrl: `/models/previews/${bound}/preview.glb` } } }));
  for (const [index, slug] of slugs.entries()) {
    await mkdir(path.join(tmp, 'previews', slug), { recursive: true });
    await writeFile(path.join(tmp, 'previews', slug, 'preview.glb'), Buffer.from(`glTF test model ${index}`));
  }
  const previewsJson = path.join(tmp, 'previews.json');
  await writeFile(previewsJson, JSON.stringify({
    [slugs[0]]: { url: `/models/previews/${slugs[0]}/preview.glb`, bytes: 1, faces: 10 },
    'europe/untouched': { url: 'https://models.atrium.earth/models/previews/europe/untouched/preview-aaaaaaaaaaaa.glb' },
    [bound]: { url: `/models/previews/${bound}/preview.glb` },
  }));
  await writeFile(path.join(tmp, 'slugs.txt'), `${slugs.join('\n')}\n${bound}\n../escape\n`);
  const env = {
    ...process.env,
    R2_ACCOUNT_ID: 'acct',
    R2_BUCKET: 'atrium-models',
    R2_ACCESS_KEY_ID: creds.accessKeyId,
    R2_SECRET_ACCESS_KEY: creds.secretAccessKey,
    R2_ENDPOINT: origin,
    R2_PUBLIC_BASE: `${origin}/public`,
  };
  const script = path.join(import.meta.dirname, 'upload-previews-r2.mjs');
  const argv = [script, `--input=${path.join(tmp, 'slugs.txt')}`, `--previews=${previewsJson}`, `--previews-dir=${path.join(tmp, 'previews')}`, `--report=${path.join(tmp, 'report.json')}`,
    `--physical-dimensions=${physical}`, `--spatial-eligibility=${path.join(tmp, 'spatial-eligibility.json')}`];

  const first = await exec(process.execPath, argv, { env }).then(() => 0, (error) => error.code);
  assert.equal(first, 1, 'invalid slug makes the run exit non-zero');
  const report = JSON.parse(await readFile(path.join(tmp, 'report.json'), 'utf8'));
  assert.equal(report.uploaded.length, 3);
  assert.deepEqual(report.failed.map((item) => item.slug), [bound, '../escape']);
  assert.match(report.failed[0].reason, /rebind/);
  const previews = JSON.parse(await readFile(previewsJson, 'utf8'));
  for (const slug of slugs) {
    const local = await readFile(path.join(tmp, 'previews', slug, 'preview.glb'));
    const hash = sha256Hex(local);
    assert.equal(previews[slug].url, `${origin}/public/models/previews/${slug}/preview-${hash.slice(0, 12)}.glb`);
    assert.equal(previews[slug].bytes, local.length);
    assert.match(previews[slug].url.split('/').at(-1), /^preview-[a-f0-9]{12}\.glb$/);
  }
  assert.equal(previews[slugs[0]].faces, 10, 'existing preview fields are preserved');
  assert.equal(previews['europe/untouched'].url, 'https://models.atrium.earth/models/previews/europe/untouched/preview-aaaaaaaaaaaa.glb');
  assert.equal(previews[bound].url, `/models/previews/${bound}/preview.glb`, 'bound preview is not moved');
  assert.equal(putCount, 3);

  await writeFile(path.join(tmp, 'slugs.txt'), `${slugs.join('\n')}\n`);
  await exec(process.execPath, argv, { env });
  const second = JSON.parse(await readFile(path.join(tmp, 'report.json'), 'utf8'));
  assert.equal(second.unchanged.length, 3, 'rerun is idempotent');
  assert.equal(putCount, 3, 'rerun does not re-upload');

  const mirrorDir = path.join(tmp, 'mirror');
  const mirror = path.join(import.meta.dirname, 'mirror-previews-r2.mjs');
  await exec(process.execPath, [mirror, `--slugs=${slugs.join(',')}`, `--previews=${previewsJson}`, `--previews-dir=${mirrorDir}`], { env });
  for (const slug of slugs) {
    assert.deepEqual(await readFile(path.join(mirrorDir, slug, 'preview.glb')), await readFile(path.join(tmp, 'previews', slug, 'preview.glb')), `mirror of ${slug}`);
  }
  const tampered = JSON.parse(await readFile(previewsJson, 'utf8'));
  tampered[slugs[0]].url = tampered[slugs[0]].url.replace(/preview-[a-f0-9]{12}/, 'preview-000000000000');
  objects.set(new URL(tampered[slugs[0]].url).pathname.slice('/public/'.length), Buffer.from('wrong bytes'));
  const tamperedJson = path.join(tmp, 'tampered.json');
  await writeFile(tamperedJson, JSON.stringify(tampered));
  const badMirror = await exec(process.execPath, [mirror, `--slugs=${slugs[0]}`, `--previews=${tamperedJson}`, `--previews-dir=${path.join(tmp, 'mirror2')}`], { env })
    .then(() => 0, (error) => error.code);
  assert.equal(badMirror, 1, 'mirror rejects bytes that do not match the hashed filename');

  const badEnv = { ...env, R2_SECRET_ACCESS_KEY: 'wrong-secret' };
  await writeFile(previewsJson, JSON.stringify({}));
  const bad = await exec(process.execPath, argv, { env: badEnv }).then(() => 0, (error) => error.code);
  assert.equal(bad, 1, 'a rejected signature fails the run');
  assert.deepEqual(JSON.parse(await readFile(previewsJson, 'utf8')), {}, 'failed uploads leave previews.json untouched');
  console.log('upload-previews-r2: end-to-end mock upload, verify, binding guard, single-segment slugs, idempotent rerun, mirror round-trip and auth failure pass.');
} finally {
  server.close();
  await rm(tmp, { recursive: true, force: true });
}
