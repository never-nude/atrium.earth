import assert from 'node:assert/strict';
import { timeStops, positionToYear, yearToPosition, formatWorldYear, parseWorldYear, workOverlapsPeriod } from '../src/lib/world-time.mjs';

const stops = timeStops(-40000, 2026);
assert.equal(positionToYear(0, stops), -40000);
assert.equal(positionToYear(1000, stops), 2026);
let previous = -Infinity;
for (let point = 0; point <= 1000; point++) {
  const year = positionToYear(point, stops);
  assert.ok(year >= previous); assert.notEqual(year, 0); previous = year;
}
for (const year of [-40000, -10000, -3000, -500, 1, 1000, 1500, 1875, 2026]) {
  assert.ok(Math.abs(positionToYear(yearToPosition(year, stops), stops) - year) <= 1);
}
assert.equal(parseWorldYear('500 BCE'), -500);
assert.equal(parseWorldYear('-500'), -500);
assert.equal(parseWorldYear('1,875 CE'), 1875);
for (const value of ['0', 'today', '500-ish', 'Infinity', '', '-500 CE', '-500 AD']) assert.equal(parseWorldYear(value), null);
assert.equal(formatWorldYear(-500), '500 BCE');
assert.equal(formatWorldYear(0), '1 CE');
assert.equal(workOverlapsPeriod({start:-600,end:-400}, -500, 100), true);
assert.equal(workOverlapsPeriod({start:100,end:200}, 201, 400), false);
assert.equal(workOverlapsPeriod({start:null,end:null}, -500, 100), false);
assert.equal(workOverlapsPeriod({start:null,end:null}, -500, 100, true), true);
console.log('World timeline: monotonic segmented scale, round trips, BCE/CE, no year zero, uncertain dates and inclusive overlap pass.');
