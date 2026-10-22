#!/usr/bin/env node
// Read-only review rendering. Production HTML/material/transform code is reused
// in an in-memory page; no viewer, catalog, pose, source or preview is rewritten.
// Cloud: node scripts/render-vessel-scope-review.mjs --request=docs/ingest/...json --out=$RUNNER_TEMP/review --work=$RUNNER_TEMP/models
// Local metadata-only check: add --validate-only. Never fetches a model in this mode.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { Transform, Readable } from 'node:stream';
import { parseModelTransform } from '../public/model-render-utils.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW_BATCHES = new Set(['etruscan-greek-20261015', 'beautiful-2000-20261015', 'beautiful-expansion-20261019', 'crowd-pleasers-20261021', 'crowd-pleasers-20261022']);
const sha256 = (body) => createHash('sha256').update(body).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => [k, canonical(value[k])]));
  return value;
}
export const transformFingerprint = (value) => sha256(JSON.stringify(canonical(parseModelTransform(value))));
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const inside = (base, file) => file !== base && file.startsWith(`${base}${sep}`);
const safeSlug = (slug) => typeof slug === 'string' && /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/.test(slug);

export function cameraViews(rawTransform) {
  const transform = parseModelTransform(rawTransform);
  const d = transform.viewDirection || [0.55, 0.34, 0.9];
  const length = Math.hypot(d[0], d[2]);
  // A polar production camera has no azimuth; use the canonical transformed +Z.
  const front = length > 1e-8 ? [d[0] / length, 0, d[2] / length] : [0, 0, 1];
  return [
    { key: 'FRONT', direction: front, up: [0, 1, 0] },
    { key: 'REVERSE', direction: front.map((n) => -n), up: [0, 1, 0] },
    { key: 'ABOVE', direction: [0, 1, 0], up: [0, 0, -1] },
    { key: 'UNDERSIDE', direction: [0, -1, 0], up: [0, 0, 1] },
  ];
}

