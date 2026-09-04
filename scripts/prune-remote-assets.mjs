#!/usr/bin/env node
// Preview GLBs live in public/ so the thumbnail renderer and verify:assets can read
// them from disk, but they are served to visitors from R2 (models.atrium.earth) and
// must not be published. Astro copies all of public/ into dist/, so drop them here.
// Without this the Pages artifact carries ~1.2 GB of models nobody fetches from it.
import { rm, stat } from 'node:fs/promises';
import path from 'node:path';

const target = path.resolve('dist/models/previews');
try {
  const before = await stat(target);
  if (before.isDirectory()) {
    await rm(target, { recursive: true, force: true });
    console.log('Pruned dist/models/previews (served from R2).');
  }
} catch {
  console.log('No dist/models/previews to prune.');
}
