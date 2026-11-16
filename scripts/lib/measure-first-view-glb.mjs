import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';
import sharp from 'sharp';

const KTX2 = Buffer.from('ab4b5458203230bb0d0a1a0a', 'hex');

async function readExact(file, size, offset) {
  const bytes = Buffer.allocUnsafe(size);
  let end = 0;
  while (end < size) {
    const { bytesRead } = await file.read(bytes, end, size - end, offset + end);
    if (!bytesRead) throw Error('Unexpected end of GLB');
    end += bytesRead;
  }
  return bytes;
}

function countScene(json) {
  const tally = { triangles: 0, primitives: 0, vertices: 0 };
  const attributes = new Set();
  const materialIndices = new Set();
  function walk(index, ancestors) {
    if (ancestors.has(index)) throw Error('Invalid GLB: repeated node within a scene branch');
    const node = json.nodes[index];
    if (node.mesh != null) {
      const instances = Object.values(node.extensions?.EXT_mesh_gpu_instancing?.attributes || {});
      const multiplier = instances.length ? json.accessors[instances[0]].count : 1;
      for (const primitive of json.meshes[node.mesh].primitives) {
        const vertices = json.accessors[primitive.attributes.POSITION].count;
        const indices = primitive.indices == null ? vertices : json.accessors[primitive.indices].count;
        const mode = primitive.mode ?? 4;
        if (mode === 4) tally.triangles += Math.floor(indices / 3) * multiplier;
        if (mode === 5 || mode === 6) tally.triangles += Math.max(0, indices - 2) * multiplier;
        tally.primitives += multiplier;
        tally.vertices += vertices * multiplier;
        Object.keys(primitive.attributes).forEach(attribute => attributes.add(attribute));
        if (primitive.material !== undefined) materialIndices.add(primitive.material);
      }
    }
    const branch = new Set(ancestors).add(index);
    for (const child of node.children ?? []) walk(child, branch);
  }
  const scene = json.scenes?.[json.scene ?? 0];
  if (!scene?.nodes?.length) throw Error('No default model scene');
  for (const index of scene.nodes) walk(index, new Set());
  if (!tally.triangles) throw Error('No triangles in default model scene');
  const materialProperties = [];
  function noteSlots(root, parts = []) {
    if (!root || typeof root !== 'object') return;
    for (const [name, value] of Object.entries(root)) {
      if (name.endsWith('Texture') && value && Number.isInteger(value.index)) materialProperties.push([...parts, name].join('.'));
      else if (name !== 'extras') noteSlots(value, [...parts, name]);
    }
  }
  for (const index of materialIndices) noteSlots(json.materials[index]);
  return {
    ...tally,
    attributes: [...attributes].sort(),
    materialCount: materialIndices.size,
    textureSlots: [...new Set(materialProperties)].sort(),
  };
}

export async function measureGlb(path, { fingerprint = true } = {}) {
  const file = await open(path);
  let info;
  try {
    const { size } = await file.stat();
    const header = await readExact(file, 20, 0);
    const textBytes = header.readUInt32LE(12);
    if (header.toString('ascii', 0, 4) !== 'glTF' || header.readUInt32LE(4) !== 2
        || header.readUInt32LE(8) !== size || header.toString('ascii', 16, 20) !== 'JSON'
        || textBytes > size - 20) throw Error('Invalid GLB header');
    const json = JSON.parse((await readExact(file, textBytes, 20)).toString('utf8'));
    const binaryHeader = await readExact(file, 8, 20 + textBytes);
    if (binaryHeader.readUInt32LE(4) !== 0x004e4942) throw Error('Expected embedded GLB buffer');
    const textures = [];
    for (const [index, image] of (json.images ?? []).entries()) {
      let buffer;
      if (Number.isInteger(image.bufferView)) {
        const view = json.bufferViews[image.bufferView];
        if (view.buffer !== 0) throw Error('Image uses an external buffer');
        buffer = await readExact(file, view.byteLength, 28 + textBytes + (view.byteOffset ?? 0));
      } else if (image.uri?.startsWith('data:') && image.uri.includes(';base64,')) {
        buffer = Buffer.from(image.uri.split(';base64,')[1], 'base64');
      } else {
        throw Error('Cannot verify dimensions of an external texture');
      }
      const { width, height, format } = buffer.subarray(0, 12).equals(KTX2)
        ? { width: buffer.readUInt32LE(20), height: buffer.readUInt32LE(24), format: 'ktx2' }
        : await sharp(buffer).metadata();
      if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) {
        throw Error(`Unknown dimensions for image ${index}`);
      }
      textures.push({ index, width, height, bytes: buffer.length, format,
        sha256: createHash('sha256').update(buffer).digest('hex') });
    }
    const largest = [...textures].sort((a, b) =>
      Math.max(b.width, b.height) - Math.max(a.width, a.height) || b.width * b.height - a.width * a.height)[0];
    info = {
      bytes: size,
      ...countScene(json),
      textureCount: textures.length,
      largestTexture: largest ? { width: largest.width, height: largest.height } : null,
      textures,
      extensions: json.extensionsUsed || [],
    };
  } finally {
    await file.close();
  }
  if (fingerprint) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    info.sha256 = hash.digest('hex');
  }
  return info;
}