export async function closeReviewResources(browser, cleanup, timeoutMs = 15000) {
  let timer;
  try {
    if (browser) await Promise.race([
      browser.close(),
      new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Review browser shutdown timed out after completed render work')), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
    await cleanup();
  }
}

export function bindRequest(request, { catalog, previews, orientations }) {
  if (request?.schema !== 'atrium-vessel-scope-review/1' || !REVIEW_BATCHES.has(request.batch)) throw new Error('Wrong review schema or batch');
  if (!Array.isArray(request.works) || !request.works.length || request.works.length > 80) throw new Error('Expected 1–80 bound works');
  const artifacts = request.sourceArtifacts || [];
  if (!Array.isArray(artifacts) || artifacts.length > 2) throw new Error('Expected at most two exact source artifacts');
  for (const a of artifacts) {
    const expectedName = new RegExp(`^atrium-temporary-sources-${request.batch}-${a.runId}-[0-9]+$`);
    if (a.repository !== 'never-nude/atrium.earth' || !Number.isSafeInteger(a.runId) || a.runId <= 0 || !Number.isSafeInteger(a.artifactId) || a.artifactId <= 0 || !/^[a-f0-9]{40}$/.test(a.workflowHeadSha || '') || !expectedName.test(a.name || '')) throw new Error('Invalid exact repository/run/artifact binding');
  }
  const records = new Map(catalog.map((c) => [c.slug, c]));
  const seen = new Set();
  return request.works.map((item) => {
    if (!safeSlug(item.slug) || seen.has(item.slug)) throw new Error('Unsafe or duplicate slug');
    seen.add(item.slug);
    const record = records.get(item.slug);
    const preview = previews[item.slug];
    if (!record || !preview) throw new Error(`${item.slug}: missing acquired catalog/preview record`);
    if (record.ingest_batch !== request.batch) throw new Error(`${item.slug}: work is outside the requested acquisition batch`);
    if (!/^[a-f0-9]{32}$/.test(item.sourceUid || '') || !String(record.source_url || '').includes(item.sourceUid)) throw new Error(`${item.slug}: exact source UID does not match catalog`);
    if (item.previewUrl !== preview.url || item.previewBytes !== preview.bytes || !Number.isSafeInteger(item.previewBytes) || item.previewBytes <= 0) throw new Error(`${item.slug}: preview binding differs from acquired manifest`);
    const expected = new URL(`https://models.atrium.earth/models/previews/${item.slug}/`);
    const url = new URL(item.previewUrl);
    if (url.origin !== expected.origin || !url.pathname.startsWith(expected.pathname) || !/^preview-[a-f0-9]{12}\.glb$/.test(url.pathname.slice(expected.pathname.length)) || url.search || url.hash || url.username || url.password) throw new Error(`${item.slug}: expected immutable public R2 preview URL`);
    if (!/^[a-f0-9]{64}$/.test(item.previewSha256 || '') || !url.pathname.endsWith(`preview-${item.previewSha256.slice(0, 12)}.glb`)) throw new Error(`${item.slug}: invalid preview full hash`);
    if (item.source) {
      const s = item.source;
      if (typeof s.path !== 'string' || isAbsolute(s.path) || s.path.includes('\\') || s.path.split('/').some((p) => !p || p === '.' || p === '..') || !s.path.endsWith('.glb') || !/^[a-f0-9]{64}$/.test(s.sha256 || '') || !Number.isSafeInteger(s.bytes) || s.bytes <= 0) throw new Error(`${item.slug}: invalid original-source artifact binding`);
      if (!artifacts.some((_a, i) => s.path.startsWith(`${i === 0 ? 'one' : 'two'}/`))) throw new Error(`${item.slug}: source path is not bound to a supplied artifact`);
    }
    return { ...item, title: record.title, transform: orientations[item.slug] || 'auto', transformSha256: transformFingerprint(orientations[item.slug] || 'auto'), views: cameraViews(orientations[item.slug] || 'auto') };
  });
}

export function productionAppearanceFactory(script, materialAppearances, appearanceOverrides, recordsBySlug) {
  // Execute only the checked-out production appearance helpers, with data passed
  // as values. This prevents a second material-profile implementation drifting.
  const a = script.indexOf('const internalNotePatterns = [');
  const b = script.indexOf('\nif (!existsSync(chrome))', a);
  const c = script.indexOf('function clean(value) {');
  const d = script.indexOf('function staticServer()', c);
  if ([a, b, c, d].some((n) => n < 0) || !(a < b && b < c && c < d)) throw new Error('Production appearance helper boundaries changed; review adapter must be rechecked');
  return new Function('materialAppearances', 'appearanceOverrides', 'recordsBySlug', `${script.slice(a, b)}\n${script.slice(c, d)}\nreturn appearanceForSlug;`)(materialAppearances, appearanceOverrides, recordsBySlug);
}

const inspectCode = String.raw`
const nativeReview = new URLSearchParams(window.location.search).get('native') === '1';
function inspectReviewModel(root) {
  const meshes=[];
  root.traverse((obj)=>{
    if(!obj.isMesh || !obj.geometry) return;
    const g=obj.geometry, pos=g.getAttribute('position'), col=g.getAttribute('color');
    let colorRange=null;
    if(col){
      const min=Array(col.itemSize).fill(Infinity), max=Array(col.itemSize).fill(-Infinity);
      for(let i=0;i<col.count;i++) for(let c=0;c<col.itemSize;c++){
        const value=col.getComponent(i,c); min[c]=Math.min(min[c],value); max[c]=Math.max(max[c],value);
      }
      colorRange={count:col.count,itemSize:col.itemSize,normalized:col.normalized,min,max};
    }
    const materials=(Array.isArray(obj.material)?obj.material:[obj.material]).filter(Boolean).map(m=>({
      name:m.name,type:m.type,color:m.color?.toArray(),metalness:m.metalness,roughness:m.roughness,
      opacity:m.opacity,transparent:m.transparent,side:m.side,vertexColors:m.vertexColors,
      maps:['map','normalMap','aoMap','alphaMap','emissiveMap','metalnessMap','roughnessMap','bumpMap','displacementMap'].filter(k=>Boolean(m[k]))
    }));
    meshes.push({name:obj.name,vertices:pos?.count||0,faces:(g.index?.count||pos?.count||0)/3,colorRange,materials});
  });
  return {meshCount:meshes.length,faces:meshes.reduce((n,m)=>n+m.faces,0),meshes};
}
window.reviewView=(view)=>{
  if(!current || !window.__reviewBox) throw new Error('No loaded review model');
  camera.up.set(...view.up);
  const frame=frameCameraToBox(THREE,camera,window.__reviewBox,{direction:view.direction,padding:1.16});
  renderer.render(scene,camera);
  return {key:view.key,direction:view.direction,up:view.up,camera:camera.position.toArray(),target:frame.target.toArray(),distance:frame.distance,padding:frame.padding};
};
`;

export function reviewHtml(productionHtml) {
  let html = productionHtml;
  const edits = [
    ['window.loadModel=(url,', `${inspectCode}\nwindow.loadModel=(url,`],
    ['    removeScanHelpers(m);', '    window.__reviewBefore=inspectReviewModel(m);\n    if(!nativeReview) removeScanHelpers(m);'],
    ['const prepared=list.map((material)=>prepareMaterial(material, appearance));', 'const prepared=nativeReview ? list : list.map((material)=>prepareMaterial(material, appearance));'],
    ['for(const material of prepared) applyMaterialAppearance(obj, material, appearance);', 'if(!nativeReview) for(const material of prepared) applyMaterialAppearance(obj, material, appearance);'],
    ['scene.add(m); current=m;', 'scene.add(m); current=m;\n    window.__reviewBox=box; window.__reviewTransform=transform;\n    window.__reviewAfter=inspectReviewModel(m);\n    window.__reviewSummary={nativeReview,transform,bounds:{min:box.min.toArray(),max:box.max.toArray()},before:window.__reviewBefore,after:window.__reviewAfter};'],
  ];
  for (const [before, after] of edits) {
    if (html.split(before).length !== 2) throw new Error(`Production render hook changed: ${before.slice(0, 70)}`);
    html = html.replace(before, after);
  }
  return html;
}

export function inspectGlb(body) {
  if (body.length < 20 || body.toString('ascii', 0, 4) !== 'glTF' || body.readUInt32LE(4) !== 2 || body.readUInt32LE(8) !== body.length || body.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Not a complete GLB2');
  const document = JSON.parse(body.subarray(20, 20 + body.readUInt32LE(12)).toString('utf8').trim());
  for (const r of [...(document.buffers || []), ...(document.images || [])]) {
    if (r.uri && !r.uri.startsWith('data:')) throw new Error('External GLB dependencies are not self-contained; preserve and review as a complete bundle');
  }
  const extensionsUsed = [...new Set([...(document.extensionsUsed || []), ...(document.materials || []).flatMap((m) => Object.keys(m.extensions || {}))])];
  const loaderSource = readFileSync(join(ROOT, 'node_modules/three/examples/jsm/loaders/GLTFLoader.js'), 'utf8');
  const supported = new Set([...loaderSource.matchAll(/'((?:KHR|EXT)_materials_[A-Za-z0-9_]+)'/g)].map((m) => m[1]));
  return {images: document.images?.length || 0, textures: document.textures?.length || 0, materials: document.materials || [], extensionsUsed, unsupportedAppearanceExtensions: extensionsUsed.filter((e) => /materials_|techniques_webgl/.test(e) && !supported.has(e))};
}

let referenceIo;
async function materialReferenceIo() {
  if (!referenceIo) referenceIo = (async () => {
    const { NodeIO } = await import('@gltf-transform/core');
    const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
    const { default: draco } = await import('draco3dgltf');
    const { MeshoptDecoder } = await import('meshoptimizer');
    await MeshoptDecoder.ready;
    return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'draco3d.decoder': await draco.createDecoderModule(), 'meshopt.decoder': MeshoptDecoder,
    });
  })();
  return referenceIo;
}
export function documentGeometryFingerprint(doc) {
  const root = doc.getRoot(), meshes = root.listMeshes(), nodes = root.listNodes(), skins = root.listSkins();
  const accessor = (a) => a ? { type: a.getType(), componentType: a.getComponentType(), normalized: a.getNormalized(), arraySha256: sha256(Buffer.from(a.getArray().buffer, a.getArray().byteOffset, a.getArray().byteLength)) } : null;
  const fingerprint = {
    // Include every decoded accessor, not just positions: UVs, normals, source
    // colors, indices, morph/skin/animation data must remain unchanged too.
    // IO may reorder the registry without changing any semantic binding. Keep
    // every full signature and its multiplicity; never sort mesh attributes,
    // node graphs or animation bindings to hide an actual data change.
    accessors: root.listAccessors().map(accessor).map((a) => JSON.stringify(canonical(a))).sort(),
    meshes: meshes.map((m) => ({ name: m.getName(), weights: m.getWeights(), primitives: m.listPrimitives().map((p) => ({ mode: p.getMode(), indices: accessor(p.getIndices()), attributes: Object.fromEntries(p.listSemantics().sort().map((k) => [k, accessor(p.getAttribute(k))])), targets: p.listTargets().map((t) => Object.fromEntries(t.listSemantics().sort().map((k) => [k, accessor(t.getAttribute(k))]))) })) })),
    nodes: nodes.map((n) => ({ name: n.getName(), translation: n.getTranslation(), rotation: n.getRotation(), scale: n.getScale(), weights: n.getWeights(), mesh: meshes.indexOf(n.getMesh()), skin: skins.indexOf(n.getSkin()), children: n.listChildren().map((c) => nodes.indexOf(c)) })),
    skins: skins.map((s) => ({ skeleton: nodes.indexOf(s.getSkeleton()), joints: s.listJoints().map((n) => nodes.indexOf(n)), inverseBindMatrices: accessor(s.getInverseBindMatrices()) })),
    animations: root.listAnimations().map((a) => {
      const samplers = a.listSamplers();
      return { name: a.getName(), samplers: samplers.map((s) => ({ input: accessor(s.getInput()), output: accessor(s.getOutput()), interpolation: s.getInterpolation() })), channels: a.listChannels().map((c) => ({ targetNode: nodes.indexOf(c.getTargetNode()), targetPath: c.getTargetPath(), sampler: samplers.indexOf(c.getSampler()) })) };
    }),
    scenes: root.listScenes().map((scene) => scene.listChildren().map((n) => nodes.indexOf(n))),
  };
  return sha256(JSON.stringify(canonical(fingerprint)));
}
export function preserveReferenceNodeTransforms(sourceBody, referenceBody) {
  inspectGlb(sourceBody); inspectGlb(referenceBody);
  const document = (body) => JSON.parse(body.subarray(20, 20 + body.readUInt32LE(12)).toString('utf8').trim());
  const source = document(sourceBody), reference = document(referenceBody);
  const graph = (d) => ({
    nodes: (d.nodes || []).map((n) => ({ name: n.name || '', mesh: n.mesh ?? null, skin: n.skin ?? null, camera: n.camera ?? null, children: n.children || [] })),
    scenes: (d.scenes || []).map((s) => ({ name: s.name || '', nodes: s.nodes || [] })), scene: d.scene ?? null,
  });
  if (JSON.stringify(canonical(graph(source))) !== JSON.stringify(canonical(graph(reference)))) throw new Error('Material reference node/mesh/child/scene mapping changed; raw transforms cannot be safely rebound');
  for (const [i, node] of (reference.nodes || []).entries()) {
    for (const key of ['matrix', 'translation', 'rotation', 'scale']) {
      delete node[key];
      if (Object.hasOwn(source.nodes[i], key)) node[key] = structuredClone(source.nodes[i][key]);
    }
  }
  const encoded = Buffer.from(JSON.stringify(reference));
  const padded = Buffer.concat([encoded, Buffer.alloc((4 - encoded.length % 4) % 4, 0x20)]);
  // Only replace the JSON chunk. Preserve the complete binary/other chunk tail
  // byte for byte, including chunk headers, padding and embedded image bytes.
  const tail = referenceBody.subarray(20 + referenceBody.readUInt32LE(12));
  const output = Buffer.concat([referenceBody.subarray(0, 20), padded, tail]);
  output.writeUInt32LE(output.length, 8); output.writeUInt32LE(padded.length, 12);
  return output;
}
export async function createLegacyMaterialReference(sourcePath, target) {
  const io = await materialReferenceIo();
  const { metalRough } = await import('@gltf-transform/functions');
  const document = await io.read(sourcePath);
  const before = documentGeometryFingerprint(document);
  await document.transform(metalRough());
  // Preserve decoded geometry exactly in the reference. Re-encoding source
  // Draco/Meshopt could introduce fresh quantization; no compressor is invoked.
  for (const extension of document.getRoot().listExtensionsUsed()) {
    if (['KHR_draco_mesh_compression', 'EXT_meshopt_compression'].includes(extension.extensionName)) extension.dispose();
  }
  const after = documentGeometryFingerprint(document);
  if (after !== before) throw new Error('Material-only reference conversion changed decoded geometry/data');
  await io.write(target, document);
  writeFileSync(target, preserveReferenceNodeTransforms(readFileSync(sourcePath), readFileSync(target)));
  const reread = documentGeometryFingerprint(await io.read(target));
  if (reread !== before) throw new Error('Material reference serialization changed decoded geometry/data');
  const body = readFileSync(target), glb = inspectGlb(body);
  if (glb.unsupportedAppearanceExtensions.length) throw new Error('Material reference still has unsupported appearance extensions');
  return { sha256: sha256(body), bytes: body.length, glb, process: { tool: '@gltf-transform/functions metalRough', version: json(join(ROOT, 'node_modules/@gltf-transform/functions/package.json')).version, label: 'material-normalized-source-reference', materialWorkflowConversion: 'KHR_materials_pbrSpecularGlossiness to supported metal/rough + specular/ior', geometrySimplification: false, textureCompression: false, sourceCompressionDecodedOnly: true, sourceRawNodeTransformsPreservedExactly: true, nodeMeshChildSceneMappingVerified: true, binaryChunksPreservedDuringTransformJsonRepack: true, accessorRegistryComparedAsFullSignatureMultiset: true, geometryFingerprintSha256: before, geometryFingerprintVerifiedBeforeAfterAndReread: true, limitation: 'Material workflow conversion may rewrite specular/gloss texture channels. It is a labeled reference, not the unmodified provider file, and requires human appearance comparison.' } };
}

async function fetchPreview(item, target) {
  const response = await fetch(item.previewUrl, { signal: AbortSignal.timeout(180000) });
  if (!response.ok || !response.body) throw new Error(`Preview GET failed: HTTP${response.status}`);
  if (response.headers.get('content-length') && Number(response.headers.get('content-length')) !== item.previewBytes) throw new Error('Preview Content-Length mismatch');
  const hash = createHash('sha256'); let bytes = 0;
  const meter = new Transform({ transform(chunk, _encoding, done) {
    bytes += chunk.length;
    if (bytes > item.previewBytes) return done(new Error('Preview exceeds bound byte count'));
    hash.update(chunk); done(null, chunk);
  }});
  const { createWriteStream } = await import('node:fs');
  await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(target, { flags: 'wx' }));
  const digest = hash.digest('hex');
  if (bytes !== item.previewBytes || !item.previewUrl.endsWith(`preview-${digest.slice(0, 12)}.glb`) || (item.previewSha256 && digest !== item.previewSha256)) throw new Error('Full preview bytes/hash do not match immutable binding');
  return { sha256: digest, bytes, url: item.previewUrl };
}

