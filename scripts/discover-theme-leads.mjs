#!/usr/bin/env node
// Themed lead discovery for a curated batch. Reads a request file (JSON) with
// search terms, searches Sketchfab (downloadable CC0 / CC BY / CC BY-SA) and
// Smithsonian 3D, optionally sweeps the full catalogue of institutional
// publishers that produced on-theme hits, and writes every hit in the saved
// candidate schema (atrium-auto-ingest-candidates/1) plus a reference
// thumbnail per hit. Nothing here is accepted automatically: the output is a
// review file that a curator narrows to a leads file for acquire-leads.yml.
//
//   SKETCHFAB_TOKEN=... node scripts/discover-theme-leads.mjs \
//     --request=docs/ingest/<batch>-discover.json --out=discovery
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  candidateIsKnown,
  catalogIndexes,
  clean,
  isAllowedLicense,
  licenseTier,
  loadCatalog,
  parseArgs,
  readJson,
  repoRoot,
  slugify,
  titleKey,
  writeJson,
} from './ingest-utils.mjs';

const args = parseArgs();
const requestPath = path.resolve(repoRoot, args.request || '');
const outDir = path.resolve(repoRoot, args.out || 'discovery');
const request = await readJson(requestPath);
if (!request) throw new Error(`request file not found: ${requestPath}`);

const token = process.env.SKETCHFAB_TOKEN || '';
const intervalMs = Number(process.env.SKETCHFAB_API_INTERVAL_MS || 1100);
const maxPages = Number(request.sketchfab_pages_per_query || 3);
const sweepLimit = Number(request.publisher_sweep_max_models || 1500);
const sketchfabLicenses = request.sketchfab_licenses || ['cc0', 'by', 'by-sa'];
const themeRe = new RegExp(request.theme_pattern, 'iu');
const negativeRe = request.negative_pattern ? new RegExp(request.negative_pattern, 'iu') : null;
const aiRe = /\b(ai[- ]generated|generated (?:with|by) ai|meshy|tripo(?:sr|3d)?|luma (?:ai|genie)|csm\.ai|rodin gen|hunyuan3d|text[- ]to[- ]3d|image[- ]to[- ]3d)\b/i;
const reconstructionRe = /\b(reconstruct|reconstruction|replica|reproduction|recreat|hypothetical|game[- ]ready|low[- ]?poly|3d print(?:able|ed)?|cad model|modell?ed in blender|stl for print)\b/i;
const scaleBarRe = /\b(scale bar|scalebar|colou?r (?:card|checker)|macbeth|x-?rite)\b/i;
const institutionRe = /museum|muzeum|museo|musée|musee|museu|muzej|university|universit|uniwersytet|college|institut|heritage|archive|archiv|library|biblio|gallery|galeria|collection|foundation|stiftung|academy|akadem|antiquit|archaeolog|archeolog|smithsonian|ministry|ministerio|council|department|centre|center|society|trust|digital|lab\b|project|national|state|gov|historic|kultur|cultur|scan the world|cyark|zamani/i;

const report = {
  generated_at: new Date().toISOString(),
  request: path.relative(repoRoot, requestPath),
  queries: {},
  sweeps: {},
  smithsonian: {},
  errors: [],
};

let lastRequest = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url, { sketchfab = false } = {}) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (sketchfab) {
      const gap = lastRequest + intervalMs - Date.now();
      if (gap > 0) await sleep(gap);
      lastRequest = Date.now();
    }
    const headers = { accept: 'application/json', 'user-agent': 'atrium-discovery/1.0 (+https://atrium.earth)' };
    if (sketchfab && token) headers.Authorization = `Token ${token}`;
    let response;
    try {
      response = await fetch(url, { headers });
    } catch (error) {
      if (attempt >= 5) throw error;
      await sleep(3000 * (attempt + 1));
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      const retry = Number(response.headers.get('retry-after'));
      const wait = Number.isFinite(retry) && retry > 0 ? retry * 1000 : 20000 * (attempt + 1);
      console.warn(`  ${response.status} for ${url}; waiting ${Math.round(wait / 1000)}s`);
      await sleep(Math.min(wait, 300000));
      continue;
    }
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
    return response.json();
  }
  throw new Error(`gave up after retries: ${url}`);
}

