import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/catalog.json'), 'utf8'));
const locations = JSON.parse(fs.readFileSync(path.join(root, 'src/data/object-locations.json'), 'utf8'));
const publicWorks = catalog.filter((work) => !work.hidden);
const records = locations.works || {};
const slugs = new Set(publicWorks.map((work) => work.slug));
const problems = [];
const allowedCurrentTypes = new Set(['display', 'holding', 'not_on_view', 'undocumented']);

if (locations.schema !== 'atrium-object-locations/1') problems.push('Unexpected location-data schema.');
if (!/^\d{4}-\d{2}-\d{2}$/.test(String(locations.as_of || ''))) problems.push('Location data needs an ISO as_of date.');

for (const key of Object.keys(records)) {
  if (!slugs.has(key)) problems.push(`Stale location slug: ${key}`);
}

for (const work of publicWorks) {
  const record = records[work.slug];
  if (!record) {
    problems.push(`Missing location record: ${work.slug}`);
    continue;
  }
  const current = String(record.current || '').trim();
  const origin = String(record.origin || '').trim();
  if (!current) problems.push(`Missing current location: ${work.slug}`);
  if (!allowedCurrentTypes.has(String(record.current_type || ''))) {
    problems.push(`Invalid current_type for ${work.slug}: ${record.current_type || '(blank)'}`);
  }
  if (origin && !String(record.origin_type || '').trim()) {
    problems.push(`Origin has no semantic type: ${work.slug}`);
  }
  if (origin && current && origin.toLowerCase() === current.toLowerCase()) {
    problems.push(`Origin repeats current location: ${work.slug}`);
  }
  if (record.source_url && !/^https:\/\//.test(String(record.source_url))) {
    problems.push(`Location source is not HTTPS: ${work.slug}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(record.checked || ''))) {
    problems.push(`Location record needs an ISO checked date: ${work.slug}`);
  }
}

const originCount = Object.values(records).filter((record) => String(record.origin || '').trim()).length;
const displayCount = Object.values(records).filter((record) => record.current_type === 'display').length;
const holdingCount = Object.values(records).filter((record) => record.current_type === 'holding').length;
const notOnViewCount = Object.values(records).filter((record) => record.current_type === 'not_on_view').length;
const undocumentedCount = Object.values(records).filter((record) => record.current_type === 'undocumented').length;
console.log(`locations=${Object.keys(records).length}; origins=${originCount}; display=${displayCount}; holding=${holdingCount}; notOnView=${notOnViewCount}; undocumented=${undocumentedCount}; asOf=${locations.as_of}`);

if (problems.length) {
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log('Every public work has a typed, dated current-location record; every documented origin has a semantic type.');
}
