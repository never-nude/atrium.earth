import test from 'node:test';
import assert from 'node:assert/strict';
import { readWorldState, worldContinueUrl } from '../src/lib/world-state.mjs';
const context = { places: [{ id: 'egypt' }, { id: 'china' }], dateMin: -40000, dateMax: 2026 };

test('compact selection and BCE period round-trip into the full explorer', () => {
  const selected = { place: 'egypt', from: -3000, to: -1000, all: false, mode: 'map' };
  const url = worldContinueUrl('/world/', selected, context);
  assert.equal(url, '/world/?place=egypt&from=-3000&to=-1000&mode=map');
  assert.deepEqual(readWorldState(new URL(url, 'https://atrium.earth').search, context), selected);
});
test('all-time handoff omits date filters and preserves unplaced records', () => {
  const url = worldContinueUrl('/world/', { place: '__unplaced__', all: true, mode: 'globe' }, context);
  assert.equal(url, '/world/?place=__unplaced__&mode=globe');
  assert.deepEqual(readWorldState(new URL(url, 'https://atrium.earth').search, context), { place: '__unplaced__', all: true, mode: 'globe', from: -40000, to: 2026 });
});
test('year zero, reversed, missing, duplicate and out-of-bounds dates reset to all time', () => {
  for (const search of ['?from=0&to=1', '?from=-1&to=0', '?from=20&to=-10', '?from=-3000', '?from=-40001&to=1', '?from=1&to=2027', '?from=1e3&to=2026', '?from=9007199254740993&to=2026', '?from=-3&from=-2&to=1']) {
    const state = readWorldState(search, context);
    assert.equal(state.all, true, search); assert.equal(state.from, -40000); assert.equal(state.to, 2026);
  }
});
test('valid CE and cross-era dates preserve exact years without year zero', () => {
  for (const [from, to] of [[-1, 1], [1, 2026], [-39999, -12000], [1501, 1501]]) {
    const url = worldContinueUrl('/world/', { from, to, all: false, mode: 'globe' }, context);
    assert.deepEqual(readWorldState(new URL(url, 'https://atrium.earth').search, context), { place: '', from, to, all: false, mode: 'globe' });
  }
});
test('unknown/duplicate place and mode values cannot enter explorer state', () => {
  assert.equal(readWorldState('?place=imagined&mode=unsupported', context).place, '');
  assert.equal(readWorldState('?place=egypt&place=china&mode=map&mode=globe', context).mode, 'globe');
  assert.equal(readWorldState('?place=egypt&place=china', context).place, '');
});
test('handoff keeps a local base path and drops stale query/fragment or external URLs', () => {
  const state = { place: 'china', all: true, mode: 'map' };
  assert.equal(worldContinueUrl('/museum/world/?old=1#outdated', state, context), '/museum/world/?place=china&mode=map');
  assert.equal(worldContinueUrl('https://outside.example/elsewhere', state, context), '/world/?place=china&mode=map');
});