function pickThumbnail(model) {
  const images = (model.thumbnails?.images || []).filter((image) => image.url);
  if (!images.length) return '';
  const sorted = images.sort((a, b) => Math.abs((a.width || 0) - 640) - Math.abs((b.width || 0) - 640));
  return sorted[0].url;
}

function licenseFrom(model) {
  const slug = clean(model.license?.slug || '').toLowerCase();
  const label = clean(model.license?.label || model.license?.fullName || '');
  const map = {
    cc0: ['CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'],
    by: ['CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'],
    'by-sa': ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  };
  if (map[slug]) return { license: map[slug][0], license_url: map[slug][1], slug, label };
  return { license: label || slug, license_url: clean(model.license?.url || ''), slug, label };
}

function signals(text) {
  return {
    theme_terms: [...new Set((text.match(new RegExp(themeRe.source, 'giu')) || []).map((term) => term.toLowerCase()))],
    negative_terms: negativeRe ? [...new Set((text.match(new RegExp(negativeRe.source, 'giu')) || []).map((term) => term.toLowerCase()))] : [],
    ai_generated: aiRe.test(text),
    reconstruction_or_modelled: reconstructionRe.test(text),
    scale_bar_mentioned: scaleBarRe.test(text),
  };
}

const hits = new Map();

function recordSketchfab(model, via) {
  const uid = clean(model.uid);
  if (!uid) return;
  const existing = hits.get(`sketchfab:${uid}`);
  if (existing) {
    if (!existing.discovery.found_by.includes(via)) existing.discovery.found_by.push(via);
    return;
  }
  const lic = licenseFrom(model);
  const user = model.user || {};
  const publisher = clean(user.username);
  const publisherName = clean(user.displayName || publisher);
  const description = clean(model.description || '');
  const tags = (model.tags || []).map((tag) => clean(tag.name || tag.slug || tag)).filter(Boolean);
  const text = [model.name, description, tags.join(' ')].join(' \n ');
  const archives = model.archives || {};
  const archive = archives.glb || archives.gltf || archives.source || {};
  hits.set(`sketchfab:${uid}`, {
    source: 'sketchfab',
    archive: '',
    uid,
    slug: `${request.collection_hint || 'automated'}/${slugify(model.name).slice(0, 60)}-${uid.slice(0, 6)}`,
    collection: '',
    wing: '',
    title: clean(model.name),
    artist: '',
    culture: '',
    geography: '',
    subject: request.subject || '',
    year: '',
    year_sort: null,
    material: '',
    dimensions: '',
    measures: [],
    museum: '',
    displayed_at: '',
    current_location: '',
    original_location: '',
    source_institution: publisherName,
    source_url: clean(model.viewerUrl) || `https://sketchfab.com/3d-models/${uid}`,
    source_record_url: clean(model.viewerUrl) || `https://sketchfab.com/3d-models/${uid}`,
    related_source_record_urls: [],
    download_api_url: `https://api.sketchfab.com/v3/models/${uid}/download`,
    download_format: 'glb',
    download_size_bytes: Number(archive.size || 0),
    face_count: Number(archive.faceCount || model.faceCount || 0) || null,
    accession: '',
    license: lic.license,
    license_url: lic.license_url,
    license_tier: licenseTier(lic.license),
    license_evidence_url: `https://api.sketchfab.com/v3/models/${uid}`,
    scan_author: publisherName,
    attribution: `3D model “${clean(model.name)}” by ${publisherName} (${publisher}), via Sketchfab, licensed ${lic.license}.`,
    scan_source: 'Sketchfab downloadable model',
    note: '',
    source_description: description,
    reference_image_url: pickThumbnail(model),
    evidence: [],
    publisher,
    allow_componentized_mesh: true,
    max_component_count: 100000,
    published_at: clean(model.publishedAt),
    discovery: {
      found_by: [via],
      publisher_uid: clean(user.uid),
      publisher_account: clean(user.account),
      publisher_profile: clean(user.profileUrl),
      publisher_institutional: institutionRe.test(`${publisher} ${publisherName}`),
      license_observed: { slug: lic.slug, label: lic.label, observed_at: new Date().toISOString(), downloadable: model.isDownloadable !== false },
      tags,
      categories: (model.categories || []).map((category) => clean(category.name || category.slug)).filter(Boolean),
      like_count: model.likeCount ?? null,
      view_count: model.viewCount ?? null,
      ...signals(text),
    },
  });
}