async function verifiedOriginal(sourceRoot, source) {
  if (!sourceRoot) throw new Error('Source artifact root is required for original comparison');
  const root = realpathSync(sourceRoot), path = realpathSync(resolve(root, source.path));
  if (!inside(root, path) || !statSync(path).isFile() || statSync(path).size !== source.bytes) throw new Error('Original source escapes artifact root or differs in size');
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(path)) { hash.update(chunk); bytes += chunk.length; }
  if (hash.digest('hex') !== source.sha256 || bytes !== source.bytes) throw new Error('Original source full SHA mismatch');
  return path;
}

async function renderBound(works, options, bindings) {
  const { chromium } = await import('playwright'); const { default: sharp } = await import('sharp');
  mkdirSync(options.out, { recursive: true }); mkdirSync(options.work, { recursive: true });
  const assets = new Map();
  const writeReport = (results) => writeFileSync(join(options.out, 'review-report.json'), JSON.stringify({ schema: 'atrium-vessel-scope-render-report/1', batch: bindings.batch, status: works.length ? (results.length === works.length ? (results.some((r) => r.status === 'render-failed-held') ? 'render-failed-held' : 'renders-complete-pending-human-review') : 'pending-render') : 'empty-shard-pending', expectedCount: works.length, bindings: bindings.hashes, checked: new Date().toISOString(), convention: 'FRONT/REVERSE use the production camera azimuth in the production-transformed frame; ABOVE/UNDERSIDE are exact ±Y with nonsingular camera-up vectors. Wrong provisional pose means anatomical top/bottom is still unresolved. Images do not constitute a human scope decision.', works: results }, null, 2));
  writeReport([]);
  if (!works.length) return;
  const modelScratch = mkdtempSync(join(options.work, 'scope-models-'));
  const server = createServer((req, res) => {
    const path = new URL(req.url || '/', 'http://localhost').pathname;
    const fixed = new Map([
      ['/review.html', { body: bindings.html, type: 'text/html' }],
      ['/model-render-utils.js', { path: join(ROOT, 'public/model-render-utils.js'), type: 'text/javascript' }],
    ]);
    let item = fixed.get(path);
    if (assets.has(path)) item = { path: assets.get(path), type: 'model/gltf-binary' };
    for (const [prefix, folder] of [['/node_modules/three/', 'node_modules/three'], ['/public/vendor/draco/', 'public/vendor/draco']]) {
      if (path.startsWith(prefix)) {
        const root = realpathSync(join(ROOT, folder)), candidate = resolve(root, decodeURIComponent(path.slice(prefix.length)));
        if (inside(root, candidate) && existsSync(candidate) && inside(root, realpathSync(candidate)) && statSync(candidate).isFile()) item = { path: candidate, type: extname(candidate) === '.wasm' ? 'application/wasm' : 'text/javascript' };
      }
    }
    if (!item) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': item.type });
    if (item.body) res.end(item.body); else createReadStream(item.path).pipe(res);
  });
  await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const port = server.address().port;
  let browser; const results = [];
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}), args: (process.env.CHROME_EXTRA_ARGS || '--no-sandbox --enable-unsafe-swiftshader --use-angle=swiftshader').split(' ').filter(Boolean) });
    for (const [i, item] of works.entries()) {
      const target = join(modelScratch, `preview-${i}.glb`);
      const referenceTarget = join(modelScratch, `source-reference-${i}.glb`);
      const result = { slug: item.slug, title: item.title, sourceUid: item.sourceUid, transform: item.transform, transformSha256: item.transformSha256, appearanceSha256: sha256(JSON.stringify(canonical(bindings.appearance(item.slug)))), status: 'pending-human-review', expectedPreview: { url: item.previewUrl, sha256: item.previewSha256, bytes: item.previewBytes }, expectedSource: item.source ? { sha256: item.source.sha256, bytes: item.source.bytes } : null, sourceAvailability: item.source ? 'bound-pending-verification' : 'not-supplied', sourceNativeAppearanceStatus: item.source ? 'pending' : 'not-compared-provider-original-unavailable', sourceOriginalRendered: false, sourceReferenceRendered: false, sourceFidelityDecision: null, views: [], decision: null };
      try {
        result.preview = await fetchPreview(item, target);
        result.preview.glb = inspectGlb(readFileSync(target));
        if (result.preview.glb.unsupportedAppearanceExtensions.length) {
          result.previewAppearanceStatus = 'unsupported-held';
          throw new Error(`Production preview has unsupported native appearance: ${result.preview.glb.unsupportedAppearanceExtensions.join(', ')}`);
        }
        result.previewAppearanceStatus = 'supported-pending-human-review';
        assets.set('/assets/preview.glb', target);
        let sourcePath, sourceMode = 'source-native';
        if (item.source) {
          sourcePath = await verifiedOriginal(options.sourceRoot, item.source);
          result.sourceAvailability = 'verified-exact-bytes-sha256';
          result.sourceArtifact = item.source.path.startsWith('one/') ? bindings.sourceArtifacts[0] : bindings.sourceArtifacts[1];
          result.source = { sha256: item.source.sha256, bytes: item.source.bytes, glb: inspectGlb(readFileSync(sourcePath)) };
          const unsupported = result.source.glb.unsupportedAppearanceExtensions;
          if (unsupported.length) {
            result.sourceNativeAppearanceStatus = 'unsupported-native-appearance';
            result.sourceNativeAppearanceBlockers = unsupported;
            if (unsupported.length !== 1 || unsupported[0] !== 'KHR_materials_pbrSpecularGlossiness') throw new Error(`Unsupported native source appearance: ${unsupported.join(', ')}`);
            result.sourceReference = await createLegacyMaterialReference(sourcePath, referenceTarget);
            sourcePath = referenceTarget; sourceMode = 'material-normalized-source-reference';
          } else result.sourceNativeAppearanceStatus = 'supported-pending-human-review';
          assets.set('/assets/source.glb', sourcePath);
        }
        const modes = [{ key: 'preview-production', model: '/assets/preview.glb', native: false }, { key: sourcePath ? sourceMode : 'preview-native', model: sourcePath ? '/assets/source.glb' : '/assets/preview.glb', native: true }];
        const tiles = [], cellW = 360, cellH = 450, labelH = 38;
        for (const [row, mode] of modes.entries()) {
          const page = await browser.newPage({ viewport: { width: 1000, height: 1250 }, deviceScaleFactor: 1 });
          const browserErrors = [];
          page.on('pageerror', (error) => browserErrors.push(error.message));
          page.on('console', (message) => {
            if (message.type() === 'error' && !String(message.location().url || '').endsWith('/favicon.ico')) browserErrors.push(message.text());
          });
          try {
            page.setDefaultTimeout(180000);
            await page.goto(`http://127.0.0.1:${port}/review.html?native=${mode.native ? '1' : '0'}`, { waitUntil: 'load' });
            await page.waitForFunction(() => window.__ready === true);
            await page.evaluate(async ({ model, transform, appearance }) => {
              let timer;
              try { await Promise.race([window.loadModel(model, transform, JSON.stringify(appearance)), new Promise((_yes, no) => { timer=setTimeout(() => no(new Error('Model decoding/render exceeded180s')),180000); })]); }
              finally { clearTimeout(timer); }
            }, { model: mode.model, transform: item.transform, appearance: bindings.appearance(item.slug) });
            result[mode.key] = await page.evaluate(() => window.__reviewSummary);
            if (!(result[mode.key].after.meshCount > 0) || !(result[mode.key].after.faces > 0)) throw new Error('No visible mesh geometry after production/source loading');
            if (browserErrors.length) throw new Error(`Browser/model error: ${browserErrors.join('; ').slice(0, 800)}`);
            for (const [column, view] of item.views.entries()) {
              const camera = await page.evaluate((v) => window.reviewView(v), view);
              await page.evaluate(() => new Promise((yes) => requestAnimationFrame(() => requestAnimationFrame(yes))));
              const png = await page.screenshot({ type: 'png' });
              const webp = await sharp(png).resize(800, 1000).webp({ quality: 90 }).toBuffer();
              const tile = await sharp(webp).resize(cellW, cellH).webp({ quality: 88 }).toBuffer();
              const file = `${item.slug.replaceAll('/', '__')}--${mode.key}--${view.key.toLowerCase()}.webp`;
              writeFileSync(join(options.out, file), webp);
              result.views.push({ mode: mode.key, ...camera, file, imageSha256: sha256(webp) });
              const label = Buffer.from(`<svg width="${cellW}" height="${labelH}"><rect width="100%" height="100%" fill="#111"/><text x="8" y="24" fill="#eee" font-family="sans-serif" font-size="11">${mode.key} · ${view.key}</text></svg>`);
              tiles.push({ input: tile, left: column * cellW, top: row * (cellH + labelH) }, { input: label, left: column * cellW, top: row * (cellH + labelH) + cellH });
            }
            if (browserErrors.length) throw new Error(`Browser/model error: ${browserErrors.join('; ').slice(0, 800)}`);
          } finally { await page.close(); }
        }
        const file = `${item.slug.replaceAll('/', '__')}.webp`;
        await sharp({ create: { width: cellW * 4, height: (cellH + labelH) * 2, channels: 3, background: '#111' } }).composite(tiles).webp({ quality: 90 }).toFile(join(options.out, file));
        result.contact = file;
        result.contactSha256 = sha256(readFileSync(join(options.out, file)));
        result.sourceOriginalRendered = Boolean(sourcePath) && sourceMode === 'source-native';
        result.sourceReferenceRendered = Boolean(sourcePath) && sourceMode === 'material-normalized-source-reference';
        result.limitation = sourcePath ? (sourceMode === 'source-native' ? 'Native source row preserves all source meshes/materials. ' : 'Source row is an explicitly labeled material-normalized reference; the unmodified legacy source has unsupported native appearance. Original bytes remain unchanged. ') + 'Production preview row uses production helper removal and appearance code. Independent normalization/framing is visual comparison, not proof of source/preview geometric equivalence.' : 'Original provider GLB was not supplied. Native comparison uses the same optimized preview and does not establish source-original fidelity.';
        console.log(`[${i + 1}/${works.length}] ${item.slug}: four distinct directions, ${sourcePath ? sourceMode : 'preview-only native'} comparison`);
      } catch (error) {
        result.status = 'render-failed-held'; result.error = error.message; process.exitCode = 1;
        console.error(`[${i + 1}/${works.length}] ${item.slug}: ${error.message}`);
      } finally {
        assets.clear(); rmSync(target, { force: true }); rmSync(referenceTarget, { force: true });
        results.push(result);
        writeReport(results);
      }
    }
  } finally {
    await closeReviewResources(browser, async () => {
      rmSync(modelScratch, { recursive: true, force: true });
      server.closeAllConnections(); await new Promise((yes) => server.close(yes));
    });
  }
}

