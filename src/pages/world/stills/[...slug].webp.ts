import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { worldCollection } from '../../../lib/world-collection.ts';
import viewerStills from '../../../data/viewer-stills.json' with { type: 'json' };
import { removeStudioMatte } from '../../../../scripts/lib/artwork-preview-matte.mjs';

export const prerender = true;

// Small, real stills for the place row. Source images, models and catalogue
// records remain unchanged; the largest first-screen images stay on Pages.
const thumbnails = new Map(worldCollection.works.map(work => {
  const source = new URL(work.thumbnail, 'https://atrium.earth');
  return [work.slug, source.origin === 'https://atrium.earth' ? source.pathname : null];
}));
const exactStills = new Set(viewerStills);

export function getStaticPaths() {
  return [...thumbnails.keys()].map(slug => ({ params: { slug } }));
}

export const GET: APIRoute = async ({ params }) => {
  const source = thumbnails.get(params.slug || '');
  if (!source || !/^\/previews\/renders\/(?:[a-z0-9_-]+\/)+thumb\.webp$/.test(source)) {
    return new Response(null, { status: 404 });
  }
  const exact = exactStills.has(params.slug || '');
  const sourcePath = exact ? `/images/viewer-stills/${params.slug}.webp` : source;
  // Endpoint code moves into dist/.prerender during the static build.
  const path = resolve('public', `.${sourcePath}`);
  const original = await readFile(path);
  let prepared = sharp(original);
  if (!exact && !(await prepared.metadata()).hasAlpha) {
    const { data, info } = await prepared.resize({ width: 720, withoutEnlargement: true })
      .toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
    const alpha = removeStudioMatte(data, info.width, info.height);
    prepared = alpha ? sharp(alpha, { raw: { width: info.width, height: info.height, channels: 4 } }) : sharp(original);
  }
  const image = await prepared
    .resize({ width: 320, height: 400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78, alphaQuality: 100, effort: 4 })
    .toBuffer();
  return new Response(new Uint8Array(image), {
    headers: { 'Content-Type': 'image/webp', 'Content-Length': String(image.length) },
  });
};
