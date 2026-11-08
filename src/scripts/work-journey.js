import { exhibitionJourney, worldJourney } from '../lib/work-journey.mjs';

const source = document.querySelector('[data-work-journey-data]');
if (source) void enhanceJourney();

async function enhanceJourney() {
  const data = JSON.parse(source.textContent);
  let journey = exhibitionJourney(location.search,data.slug,data.exhibitions,data.visits,data.base);
  if (!journey && new URLSearchParams(location.search).get('origin') === 'world') {
    try {
      const endpoint = new URL(data.worldDataUrl,location.href);
      if (endpoint.origin !== location.origin) return;
      const response = await fetch(endpoint,{credentials:'same-origin'});
      if (!response.ok) return;
      journey = worldJourney(location.search,data.slug,await response.json(),location.href,data.base);
    } catch { return; }
  }
  if (!journey) return;
  const bar = document.querySelector('[data-work-journey]');
  const label = bar.querySelector('[data-journey-label]');
  const back = bar.querySelector('[data-journey-return]');
  label.textContent = journey.label; back.textContent = `${journey.returnLabel} →`; back.href = journey.returnHref;
  bar.hidden = false;
  for (const direction of ['previous','next']) {
    const link = document.querySelector(`[data-work-${direction}]`);
    if (!link) continue;
    const item = journey[direction];
    link.hidden = !item;
    if (!item) continue;
    link.href = item.href;
    link.setAttribute('aria-label',`${direction === 'next' ? 'Next' : 'Previous'} in this selection: ${item.title}`);
    const title = link.querySelector('i');
    if (title) title.textContent = item.title;
  }
  const nav = document.querySelector('.v3-object-nav');
  if (nav) nav.setAttribute('aria-label','Previous and next works in this selection');
}
