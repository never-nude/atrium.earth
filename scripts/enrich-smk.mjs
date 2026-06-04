import { readFileSync, writeFileSync } from 'node:fs';

const catalogPath = 'src/data/catalog.json';
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

const materialLabels = new Map([
  ['Gips', 'Plaster'],
]);

const departmentLabels = new Map([
  ['Den Kongelige Afstøbningssamling', 'Royal Cast Collection'],
  ['Samling og Forskning (KAS)', 'Royal Cast Collection'],
]);

const dimensionLabels = new Map([
  ['højde', 'H'],
  ['bredde', 'W'],
  ['dybde', 'D'],
]);

function clean(value) {
  const text = String(value ?? '').trim();
  return text === '-' || text === '—' ? '' : text;
}

function objectNumber(sourceUrl) {
  const match = clean(sourceUrl).match(/\/([A-Z]+[0-9]+)$/i);
  return match?.[1] || '';
}

function publicArtist(item) {
  const creators = [
    ...(item.production || []).map((entry) => entry.creator),
    ...(item.artist || []),
  ]
    .map(clean)
    .filter(Boolean)
    .filter((name) => !/^(ubekendt|unknown)$/i.test(name))
    .filter((name) => !name.startsWith('...'));
  return creators[0] || '';
}

function ordinal(value) {
  const n = Number(value);
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function publicDate(item) {
  const notes = (item.original || []).flatMap((entry) => entry.production_date_notes || []).map(clean).filter(Boolean);
  const note = notes.find((value) => /\d/.test(value) && /f\.kr|århundrede|ca\.|[0-9]/i.test(value)) || '';
  if (!note) return '';

  const bceRange = note.match(/(\d{1,4})\s*[-–]\s*(\d{1,4})\s*f\.kr/i);
  if (bceRange) return `${bceRange[1]}–${bceRange[2]} BCE`;

  const bceApprox = note.match(/ca\.\s*(\d{1,4})\s*f\.kr/i);
  if (bceApprox) return `c. ${bceApprox[1]} BCE`;

  const bceCentury = note.match(/(\d{1,2})\.\s*århundrede\s*f\.kr/i);
  if (bceCentury) return `${ordinal(bceCentury[1])} century BCE`;

  const bceSingle = note.match(/(\d{1,4})\s*f\.kr/i);
  if (bceSingle) return `${bceSingle[1]} BCE`;

  return note.replace(/\s+/g, ' ');
}

function publicMaterials(item) {
  return [...new Set((item.materials || []).map((value) => materialLabels.get(value) || value).map(clean).filter(Boolean))].join(', ');
}

function publicDimensions(item) {
  const dims = (item.dimensions || [])
    .map((dimension) => {
      const label = dimensionLabels.get(clean(dimension.type)) || clean(dimension.type);
      const value = clean(dimension.value);
      const unit = clean(dimension.unit).toLowerCase() === 'centimeter' ? 'cm' : clean(dimension.unit);
      return label && value ? `${label} ${value}${unit ? ` ${unit}` : ''}` : '';
    })
    .filter(Boolean);
  return dims.join(' × ');
}

function publicMuseum(item) {
  const department = departmentLabels.get(clean(item.responsible_department)) || clean(item.responsible_department);
  const room = clean(item.current_location_name).replace(/^Sal\b/i, 'Room');
  if (room && department) return `${room}, ${department}`;
  return department;
}

function publicRights(item) {
  const rights = clean(item.rights);
  if (/creativecommons\.org\/publicdomain\/mark/i.test(rights)) return 'Public Domain Mark 1.0';
  return rights;
}

function rebuildSearch(record) {
  return [
    record.title,
    record.artist,
    record.year,
    record.material,
    record.dimensions,
    record.museum,
    record.source_institution,
    record.collection,
    record.note,
  ].map(clean).filter(Boolean).join(' ').toLowerCase();
}

let updated = 0;
for (const record of catalog) {
  const number = objectNumber(record.source_url);
  if (!number || !/^https?:\/\/open\.smk\.dk/i.test(clean(record.source_url))) continue;

  const response = await fetch(`https://api.smk.dk/api/v1/art/?object_number=${encodeURIComponent(number)}`);
  if (!response.ok) throw new Error(`SMK ${number} failed: ${response.status}`);
  const item = (await response.json()).items?.[0];
  if (!item) continue;

  const artist = publicArtist(item);
  const year = publicDate(item);
  const material = publicMaterials(item);
  const dimensions = publicDimensions(item);
  const museum = publicMuseum(item);
  const rights = publicRights(item);

  if (artist) record.artist = artist;
  if (year) record.year = year;
  if (material) record.material = material;
  if (dimensions) record.dimensions = dimensions;
  if (museum) record.museum = museum;
  if (rights) record.license = rights;
  record.search = rebuildSearch(record);
  updated += 1;
}

writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Updated ${updated} SMK-backed records`);
