import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesReviewedSourcePermission} from './reviewed-source-permissions.mjs';

test('ordinary source requests retain the existing license policy', () => {
  assert.equal(matchesReviewedSourcePermission({label: 'CC Attribution', url: 'http://creativecommons.org/licenses/by/4.0/'}), true);
  assert.equal(matchesReviewedSourcePermission({label: 'CC Attribution-NonCommercial', url: 'http://creativecommons.org/licenses/by-nc/4.0/'}), false);
});

test('a reviewed exception must match the exact published Creative Commons license', () => {
  const license = {label: 'CC Attribution-NonCommercial-NoDerivs', url: 'http://creativecommons.org/licenses/by-nc-nd/4.0/'};
  assert.equal(matchesReviewedSourcePermission(license, license.url), true);
  assert.equal(matchesReviewedSourcePermission(license, 'http://creativecommons.org/licenses/by/4.0/'), false);
  assert.equal(matchesReviewedSourcePermission(license, true), false);
  assert.equal(matchesReviewedSourcePermission({label: 'All Rights Reserved', url: 'https://example.com/license'}, 'https://example.com/license'), false);
});
