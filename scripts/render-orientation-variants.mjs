#!/usr/bin/env node
// Render each requested work in several candidate orientations and compose one
// labelled review sheet per work, so orientation can be chosen by eye on a
// machine that cannot run WebGL itself.
//
//   node scripts/render-orientation-variants.mjs --input=slugs.txt --out=docs/ingest/<batch>-orientation-review
//
// Variant A is the work's current transform; B–G stand each axis of the source
// mesh upright (upAxis "y" plus a quarter or half turn); H–J keep the current
// transform and turn the work 90°, 180° and 270° about the vertical axis.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { parseArgs, readJson, repoRoot, orientationsPath } from './ingest-utils.mjs';

const args = parseArgs();
const outDir = path.resolve(repoRoot, args.out || 'docs/ingest/orientation-review');
const workDir = path.resolve(repoRoot, args.work || '.atrium-ingest/orientation-variants');
const listed = args.slugs ? String(args.slugs).split(',') : [];
if (args.input) listed.push(...readFileSync(path.resolve(repoRoot, args.input), 'utf8').split(/\r?\n/));
const slugs = [...new Set(listed.map((slug) => slug.trim()).filter(Boolean))];
if (!slugs.length) {
  console.log('No works requested for orientation review.');
  process.exit(0);
}

const orientations = await readJson(orientationsPath, {});
const variants = [
  { key: 'A', label: 'current', transform: (slug) => orientations[slug] || 'auto' },
  { key: 'B', label: '+Y up', transform: () => ({ upAxis: 'y', modelRotation: [0, 0, 0], yaw: 0 }) },
  { key: 'C', label: '-Y up', transform: () => ({ upAxis: 'y', modelRotation: [180, 0, 0], yaw: 0 }) },
  { key: 'D', label: '+Z up', transform: () => ({ upAxis: 'y', modelRotation: [-90, 0, 0], yaw: 0 }) },
  { key: 'E', label: '-Z up', transform: () => ({ upAxis: 'y', modelRotation: [90, 0, 0], yaw: 0 }) },
  { key: 'F', label: '+X up', transform: () => ({ upAxis: 'y', modelRotation: [0, 0, 90], yaw: 0 }) },
  { key: 'G', label: '-X up', transform: () => ({ upAxis: 'y', modelRotation: [0, 0, -90], yaw: 0 }) },
  ...[90, 180, 270].map((turn, index) => ({
    key: 'HIJ'[index],
    label: `current, turned ${turn}°`,
    transform: (slug) => {
      const current = orientations[slug];
      const base = current && typeof current === 'object' ? current : { upAxis: typeof current === 'string' ? current : 'auto' };
      return { ...base, yaw: (Number(base.yaw) || 0) + turn };
    },
  })),
];

rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });
for (const [variantIndex, variant] of variants.entries()) {
  const overrides = Object.fromEntries(slugs.map((slug) => [slug, variant.transform(slug)]));
  const overridesFile = path.join(workDir, `${variant.key}.json`);
  writeFileSync(overridesFile, JSON.stringify(overrides));
  console.log(`Rendering orientation variant ${variant.key} (${variantIndex + 1}/${variants.length})…`);
  const result = spawnSync(process.execPath, ['scripts/render-thumbnails.mjs'], {
    cwd: repoRoot,
    stdio: 'inherit',
    timeout: 20 * 60 * 1000,
    killSignal: 'SIGKILL',
    env: {
      ...process.env,
      ONLY: slugs.join(','),
      RENDER_TRANSFORMS_JSON: overridesFile,
      RENDER_OUT_DIR: path.join(workDir, variant.key),
      // A prior Chromium process can briefly keep its debug profile or HTTP
      // listener alive. Isolate every pass so one stale resource cannot leave
      // the synchronous review driver waiting forever before its first render.
      RENDER_PORT: String(8200 + variantIndex),
      CHROME_PROFILE_DIR: path.join(workDir, `chrome-${variant.key}`),
    },
  });
  if (result.error) console.warn(`Variant ${variant.key} failed to launch or timed out: ${result.error.message}`);
  if (result.status !== 0) console.warn(`Variant ${variant.key} finished with status ${result.status}; composing what rendered.`);
}

const cell = { width: 320, height: 400 };
const labelHeight = 34;
mkdirSync(outDir, { recursive: true });
let sheets = 0;
for (const slug of slugs) {
  const tiles = [];
  for (const [index, variant] of variants.entries()) {
    const file = path.join(workDir, variant.key, slug, 'thumb.webp');
    const image = existsSync(file)
      ? await sharp(file).resize(cell.width, cell.height).toBuffer()
      : await sharp({ create: { width: cell.width, height: cell.height, channels: 3, background: '#301010' } }).png().toBuffer();
    const label = Buffer.from(`<svg width="${cell.width}" height="${labelHeight}"><rect width="100%" height="100%" fill="#111"/><text x="10" y="23" font-family="sans-serif" font-size="18" fill="#eee">${variant.key} · ${variant.label}${existsSync(file) ? '' : ' (failed)'}</text></svg>`);
    tiles.push({ input: image, left: index * cell.width, top: 0 }, { input: label, left: index * cell.width, top: cell.height });
  }
  const target = path.join(outDir, `${slug.replace(/\//g, '__')}.webp`);
  await sharp({ create: { width: cell.width * variants.length, height: cell.height + labelHeight, channels: 3, background: '#111' } })
    .composite(tiles)
    .webp({ quality: 80 })
    .toFile(target);
  sheets += 1;
}
console.log(`Wrote ${sheets} orientation review sheet(s) to ${path.relative(repoRoot, outDir)}`);