async function main() {
  const { values } = parseArgs({ options: { request: { type: 'string' }, out: { type: 'string' }, work: { type: 'string' }, 'source-root': { type: 'string' }, 'validate-only': { type: 'boolean' }, shard: { type: 'string', default: '0' }, shards: { type: 'string', default: '1' } } });
  if (!values.request) throw new Error('--request is required');
  const requestPath = realpathSync(resolve(values.request));
  if (!inside(realpathSync(join(ROOT, 'docs/ingest')), requestPath) && !inside(realpathSync(join(ROOT, '.atrium-ingest')), requestPath)) throw new Error('Review request must be in docs/ingest or ignored .atrium-ingest');
  const catalog = json(join(ROOT, 'src/data/catalog.json')), previews = json(join(ROOT, 'src/data/previews.json')), orientations = json(join(ROOT, 'src/data/orientations.json'));
  const shard = Number(values.shard), shards = Number(values.shards);
  if (!Number.isInteger(shards) || shards < 1 || shards > 12 || !Number.isInteger(shard) || shard < 0 || shard >= shards) throw new Error('Invalid shard');
  const request = json(requestPath);
  const bound = bindRequest(request, { catalog, previews, orientations });
  const works = bound.filter((_item, i) => i % shards === shard);
  if (values['validate-only']) { console.log(JSON.stringify({ batch: request.batch, boundWorks: bound.length, shardWorks: works.length, views: ['FRONT', 'REVERSE', 'ABOVE', 'UNDERSIDE'], providerSources: works.filter((w) => w.source).length })); return; }
  if (!process.env.CI && process.env.ALLOW_LOCAL_SCOPE_RENDER !== '1') throw new Error('Model fetch/render is cloud-only by default; --validate-only is available locally');
  const html = readFileSync(join(ROOT, 'public/__render.html'), 'utf8'), script = readFileSync(join(ROOT, 'scripts/render-thumbnails.mjs'), 'utf8');
  const bindings = { batch: request.batch, sourceArtifacts: request.sourceArtifacts || [], html: reviewHtml(html), appearance: productionAppearanceFactory(script, json(join(ROOT, 'src/data/material-appearances.json')), json(join(ROOT, 'src/data/appearance-overrides.json')), new Map(catalog.map((r) => [r.slug, r]))), hashes: { productionHtmlSha256: sha256(html), productionThumbnailScriptSha256: sha256(script), productionTransformUtilsSha256: sha256(readFileSync(join(ROOT, 'public/model-render-utils.js'))), requestSha256: sha256(readFileSync(requestPath)) } };
  await renderBound(works, { out: resolve(values.out || '.atrium-ingest/vessel-scope-review'), work: resolve(values.work || '.atrium-ingest/vessel-scope-models'), sourceRoot: values['source-root'] ? resolve(values['source-root']) : undefined }, bindings);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // All model writes, browser shutdown and server cleanup are awaited by main.
  // Decoder/network runtimes may retain idle handles after that work is done.
  const finish = (code) => process.stderr.write('', () => process.stdout.write('', () => process.exit(code)));
  main().then(() => finish(process.exitCode || 0), (error) => {
    console.error(error.message);
    finish(1);
  });
}
