// A segmented timeline gives both prehistory and recent centuries usable space.
// Its unequal intervals are labelled explicitly in the explorer.
export function timeStops(min, max) {
  const lo = Number.isFinite(min) ? Math.min(-1, min) : -40000;
  const hi = Number.isFinite(max) ? Math.max(1, max) : new Date().getUTCFullYear();
  return [...new Set([lo, -10000, -3000, -1000, 1, 1000, 1500, 1800, 1900, 2000, hi])]
    .filter(year => year >= lo && year <= hi).sort((a, b) => a - b);
}

export function positionToYear(position, stops) {
  const scaled = Math.max(0, Math.min(1000, position)) / 1000 * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const value = Math.round(stops[index] + (stops[index + 1] - stops[index]) * (scaled - index));
  return value === 0 ? 1 : value;
}

export function yearToPosition(year, stops) {
  if (year <= stops[0]) return 0;
  if (year >= stops.at(-1)) return 1000;
  const index = stops.findIndex((value, i) => i < stops.length - 1 && year <= stops[i + 1]);
  return (index + (year - stops[index]) / (stops[index + 1] - stops[index])) / (stops.length - 1) * 1000;
}

export function formatWorldYear(year) {
  const value = Math.round(year) || 1;
  return `${Math.abs(value).toLocaleString('en-US')} ${value < 0 ? 'BCE' : 'CE'}`;
}

export function parseWorldYear(value) {
  const text = String(value).trim().replace(/,/g, '');
  const match = /^(-?\d+)\s*(BCE|BC|CE|AD)?$/i.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  if (!Number.isSafeInteger(year) || year === 0) return null;
  if (year < 0 && /^(CE|AD)$/i.test(match[2] || '')) return null;
  return /^(BCE|BC)$/i.test(match[2] || '') ? -Math.abs(year) : year;
}

export function workOverlapsPeriod(work, from, to, allTime = false) {
  if (allTime) return true;
  if (!Number.isFinite(work.start) || !Number.isFinite(work.end)) return false;
  return work.start <= to && work.end >= from;
}