async function sketchfabSearch(query) {
  const counts = {};
  for (const license of sketchfabLicenses) {
    let url = new URL('https://api.sketchfab.com/v3/search');
    url.searchParams.set('type', 'models');
    url.searchParams.set('downloadable', 'true');
    url.searchParams.set('license', license);
    url.searchParams.set('q', query);
    url.searchParams.set('count', '24');
    url = url.toString();
    let seen = 0;
    for (let page = 0; url && page < maxPages; page += 1) {
      let payload;
      try {
        payload = await getJson(url, { sketchfab: true });
      } catch (error) {
        report.errors.push({ source: 'sketchfab', query, license, reason: error.message });
        break;
      }
      for (const model of payload.results || []) {
        recordSketchfab(model, `search:${query}`);
        seen += 1;
      }
      url = payload.next || '';
    }
    counts[license] = seen;
  }
  report.queries[query] = counts;
  console.log(`search "${query}": ${JSON.stringify(counts)}`);
}

async function sketchfabSweep(publisher) {
  // All downloadable models from one publisher; kept only when on-theme.
  let url = `https://api.sketchfab.com/v3/models?user=${encodeURIComponent(publisher.uid)}&downloadable=true&count=24&sort_by=-publishedAt`;
  let scanned = 0;
  let kept = 0;
  while (url && scanned < sweepLimit) {
    let payload;
    try {
      payload = await getJson(url, { sketchfab: true });
    } catch (error) {
      report.errors.push({ source: 'sketchfab-sweep', publisher: publisher.username, reason: error.message });
      break;
    }
    for (const model of payload.results || []) {
      scanned += 1;
      const text = [model.name, model.description, (model.tags || []).map((tag) => tag.name || tag.slug).join(' ')].join(' ');
      if (!themeRe.test(text)) continue;
      // List results may omit the licence; the detail fetch settles it later.
      const lic = licenseFrom(model);
      if (lic.slug && !['cc0', 'by', 'by-sa'].includes(lic.slug)) continue;
      recordSketchfab(model, `sweep:${publisher.username}`);
      kept += 1;
    }
    url = payload.next || '';
  }
  report.sweeps[publisher.username] = { scanned, kept };
  console.log(`sweep ${publisher.username}: scanned ${scanned}, on-theme ${kept}`);
}

async function enrichSketchfab(hit) {
  // The detail record is the licence evidence: it carries the full
  // description and the licence as Sketchfab states it today.
  try {
    const model = await getJson(hit.license_evidence_url, { sketchfab: true });
    const lic = licenseFrom(model);
    hit.license = lic.license;
    hit.license_url = lic.license_url;
    hit.license_tier = licenseTier(lic.license);
    hit.discovery.license_observed = { slug: lic.slug, label: lic.label, observed_at: new Date().toISOString(), downloadable: model.isDownloadable !== false, source: 'model detail API' };
    hit.source_description = clean(model.description || hit.source_description);
    const archives = model.archives || {};
    const archive = archives.glb || archives.gltf || archives.source || {};
    hit.download_size_bytes = Number(archive.size || hit.download_size_bytes || 0);
    hit.face_count = Number(archive.faceCount || model.faceCount || hit.face_count || 0) || null;
    hit.discovery.archives = Object.fromEntries(Object.entries(archives).map(([key, value]) => [key, { size: value?.size ?? null, faceCount: value?.faceCount ?? null, textureCount: value?.textureCount ?? null }]));
    hit.discovery.categories = (model.categories || []).map((category) => clean(category.name || category.slug)).filter(Boolean);
    Object.assign(hit.discovery, signals([hit.title, hit.source_description, hit.discovery.tags.join(' ')].join(' \n ')));
    if (!hit.reference_image_url) hit.reference_image_url = pickThumbnail(model);
  } catch (error) {
    hit.discovery.enrich_error = error.message;
  }
}

