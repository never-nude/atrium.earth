// Estimates use existing catalogue evidence without changing the strict,
// fingerprinted verification decisions in spatial-eligibility.mjs.
const units = { mm: .001, cm: .01, m: 1, in: .0254, ft: .3048 };
const axisNames = { h: 'height', height: 'height', w: 'width', width: 'width',
  d: 'depth', depth: 'depth', l: 'length', length: 'length', t: 'thickness',
  thickness: 'thickness', diameter: 'diameter', diam: 'diameter' };
const number = '(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|(?:\\d+(?:[.,]\\d+)?|[.,]\\d+))';
const unit = '(mm|cm|metres?|meters?|m|inches|inch|in\\.?|feet|foot|ft\\.?)(?![a-z])';
const axis = '(height|width|depth|length|thickness|diameter|diam|h|w|d|l|t)';
const qualifiers = '(?:[\\s.:]*(?:approximately|approx\\.?|about|circa|c\\.|~|≈))*[\\s.:]*';
const numeric = value => {
  const parts = value.trim().replace(',', '.').split(/\s+/);
  return parts.reduce((sum, part) => sum + (part.includes('/')
    ? Number(part.split('/')[0]) / Number(part.split('/')[1]) : Number(part)), 0);
};
const canonicalUnit = value => /^(?:met|m$)/.test(value) ? 'm'
  : /^(?:in)/.test(value) ? 'in' : /^(?:f)/.test(value) ? 'ft' : value;
const valid = measure => measure && Number.isFinite(measure.meters) && measure.meters > 0;

export function parseDimensionText(value, { description = false } = {}) {
  if (typeof value !== 'string' || /mesh bounds|source units|variable digital scale/i.test(value)) return [];
  const text = value.toLowerCase().replace(/[×✕]/g, 'x').replace(/\s[.,](?=\d)/g, ' 0.')
    .replace(/[½¼¾⅛⅜⅝⅞]/g, v => ` ${{'½':'1/2','¼':'1/4','¾':'3/4','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'}[v]}`);
  const result = [];
  const add = (label, value, unitName, evidence) => {
    const normalizedUnit = canonicalUnit(unitName);
    const measure = { axis: axisNames[label] || label, value: numeric(value), unit: normalizedUnit,
      meters: numeric(value) * units[normalizedUnit], sourceText: evidence };
    if (valid(measure)) result.push(measure);
  };
  // Parse axis headers before individual labels, otherwise the final "D:"
  // would incorrectly claim the first number in "H x W x D: 8 x 1 x 3/4 in".
  const headed = text.match(new RegExp(`\\b(${axis}(?:\\s*x\\s*${axis})+)(?:\\s*\\([^)]*\\))?\\s*:\\s*(${number}(?:\\s*x\\s*${number})+)\\s*${unit}`));
  if (headed) {
    const labels = headed[1].split(/\s*x\s*/);
    const values = headed.at(-2).split(/\s*x\s*/);
    values.forEach((value, i) => add(labels[i] || 'unlabelled', value, headed.at(-1), headed[0]));
    return result;
  }
  // Explicit labels, including a shared final unit: H 80 x W 60 x D 20 cm.
  for (const match of text.matchAll(new RegExp(`\\b${axis}${qualifiers}(${number})\\s*`, 'g'))) {
    const tail = text.slice(match.index + match[0].length);
    const direct = tail.match(new RegExp(`^${unit}`));
    const shared = tail.match(new RegExp(`^(?:\\s*x\\s*(?:${axis}[\\s.:]*)?${number}\\s*)+${unit}`));
    const unitName = direct?.[1] || shared?.at(-1);
    if (unitName) add(match[1], match[2], unitName, match[0] + (direct?.[0] || shared[0]));
  }
  // Prose such as "approximately 3.5 m high" and "22-foot high".
  for (const match of text.matchAll(new RegExp(`(${number})[\\s-]*${unit}[\\s-]+(high|tall|wide|long|deep)\\b`, 'g'))) {
    add({ high:'height', tall:'height', wide:'width', long:'length', deep:'depth' }[match[3]], match[1], match[2], match[0]);
  }
  if (result.length) return result;
  const mixed = text.match(new RegExp(`(${number}\\s*${unit}(?:\\s*x\\s*${number}\\s*${unit})+)`));
  if (mixed && (!description || /dimension|measur|size/.test(text.slice(Math.max(0, mixed.index - 90), mixed.index)))) {
    for (const match of mixed[0].matchAll(new RegExp(`(${number})\\s*${unit}`, 'g'))) {
      add('unlabelled', match[1], match[2], mixed[0]);
    }
    return result;
  }
  // Museum sequences with a shared unit. Unlabelled sequences establish an
  // approximate longest extent, not an invented height/width/depth convention.
  const sequence = new RegExp(`(${number}(?:\\s*x\\s*${number})+)\\s*${unit}`, 'g');
  for (const match of text.matchAll(sequence)) {
    const before = text.slice(Math.max(0, match.index - 90), match.index);
    if (description && !/dimension|measur|size|\bh\s*x\s*w/i.test(before)) continue;
    const header = before.match(/((?:h|w|d|l|t|diameter|diam)(?:\s*x\s*(?:h|w|d|l|t|diameter|diam))+)(?:\s*\([^)]*\))?\s*:\s*$/);
    const labels = header?.[1].split(/\s*x\s*/);
    const values = match[1].split(/\s*x\s*/);
    values.forEach((v, i) => add(labels?.[i] || 'unlabelled', v, match[2], match[0]));
    // A parenthesized conversion must not be treated as additional axes.
    break;
  }
  if (!result.length && !description) {
    const match = text.match(new RegExp(`(${number})\\s*${unit}`));
    if (match) add('unlabelled', match[1], match[2], match[0]);
  }
  return result;
}

