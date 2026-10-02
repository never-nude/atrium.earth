import { createHash } from 'node:crypto';

export const SPATIAL_ELIGIBILITY_POLICY_VERSION = 1;

const labels = {
  original: 'Verified size reference',
  object: 'Verified size reference',
  cast: 'Documented cast size',
};
const sourceAxes = {
  height: 'Height', width: 'Width', length: 'Length', depth: 'Depth',
  diameter: 'Diameter', maximum_diameter: 'Maximum diameter', thickness: 'Thickness',
};
const unavailableReasons = {
  unverified: 'Verified-size presentation is unavailable because a matching physical measurement has not been verified.',
  estimate: 'Verified-size presentation is unavailable because the current size or measurement boundary is approximate.',
  mismatch: 'Verified-size presentation is unavailable while the published dimensions and the scanned proportions or represented version are reconciled.',
  axis: 'Verified-size presentation is unavailable until the source measurement’s direction is verified for this model.',
  geometry: 'Verified-size presentation is unavailable pending a further check of the scanned geometry and measurement scope.',
  review: 'Verified-size presentation is unavailable because physical size verification is incomplete.',
  changed: 'Verified-size presentation is unavailable because the model or dimension evidence has changed since its size review.',
};

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

// Server/build helper. The viewer independently checks the downloaded GLB bytes.
export function canonicalFingerprint(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value ?? null))).digest('hex');
}

export function spatialEligibilityBindingFor({ slug, record, previewUrl, orientation }, kind) {
  return {
    policyVersion: SPATIAL_ELIGIBILITY_POLICY_VERSION,
    slug,
    kind,
    recordFingerprint: canonicalFingerprint(record ?? null),
    modelUrl: previewUrl ?? null,
    assetSha256: record?.spatial?.assetSha256 ?? null,
    orientationFingerprint: canonicalFingerprint(orientation ?? null),
  };
}

function unavailable(reason = 'review') {
  return {
    enabled: false, kind: null, label: 'Size verification incomplete', sizeLabel: '',
    reason: unavailableReasons[reason] || unavailableReasons.review,
  };
}

export function spatialEligibilityFor(input, decision) {
  const { record, previewUrl, orientation, spatialReference } = input;
  const spatial = record?.spatial;
  if (record?.status === 'approximate' || spatial?.estimated === true || spatialReference?.estimated === true) {
    return unavailable('estimate');
  }
  if (!decision || decision.policyVersion !== SPATIAL_ELIGIBILITY_POLICY_VERSION) return unavailable();
  if (!decision.enabled) return unavailable(decision.reason);
  if (!Object.hasOwn(labels, decision.kind) || record?.status !== 'documented' || !spatialReference) {
    return unavailable('changed');
  }

  const measure = Number.isInteger(spatial?.measurementIndex) ? record.measures?.[spatial.measurementIndex] : null;
  const fraction = spatial?.extentFraction ?? 1;
  const unitMeters = { mm: 0.001, cm: 0.01, m: 1 }[measure?.unit];
  if (!Object.hasOwn(sourceAxes, measure?.axis) || !Number.isFinite(measure?.value) || measure.value <= 0
    || !unitMeters || !Number.isFinite(spatial?.meters) || spatial.meters <= 0
    || Math.abs(measure.value * unitMeters - spatial.meters) > 1e-10
    || !Number.isFinite(fraction) || fraction <= 0 || fraction > 1
    || !['x', 'y', 'z'].includes(spatial.axis)
    || !/^https?:/.test(record.sourceUrl || '') || !Array.isArray(measure.sourceUrls)
    || !measure.sourceUrls.some(url => /^https?:/.test(url))
    || !/^[a-f0-9]{64}$/.test(spatial.assetSha256 || '')
    || !spatial.reviewed || !spatial.geometryReview
    || spatial.previewUrl !== previewUrl
    || canonicalFingerprint(spatial.orientation ?? null) !== canonicalFingerprint(orientation ?? null)
    || spatialReference.axis !== spatial.axis || spatialReference.meters !== spatial.meters
    || (spatialReference.extentFraction ?? 1) !== fraction) return unavailable('changed');

  const binding = spatialEligibilityBindingFor(input, decision.kind);
  if (decision.recordFingerprint !== binding.recordFingerprint
    || decision.modelUrl !== binding.modelUrl || decision.assetSha256 !== binding.assetSha256
    || decision.orientationFingerprint !== binding.orientationFingerprint
    || decision.bindingFingerprint !== canonicalFingerprint(binding)) return unavailable('changed');

  const component = Boolean(spatial.measurementRegion) || fraction < 1;
  const extentLabel = component ? `Measured component ${sourceAxes[measure.axis].toLowerCase()}` : sourceAxes[measure.axis];
  return {
    enabled: true,
    kind: decision.kind,
    label: labels[decision.kind],
    sizeLabel: `${extentLabel} ${measure.value} ${measure.unit}`,
    reason: decision.kind === 'cast'
      ? 'Based on the measured museum cast, including its reviewed supports. The original artwork’s size is not verified.'
      : 'Based on the reviewed source measurement. Other dimensions retain the scan’s proportions.',
    assetSha256: spatial.assetSha256,
  };
}