async function smithsonianSearch(query) {
  const counts = {};
  for (const quality of ['Medium', 'High']) {
    const url = `https://3d-api.si.edu/api/v1.0/content/file/search?q=${encodeURIComponent(query)}&file_type=glb&file_quality=${quality}&rows=100`;
    let payload;
    try {
      payload = await getJson(url);
    } catch (error) {
      report.errors.push({ source: 'smithsonian', query, quality, reason: error.message });
      continue;
    }
    counts[quality] = (payload.rows || []).length;
    for (const row of payload.rows || []) {
      const modelUrl = clean(row.content?.model_url || row.url);
      const uri = clean(row.content?.uri);
      const title = clean(row.title);
      if (!modelUrl || !uri) continue;
      const key = `smithsonian:${modelUrl}`;
      const existing = hits.get(key);
      if (existing) {
        if (!existing.discovery.found_by.includes(`smithsonian:${query}`)) existing.discovery.found_by.push(`smithsonian:${query}`);
        if (quality === 'Medium') existing.download_url = uri;
        continue;
      }
      const uuid = modelUrl.split(':').pop();
      hits.set(key, {
        source: 'smithsonian',
        archive: '',
        uid: uuid,
        slug: `${request.collection_hint || 'automated'}/${slugify(title).slice(0, 60)}-si-${uuid.slice(0, 6)}`,
        collection: '',
        wing: '',
        title,
        artist: '',
        culture: '',
        geography: '',
        subject: request.subject || '',
        year: '',
        year_sort: null,
        material: '',
        dimensions: '',
        measures: [],
        museum: 'Smithsonian Institution',
        displayed_at: '',
        current_location: '',
        original_location: '',
        source_institution: 'Smithsonian 3D',
        source_url: `https://3d.si.edu/object/3d/${encodeURIComponent(`${slugify(title)}:${uuid}`)}`,
        source_record_url: modelUrl,
        related_source_record_urls: [],
        download_url: uri,
        download_format: 'glb',
        download_size_bytes: 0,
        face_count: null,
        accession: '',
        license: 'CC0 1.0',
        license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
        license_tier: 1,
        license_evidence_url: 'https://www.si.edu/openaccess',
        scan_author: 'Smithsonian 3D',
        attribution: 'Smithsonian Institution (Open Access, CC0)',
        scan_source: clean(row.content?.usage || 'Smithsonian Open Access'),
        note: '',
        source_description: '',
        reference_image_url: '',
        evidence: [],
        publisher: 'smithsonian',
        allow_componentized_mesh: true,
        max_component_count: 100000,
        published_at: '',
        compressed: row.content?.draco_compressed === true || row.content?.draco_compressed === 'true',
        discovery: {
          found_by: [`smithsonian:${query}`],
          publisher_institutional: true,
          smithsonian_row: row,
          license_observed: { label: clean(row.content?.usage), observed_at: new Date().toISOString(), source: '3d-api.si.edu file search' },
          tags: [],
          ...signals(title),
        },
      });
    }
  }
  report.smithsonian[query] = counts;
  console.log(`smithsonian "${query}": ${JSON.stringify(counts)}`);
}

// 1. Searches.
for (const query of request.smithsonian_queries || request.queries || []) await smithsonianSearch(query);
if (!token) report.errors.push({ source: 'sketchfab', reason: 'SKETCHFAB_TOKEN not set; searching anonymously' });
for (const query of request.queries || []) await sketchfabSearch(query);

