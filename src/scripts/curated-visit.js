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
  const completionHeading = root.querySelector('[data-visit-complete-heading]');
  const previous = root.querySelector('[data-visit-back]');
  const next = root.querySelector('[data-visit-next]');
  const status = root.querySelector('[data-visit-status]');
  const full = document.querySelector('[data-exhibition-full]');
  const fullHeading = full?.querySelector('[data-exhibition-full-title]');
  const steps = [...root.querySelectorAll('[data-visit-step]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const lifetime = new AbortController();
  const signal = lifetime.signal;
  let position = 0;
  let active = false;

  function moveFocus(element, target = root) {
    element?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }

  function scrollAfterLayout(target, userInteracted = () => false) {
    const expectedUrl = location.href;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!signal.aborted && location.href === expectedUrl && !userInteracted()) {
        target?.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    }));
  }

  function disposeStop() {
    const viewer = host.querySelector('[data-viewer]');
    if (viewer) document.dispatchEvent(new CustomEvent('atrium:viewer-dispose', { detail: { root: viewer } }));
    host.replaceChildren();
  }

  function updateLocation(index, hash, historyMode) {
    if (!historyMode) return;
    const url = new URL(location.href);
    if (index !== null) {
      const query = new URLSearchParams(visitRecordQuery(visit.exhibitionSlug, visit.id, index));
      for (const [key, value] of query) url.searchParams.set(key, value);
    } else {
      url.searchParams.delete('visit'); url.searchParams.delete('stop');
    }
    url.hash = hash;
    if (url.href === location.href) return;
    if (historyMode === 'replace') history.replaceState(history.state, '', url);
    else history.pushState(history.state, '', url);
  }

  function showStop(index, { focus = true, historyMode = 'push' } = {}) {
    if (!Number.isInteger(index) || index < 0 || index >= templates.length) return;
    if (active && position === index) {
      updateLocation(index, 'curated-visit', historyMode);
      if (focus) moveFocus(host.querySelector('[data-visit-stop-heading]'));
      return;
    }
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
      const tools = viewer.querySelector('[data-immersive-tools]');
      if (tools) viewer.append(tools);
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
    updateLocation(index, 'curated-visit', historyMode);
    if (focus) moveFocus(host.querySelector('[data-visit-stop-heading]'));
  }

  function finishVisit({ focus = true, historyMode = 'push' } = {}) {
    disposeStop();
    active = false;
    position = templates.length - 1;
    entrance.hidden = true; session.hidden = false;
    navigation.hidden = true; completion.hidden = false;
    if (full) full.hidden = true;
    for (const step of steps) step.removeAttribute('aria-current');
    status.textContent = 'End of the six-work visit.';
    root.dataset.visitState = 'complete';
    delete root.dataset.activeStep;
    updateLocation(position, 'curated-visit-complete', historyMode);
    if (focus) moveFocus(completionHeading);
  }

  function showAll({ focus = true, historyMode = 'push' } = {}) {
    disposeStop(); active = false;
    session.hidden = true; entrance.hidden = false;
    if (full) full.hidden = false;
    status.textContent = '';
    root.dataset.visitState = 'idle'; delete root.dataset.activeStep;
    updateLocation(null, 'all-exhibition-works', historyMode);
    if (focus) moveFocus(fullHeading, full);
  }

  function readGuideLocation() {
    const { search, hash } = location;
    if (hash === '#all-exhibition-works') return null;
    const index = visitPositionFromSearch(search, visit);
    if (index !== null) return index;
    if (hash === '#curated-visit' && !new URLSearchParams(search).has('visit')) return 0;
    return null;
  }

  function restoreGuide(index, historyMode) {
    const complete = index === templates.length - 1 && location.hash === '#curated-visit-complete';
    if (complete) {
      finishVisit({ focus: false, historyMode });
      return completionHeading;
    }
    showStop(index, { focus: false, historyMode });
    return host.querySelector('[data-visit-stop-heading]');
  }

  for (const button of root.querySelectorAll('[data-visit-start]')) {
    button.hidden = false;
    button.addEventListener('click', () => showStop(0), { signal });
  }
  root.querySelector('[data-visit-restart]')?.addEventListener('click', () => showStop(0), { signal });
  previous.addEventListener('click', () => showStop(position - 1), { signal });
  next.addEventListener('click', () => position === templates.length - 1 ? finishVisit() : showStop(position + 1), { signal });
  for (const button of steps) button.addEventListener('click', () => showStop(Number(button.dataset.visitStep)), { signal });
  for (const link of document.querySelectorAll('[data-visit-all], [data-curated-launch]')) {
    link.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (link.hasAttribute('data-visit-all')) showAll();
      else showStop(active ? position : 0);
    }, { signal });
  }
  window.addEventListener('popstate', () => {
    const index = readGuideLocation();
    if (index !== null) {
      const heading = restoreGuide(index, null);
      if (!location.hash || location.hash === '#curated-visit' || location.hash === '#curated-visit-complete') {
        heading?.focus({ preventScroll: true });
        scrollAfterLayout(root);
      }
      return;
    }
    showAll({ focus: false, historyMode: null });
    if (location.hash === '#all-exhibition-works') {
      fullHeading?.focus({ preventScroll: true });
      scrollAfterLayout(full);
    }
  }, { signal });
  root.dataset.visitState = 'idle';
  const initial = readGuideLocation();
  if (initial !== null) {
    restoreGuide(initial, 'replace');
    let interacted = false;
    const interaction = () => { interacted = true; };
    document.addEventListener('pointerdown', interaction, { once: true, passive: true, signal });
    document.addEventListener('keydown', interaction, { once: true, signal });
    document.addEventListener('wheel', interaction, { once: true, passive: true, signal });
    const initialUrl = location.href;
    const settleScroll = () => {
      if (location.href === initialUrl) scrollAfterLayout(root, () => interacted);
    };
    settleScroll();
    if (document.readyState !== 'complete') window.addEventListener('load', settleScroll, { once: true, signal });
  } else if (location.hash === '#all-exhibition-works') {
    showAll({ focus: false, historyMode: 'replace' });
  }
  return () => { lifetime.abort(); disposeStop(); };
}
