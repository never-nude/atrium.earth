import { visitPositionFromSearch, visitRecordQuery } from '../lib/curated-visit.mjs';

const mountedVisits = new Map();
function mountVisits() {
  for (const root of document.querySelectorAll('[data-curated-visit]')) {
    if (mountedVisits.has(root)) continue;
    const dispose = initialiseVisit(root);
    if (dispose) mountedVisits.set(root, dispose);
  }
}
document.addEventListener('astro:before-swap', () => {
  for (const dispose of mountedVisits.values()) dispose();
  mountedVisits.clear();
});
document.addEventListener('astro:page-load', mountVisits);
mountVisits();

function initialiseVisit(root) {
  const data = root.querySelector('[data-visit-data]');
  if (!data) return;
  let visit;
  try { visit = JSON.parse(data.textContent || '{}'); } catch { return; }
  const templates = [...root.querySelectorAll('[data-visit-template]')];
  if (!Array.isArray(visit.stops) || visit.stops.length !== 6 || templates.length !== visit.stops.length) return;
  const entrance = root.querySelector('[data-visit-entrance]');
  const session = root.querySelector('[data-visit-session]');
  const host = root.querySelector('[data-visit-active]');
  const navigation = root.querySelector('[data-visit-navigation]');
  const completion = root.querySelector('[data-visit-completion]');
  const previous = root.querySelector('[data-visit-back]');
  const next = root.querySelector('[data-visit-next]');
  const status = root.querySelector('[data-visit-status]');
  const full = document.querySelector('[data-exhibition-full]');
  const steps = [...root.querySelectorAll('[data-visit-step]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const lifetime = new AbortController();
  const signal = lifetime.signal;
  let stopEvents;
  let position = 0;
  let active = false;

  function moveFocus(element) {
    element?.focus({ preventScroll: true });
    root.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }

  function disposeStop() {
    stopEvents?.abort();
    const viewer = host.querySelector('[data-viewer]');
    if (viewer) document.dispatchEvent(new CustomEvent('atrium:viewer-dispose', { detail: { root: viewer } }));
    host.replaceChildren();
    host.removeAttribute('aria-busy');
  }

  function updateLocation(index, guided = true) {
    const url = new URL(location.href);
    if (guided) {
      const query = new URLSearchParams(visitRecordQuery(visit.exhibitionSlug, visit.id, index));
      for (const [key, value] of query) url.searchParams.set(key, value);
      url.hash = 'curated-visit';
    } else {
      url.searchParams.delete('visit'); url.searchParams.delete('stop');
      url.hash = 'all-exhibition-works';
    }
    history.replaceState(history.state, '', url);
  }

  function showStop(index, { focus = true, updateUrl = true } = {}) {
    if (!Number.isInteger(index) || index < 0 || index >= templates.length) return;
    const fragment = templates[index].content.cloneNode(true);
    const panel = fragment.querySelector('[data-visit-panel]');
    if (!panel) return;
    disposeStop();
    position = index; active = true;
    entrance.hidden = true; session.hidden = false; completion.hidden = true; navigation.hidden = false;
    if (full) full.hidden = true;
    host.append(fragment);
    const viewer = host.querySelector('[data-viewer]');
    if (viewer) {
      stopEvents = new AbortController();
      const region = viewer.closest('.curated-stop__viewer');
      region?.setAttribute('aria-busy', 'true');
      const settled = () => region?.removeAttribute('aria-busy');
      viewer.addEventListener('atrium:viewer-ready', settled, { once: true, signal: stopEvents.signal });
      viewer.addEventListener('atrium:viewer-error', settled, { once: true, signal: stopEvents.signal });
      document.dispatchEvent(new CustomEvent('atrium:viewer-mount', { detail: { root: viewer } }));
    }
    for (const [stepIndex, button] of steps.entries()) {
      if (stepIndex === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    previous.disabled = index === 0;
    next.firstChild.textContent = index === templates.length - 1 ? 'Finish visit ' : 'Next work ';
    status.textContent = `Stop ${index + 1} of ${templates.length} · ${visit.stops[index].title}`;
    root.dataset.visitState = 'active'; root.dataset.activeStep = String(index + 1);
    if (updateUrl) updateLocation(index);
    if (focus) moveFocus(host.querySelector('[data-visit-stop-heading]'));
  }

  function finishVisit() {
    disposeStop();
    active = false; navigation.hidden = true; completion.hidden = false;
    status.textContent = 'End of the six-work visit.';
    root.dataset.visitState = 'complete';
    moveFocus(root.querySelector('[data-visit-complete-heading]'));
  }

  function showAll({ focus = true, updateUrl = true } = {}) {
    disposeStop(); active = false;
    session.hidden = true; entrance.hidden = false;
    if (full) full.hidden = false;
    root.dataset.visitState = 'idle'; delete root.dataset.activeStep;
    if (updateUrl) updateLocation(position, false);
    if (focus) {
      document.querySelector('[data-exhibition-full-title]')?.focus({ preventScroll: true });
      full?.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
  }

  for (const button of root.querySelectorAll('[data-visit-start]')) {
    button.hidden = false;
    button.addEventListener('click', () => showStop(0), { signal });
  }
  root.querySelector('[data-visit-restart]')?.addEventListener('click', () => showStop(0), { signal });
  previous.addEventListener('click', () => showStop(position - 1), { signal });
  next.addEventListener('click', () => position === templates.length - 1 ? finishVisit() : showStop(position + 1), { signal });
  for (const button of steps) button.addEventListener('click', () => showStop(Number(button.dataset.visitStep)), { signal });
  for (const link of document.querySelectorAll('[data-visit-all]')) {
    link.addEventListener('click', event => { event.preventDefault(); showAll(); }, { signal });
  }
  for (const link of document.querySelectorAll('[data-curated-launch]')) {
    link.addEventListener('click', event => { event.preventDefault(); showStop(active ? position : 0); }, { signal });
  }
  window.addEventListener('popstate', () => {
    const index = visitPositionFromSearch(location.search, visit);
    if (index === null) showAll({ focus: false, updateUrl: false });
    else showStop(index, { focus: false, updateUrl: false });
  }, { signal });
  root.dataset.visitState = 'idle';
  const initial = visitPositionFromSearch(location.search, visit);
  const hasVisitQuery = new URLSearchParams(location.search).has('visit');
  if (initial !== null || (!hasVisitQuery && location.hash === '#curated-visit')) {
    showStop(initial ?? 0, { focus: false });
    let interacted = false;
    const interaction = () => { interacted = true; };
    document.addEventListener('pointerdown', interaction, { once: true, passive: true, signal });
    document.addEventListener('keydown', interaction, { once: true, signal });
    const settleScroll = () => requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!signal.aborted && !interacted) root.scrollIntoView({ block: 'start', behavior: 'instant' });
    }));
    settleScroll();
    if (document.readyState !== 'complete') window.addEventListener('load', settleScroll, { once: true, signal });
  }
  return () => { lifetime.abort(); disposeStop(); };
}