// 2. Publisher sweeps: explicit publishers, plus institutional publishers with on-theme hits.
const sweepTargets = new Map();
for (const username of request.sweep_publishers || []) sweepTargets.set(username.toLowerCase(), { username, uid: '' });
if (request.sweep_institutional_hit_publishers) {
  for (const hit of hits.values()) {
    if (hit.source !== 'sketchfab' || !hit.discovery.publisher_institutional || !hit.discovery.theme_terms.length) continue;
    sweepTargets.set(hit.publisher.toLowerCase(), { username: hit.publisher, uid: hit.discovery.publisher_uid });
  }
}
for (const target of sweepTargets.values()) {
  if (!target.uid) {
    try {
      const users = await getJson(`https://api.sketchfab.com/v3/search?type=users&q=${encodeURIComponent(target.username)}&count=24`, { sketchfab: true });
      const match = (users.results || []).find((user) => clean(user.username).toLowerCase() === target.username.toLowerCase());
      if (!match) {
        report.errors.push({ source: 'sketchfab-sweep', publisher: target.username, reason: 'user not found' });
        continue;
      }
      target.uid = match.uid;
    } catch (error) {
      report.errors.push({ source: 'sketchfab-sweep', publisher: target.username, reason: error.message });
      continue;
    }
  }
  await sketchfabSweep(target);
}

// 3. Keep on-theme hits, enrich them from the model detail API (the licence
// evidence), then keep allowed licences and mark works already catalogued.
const catalog = await loadCatalog();
const indexes = catalogIndexes(catalog);
const excluded = { license: 0, off_theme: 0 };
const onTheme = [];
for (const hit of hits.values()) {
  const keepOffTheme = (request.keep_off_theme_for || []).some((prefix) => hit.discovery.found_by.some((via) => via.startsWith(prefix)));
  if (!hit.discovery.theme_terms.length && !keepOffTheme) {
    excluded.off_theme += 1;
    continue;
  }
  onTheme.push(hit);
}
console.log(`Enriching ${onTheme.filter((hit) => hit.source === 'sketchfab').length} Sketchfab hits.`);
for (const hit of onTheme) if (hit.source === 'sketchfab') await enrichSketchfab(hit);
const candidates = [];
for (const hit of onTheme) {
  if (!isAllowedLicense(`${hit.license} ${hit.license_url}`)) {
    excluded.license += 1;
    continue;
  }
  hit.discovery.already_in_catalog = candidateIsKnown(hit, indexes) || '';
  hit.title_key = titleKey(hit.title);
  candidates.push(hit);
}

// 4. Reference thumbnails for review.
await mkdir(path.join(outDir, 'thumbs'), { recursive: true });
for (const hit of candidates) {
  if (!hit.reference_image_url) continue;
  try {
    const response = await fetch(hit.reference_image_url, { headers: { 'user-agent': 'atrium-discovery/1.0' } });
    if (!response.ok) throw new Error(`${response.status}`);
    const file = `thumbs/${hit.source}-${slugify(hit.uid)}.jpg`;
    await writeFile(path.join(outDir, file), Buffer.from(await response.arrayBuffer()));
    hit.discovery.reference_image_file = file;
  } catch (error) {
    hit.discovery.reference_image_error = error.message;
  }
}

candidates.sort((a, b) => Number(b.discovery.publisher_institutional) - Number(a.discovery.publisher_institutional)
  || b.discovery.theme_terms.length - a.discovery.theme_terms.length
  || a.title.localeCompare(b.title));

report.totals = { hits: hits.size, kept: candidates.length, excluded };
await writeJson(path.join(outDir, 'discovery.json'), {
  schema: 'atrium-auto-ingest-candidates/1',
  generated_at: report.generated_at,
  note: `Unreviewed discovery hits for ${request.batch}. Narrow to a leads file before fetching.`,
  candidates,
  report,
});
console.log(`Kept ${candidates.length} of ${hits.size} hits (${JSON.stringify(excluded)}).`);
