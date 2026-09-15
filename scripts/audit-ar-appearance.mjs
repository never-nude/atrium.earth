import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { prepareQuickLookMaterial, quickLookDiffuseGain, AR_DIFFUSE_CEILING } from '../src/lib/spatial-appearance.mjs';

// Catalogue/profile audit, not a claim to have visually inspected remote scans.
const root = new URL('../dist/works/', import.meta.url);
const decode = value => value.replace(/&#34;/g, '"').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const works = [];
const profiles = {};
for (const path of (await readdir(root, { recursive: true })).filter(p => p.endsWith('/index.html')).sort()) {
  const html = await readFile(new URL(path, root), 'utf8');
  const match = html.match(/data-material-appearance="([^"]+)"/);
  if (!match) continue;
  const appearance = JSON.parse(decode(match[1]));
  const material = new THREE.MeshStandardMaterial({ color: appearance.baseColor, roughness: appearance.roughness, metalness: appearance.metalness });
  const before = material.color.clone();
  const native = prepareQuickLookMaterial(material);
  const obsolete = prepareQuickLookMaterial(material, appearance.exposure);
  assert.ok(native.color.equals(obsolete.color), `${path}: independent of page exposure`);
  assert.ok(material.color.equals(before), `${path}: page unchanged`);
  assert.equal(native.roughness, material.roughness);
  assert.equal(native.metalness, material.metalness);
  for (const channel of ['r', 'g', 'b']) assert.ok(Number.isFinite(native.color[channel]) && native.color[channel] >= 0);
  // Exercise generated vertex tint ranges using this work's actual resolved
  // palette/variation. This cannot determine whether a remote mesh has textures.
  for (const mix of [0, 0.5, 1]) {
    const tint = before.clone().lerp(new THREE.Color(appearance.secondaryColor), mix);
    const gain = quickLookDiffuseGain(tint.r, tint.g, tint.b, material);
    assert.ok(gain > 0 && gain <= 1);
    if (Math.max(tint.r, tint.g, tint.b) <= AR_DIFFUSE_CEILING || material.metalness > 0.1) assert.equal(gain, 1);
  }
  profiles[appearance.key] = (profiles[appearance.key] || 0) + 1;
  works.push({ slug: path.replace(/\/index.html$/, ''), profile: appearance.key, pageExposureIgnored: appearance.exposure, arPolicy: 'source colors; untextured dielectric peak ceiling 0.8; no exposure transfer' });
  native.dispose(); obsolete.dispose(); material.dispose();
}
assert.ok(works.length > 1000, 'Full built catalogue is required');
assert.ok(works.some(w => w.slug.includes('venus-of-willendorf')));
assert.ok(works.some(w => w.slug === 'rodin/the-thinker'));
// Edge cases beyond the catalogue palettes: white STL, dark stone, metals,
// textured scans and emission must not inherit arbitrary page exposure.
for (const [color, metalness, mapped] of [[0xffffff, 0, false], [0x303030, 0, false], [0xffffff, 1, false], [0xffffff, 0, true]]) {
  const source = new THREE.MeshStandardMaterial({ color, metalness });
  if (mapped) source.map = new THREE.Texture();
  const copy = prepareQuickLookMaterial(source, 0.01);
  const expected = color === 0xffffff && !metalness && !mapped ? 0.8 : source.color.r;
  assert.ok(Math.abs(copy.color.r - expected) < 1e-10);
  assert.equal(copy.map, source.map);
  source.map?.dispose(); source.dispose(); copy.dispose();
}
const report = { scope: 'All generated work-page appearance configurations; remote texture pixels and native iPhone lighting not visually validated', count: works.length, profiles, works };
await writeFile(new URL('../docs/ar-appearance-audit.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(`AR appearance audit passed: ${works.length} work pages, ${Object.keys(profiles).length} profiles.`, profiles);