// These are known mismatches, not merely unverified measurements. Applying
// a whole monument's height to a cropped head would not be a useful estimate.
const unmatched = {
  'discobolus': 'The listed dimensions belong to a different figure than the current model.',
  'sphinx': 'The listed dimensions describe the full monument; this model shows only its head.',
  'michelangelo/moses': 'The listed height describes the complete statue; this model is cropped at the knees.',
  'augustus-of-prima-porta': 'The listed dimensions describe the complete statue; this model is a cropped bust.',
  'marble-capital-sphinx': 'The listed height includes a large capital absent from this model.',
  'spandrel-sections-of-an-arch': 'Individual stone measurements do not establish the size of this eight-stone arrangement.',
  'renaissance/virgin-and-child-della-quercia-workshop-louvre-rf-1703': 'The model and the cited museum object have conflicting identities.',
  'roman/discus-bearer-glyptotek': 'The listed height includes a restored head and arms absent from this model.',
  'europe/venus-of-malta-starch': 'The replica includes restored parts absent from the measured original.',
  'asia/carved-calligraphy-brush-mia': 'The listed length includes bristles absent from this model.',
  'asia/horse-ornament-pushkar-tarnow': 'The listed strap length cannot determine the size of its looped display.',
  'americas/cuban-rattles-varldskulturmuseerna': 'Individual rattle lengths do not establish the size of this two-object arrangement.',
  'renaissance/armor-man-horse-vols-colonna-cleveland': 'Measurements of individual armor pieces do not establish the size of the entire horse and rider.',
  'africa/tombstone-ali-ibn-saad-hamburg': 'The scan and museum measurement cite conflicting inventory numbers.',
};

export function approximateDimensionsFor({ work = {}, record, previewUrl, orientation, spatialReference }) {
  if (unmatched[work.slug]) return { unavailableReason: unmatched[work.slug] };
  if (record?.status === 'variable') return null;
  const calibration = record?.spatial;
  if (calibration) {
    // Keep component fractions, orientation binding and byte verification for
    // existing reviewed estimates. Never revive a stale calibration via text.
    if (!spatialReference || calibration.previewUrl !== previewUrl
      || JSON.stringify(calibration.orientation ?? null) !== JSON.stringify(orientation ?? null)
      || !/^[a-f0-9]{64}$/.test(calibration.assetSha256 || '')) return { unavailableReason: 'The model has changed since its size estimate was recorded.' };
    const measure = record.measures?.[calibration.measurementIndex];
    return { reference: { ...spatialReference, estimated: true },
      axisLabel: (measure?.axis === 'unlabelled' ? 'Reference extent' : measure?.axis || 'Reference extent').replaceAll('_', ' '),
      assetSha256: calibration.assetSha256, method: 'existing-reference',
      sourceText: record.dimensions, sourceUrl: record.dimensionFollowup?.sourceUrl || record.sourceUrl,
      scopeNote: record.spatialNote || '', basis: record.basis,
    };
  }
  const structured = (record?.measures || []).map(m => ({ ...m, meters: m.value * units[m.unit] }))
    .filter(valid).filter(m => !/^(?:base|pedestal|plinth|socle|frame|opening|rim)(?:\b|$)/i.test(m.scope || ''));
  const sources = [
    { measures: structured, method: 'record-measurement', text: record?.dimensions, url: record?.sourceUrl },
    { measures: parseDimensionText(record?.dimensions), method: 'record-text', text: record?.dimensions, url: record?.sourceUrl },
    { measures: parseDimensionText(work.dimensions), method: 'catalogue-dimensions', text: work.dimensions, url: work.source_record_url || work.source_url },
    { measures: parseDimensionText(work.note, { description: true }), method: 'work-description', text: work.note, url: work.source_record_url || work.source_url },
  ];
  // The recorded original's mounting/size differs from the representation
  // catalogued here. Use this item's own listed dimensions for its estimate.
  if (['head-from-farnese-hercules-type', 'modern/brassempouy-torso-conil-reproduction'].includes(work.slug)) {
    sources.unshift(sources.splice(2, 1)[0]);
  }
  for (const source of sources) {
    if (!source.measures.length) continue;
    const height = source.measures.find(m => m.axis === 'height');
    const measure = height || source.measures.reduce((a, b) => b.meters > a.meters ? b : a);
    // Vertical dimensions have an explicit axis. Other directions are fitted
    // to the model's longest extent because its pose/axis order is unverified.
    const axis = height ? 'y' : 'longest';
    return { reference: { axis, meters: measure.meters, estimated: true },
      axisLabel: height ? 'Height' : 'Longest side', method: source.method,
      sourceText: source.text, sourceUrl: source.url || '', basis: record?.basis || 'object',
      scopeNote: height ? 'Any base or mount in the model is included in this approximate starting height.'
        : 'The largest listed dimension sets the model’s longest side; its proportions are preserved.',
    };
  }
  return null;
}

export function approximateSizeLabel(approximation) {
  const meters = approximation.reference.meters;
  const number = new Intl.NumberFormat('en', { maximumSignificantDigits: 3 });
  const size = meters < 1 ? `${number.format(meters * 100)} cm` : `${number.format(meters)} m`;
  const label = approximation.axisLabel;
  return `${label[0].toUpperCase()}${label.slice(1)} ≈ ${size}`;
}
