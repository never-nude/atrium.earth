import { strFromU8, strToU8, zipSync } from 'three/examples/jsm/libs/fflate.module.js';

// displayColor is only a geometry primvar; explicitly connect it to the bound
// USD surface shader. Geometry already contains vertex tint × material × exposure.
export function finishQuickLookAppearance(bytes, scene) {
  const materials = new Set();
  scene.traverse(object => {
    if (object.isMesh && object.material?.userData.atriumDisplayColor) materials.add(object.material.id);
  });
  if (!materials.size) return bytes;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = {};
  let offset = 0;
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    if (view.getUint16(offset + 8, true) || (view.getUint16(offset + 6, true) & 8)) throw new Error('Unsupported USDZ archive');
    const length = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true);
    const start = offset + 30 + nameLength + view.getUint16(offset + 28, true);
    if (start + length > bytes.length) throw new Error('Incomplete USDZ archive');
    const name = strFromU8(bytes.subarray(offset + 30, offset + 30 + nameLength));
    files[name] = bytes.subarray(start, start + length);
    offset = start + length;
  }
  if (!files['model.usda']) throw new Error('Missing USDZ scene');
  let text = strFromU8(files['model.usda']);
  for (const id of materials) {
    const start = text.indexOf(`def Material "Material_${id}"`);
    if (start < 0) throw new Error('Missing artwork material');
    const opening = text.indexOf('{', start);
    let end = opening + 1, depth = 1;
    while (end < text.length && depth) {
      if (text[end] === '{') depth++;
      if (text[end] === '}') depth--;
      end++;
    }
    if (depth) throw new Error('Incomplete artwork material');
    const body = text.slice(start, end);
    const diffuse = /color3f inputs:diffuseColor = \([^\n]+\)/;
    if (!diffuse.test(body)) throw new Error('Missing artwork color');
    const connected = body.replace(diffuse,
      `color3f inputs:diffuseColor.connect = </Materials/Material_${id}/AtriumVertexColor.outputs:result>`);
    const reader = `\n        def Shader "AtriumVertexColor" {\n            uniform token info:id = "UsdPrimvarReader_float3"\n            string inputs:varname = "displayColor"\n            float3 inputs:fallback = (1, 1, 1)\n            float3 outputs:result\n        }\n`;
    text = text.slice(0, start) + connected.slice(0, -1) + reader + '}' + text.slice(end);
  }
  files['model.usda'] = strToU8(text);
  // USDZ entries are uncompressed and each payload starts on a 64-byte boundary.
  offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const header = offset + 30 + strToU8(name).length;
    const padding = (64 - ((header + 4) % 64)) % 64;
    files[name] = [data, { extra: { 12345: new Uint8Array(padding) } }];
    offset = header + 4 + padding + data.length;
  }
  return zipSync(files, { level: 0 });
}
