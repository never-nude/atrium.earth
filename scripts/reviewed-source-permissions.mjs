const defaultLabels = new Set(['CC0 Public Domain', 'CC Attribution', 'CC Attribution-ShareAlike']);
const defaultUrl = /^https?:\/\/creativecommons\.org\/(licenses\/(by|by-sa)\/4\.0|publicdomain\/zero\/1\.0)\/?$/;
const reviewedUrl = /^https?:\/\/creativecommons\.org\/licenses\/(by|by-sa|by-nd|by-nc|by-nc-sa|by-nc-nd)\/4\.0\/$/;

export function matchesReviewedSourcePermission(license, expectedUrl) {
  const label = license?.label || '';
  const url = license?.url || '';
  if (expectedUrl !== undefined) {
    return typeof expectedUrl === 'string' && url === expectedUrl
      && (reviewedUrl.test(url) || (label === 'CC0 Public Domain' && defaultUrl.test(url)));
  }
  return defaultLabels.has(label) && defaultUrl.test(url);
}
