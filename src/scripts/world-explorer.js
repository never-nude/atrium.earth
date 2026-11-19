import {connectWorldViewControls,updateWorldZoomControls} from './world-view-controls.js';
import { timeStops, positionToYear, yearToPosition, formatWorldYear, parseWorldYear } from '../lib/world-time.mjs';
import { readWorldState } from '../lib/world-state.mjs';
import { worldWorkHref } from '../lib/work-journey.mjs';
import { WORLD_SELECTION_LIMIT, rankWorldWorks, selectWorldWorks, worldCollectionHref } from '../lib/world-selection.mjs';

const mounted = new WeakSet();
for (const root of document.querySelectorAll('[data-world-explorer]')) mount(root);

function mount(root) {
  if (mounted.has(root)) return;
  mounted.add(root);
  const lifecycle = new AbortController();
  const signal = lifecycle.signal;
  const compact = root.hasAttribute('data-world-compact');
  let started = false, cleanup, observer;
  async function start() {
    if (started || signal.aborted) return;
    started = true; observer?.disconnect(); root.dataset.worldState = 'loading';
    try { await initialise(root, { compact, signal, register: value => { cleanup = value; } }); }
    catch (error) {
      if (signal.aborted) return;
      root.dataset.worldState = 'error';
      const loading = root.querySelector('[data-world-loading]');
      if (loading) { loading.hidden = false; loading.textContent = 'The world explorer is unavailable. Please try again later.'; }
    }
  }
  window.addEventListener('pagehide', event => {
    cleanup?.suspend();
    if (!event.persisted) { lifecycle.abort(); observer?.disconnect(); cleanup?.destroy(); }
  }, { signal });
  window.addEventListener('pageshow', event => { if (event.persisted) cleanup?.resume(); }, { signal });
  if (compact && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void start(); }, { rootMargin: '160px 0px' });
    observer.observe(root);
  } else void start();
}

async function readData(root, signal) {
  const source = root.querySelector('[data-world-data]');
  if (root.dataset.worldDataUrl) {
    try {
      const url = new URL(root.dataset.worldDataUrl, location.href);
      if (url.origin !== location.origin) throw new Error('World metadata must use the local endpoint.');
      const response = await fetch(url, { signal, credentials: 'same-origin' });
      if (!response.ok) throw new Error('World metadata is unavailable.');
      return await response.json();
    } catch (error) { if (signal.aborted || !source) throw error; }
  }
  if (!source) throw new Error('World metadata is unavailable.');
  return JSON.parse(source.textContent || '{}');
}

async function initialise(root, { compact, signal, register }) {
  const data = await readData(root, signal);
  signal.throwIfAborted();
  const on = (target, type, listener) => target?.addEventListener(type, listener, { signal });
  const places = Array.isArray(data.places) ? data.places : [];
  const works = Array.isArray(data.works) ? data.works : [];
  const placeById = new Map(places.map(place => [place.id, place]));
  const ranked = rankWorldWorks(works, data.featured || []);
  const stops = timeStops(data.dateMin, data.dateMax);
  const from = root.querySelector('[data-world-from]');
  const to = root.querySelector('[data-world-to]');
  const fromText = root.querySelector('[data-world-date-from]');
  const toText = root.querySelector('[data-world-date-to]');
  const select = root.querySelector('[data-world-place]');
  const list = root.querySelector('[data-world-works]');
  const empty = root.querySelector('[data-world-empty]');
  const originNote = root.querySelector('[data-world-origin-note]');
  const loading = root.querySelector('[data-world-loading]');
  const selection = root.querySelector('[data-world-selection]');
  const selectionClose = root.querySelector('[data-world-selection-close]');
  const seeAll = root.querySelector('[data-world-see-all]');
  const placeList = root.querySelector('[data-world-place-list]');
  const placeButtons = new Map();
  const context = { places, dateMin: stops[0], dateMax: stops.at(-1) };
  const inbound = readWorldState(compact ? '' : location.search, context);
  const state = {place:inbound.place,from:inbound.all ? 0 : yearToPosition(inbound.from,stops),to:inbound.all ? 1000 : yearToPosition(inbound.to,stops),mode:inbound.mode};
  let globe;
  let disconnectControls;
  let frame;
  let selectionFrame;
  let returnView = null;
  let returnFocus = null;
  let returnPageY = null;
  let returnScrollTarget = null;
  let restoreTimer = 0;
  let keyboardInteraction = false;
  let cardKey = '';
  let selectionToken = 0;
  const scrollTarget = () => document.fullscreenElement === root ? root : window;
  register({
    suspend() { cancelAnimationFrame(frame); cancelAnimationFrame(selectionFrame); clearTimeout(restoreTimer); },
    resume() { queueRender(); },
    destroy() { cancelAnimationFrame(frame); cancelAnimationFrame(selectionFrame); clearTimeout(restoreTimer); disconnectControls?.(); globe?.destroy(); },
  });

  const options = [...places].sort((a,b) => a.label.localeCompare(b.label));
  for (const place of options) {
    const option = document.createElement('option');
    option.value = place.id; option.textContent = place.label;
    select.append(option);
    if (placeList) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.worldListPlace = place.id;
      const label = document.createElement('span'); label.textContent = place.label;
      const count = document.createElement('span'); count.dataset.worldListCount = '';
      button.append(label, count);
      on(button, 'click', () => choosePlace(place.id));
      placeList.append(button); placeButtons.set(place.id, button);
    }
  }
  const unknownOption = document.createElement('option');
  unknownOption.value = '__unplaced__'; unknownOption.textContent = 'Origin uncertain or unrecorded';
  select.append(unknownOption);

  const ticks = root.querySelector('[data-world-ticks]');
  // Only a few anchors are labelled; the handles and exact-date form provide precision.
  for (const year of [stops[0], 1, 1500, stops.at(-1)].filter((value,index,array) => value >= stops[0] && value <= stops.at(-1) && array.indexOf(value) === index)) {
    const tick = document.createElement('span'); tick.textContent = formatWorldYear(year);
    const position = yearToPosition(year,stops) / 10;
    tick.style.left = `${position}%`;
    tick.style.transform = position === 0 ? 'none' : position === 100 ? 'translateX(-100%)' : 'translateX(-50%)';
    ticks.append(tick);
  }

  function period() {
    const all = state.from <= 0 && state.to >= 1000;
    return {start:positionToYear(state.from,stops),end:positionToYear(state.to,stops),all};
  }

  function updateWorkLinks() {
    const time = period();
    for (const link of list.querySelectorAll('[data-world-work-url]')) {
      link.href = worldWorkHref(link.dataset.worldWorkUrl,{place:state.place,mode:state.mode,from:time.start,to:time.end,all:time.all},context,location.href);
    }
  }

  function render() {
    if (signal.aborted) return;
    const time = period();
    const { counts, results, unplaced } = selectWorldWorks(ranked, places, { place: state.place,
      from: time.start, to: time.end, all: time.all });
    const place = placeById.get(state.place);
    select.value = state.place;
    for (const option of select.options) {
      if (placeById.has(option.value)) {
        const item = placeById.get(option.value);
        option.textContent = `${item.label} · ${(counts[option.value] || 0).toLocaleString('en-US')}`;
      }
    }
    unknownOption.textContent = `Origin uncertain or unrecorded · ${unplaced.toLocaleString('en-US')}`;
    for (const [id, button] of placeButtons) {
      const count = counts[id] || 0;
      button.querySelector('[data-world-list-count]').textContent = count.toLocaleString('en-US');
      button.setAttribute('aria-label', `${placeById.get(id).label}, ${count.toLocaleString('en-US')} ${count === 1 ? 'work' : 'works'}`);
      button.setAttribute('aria-pressed', String(state.place === id));
    }
    root.querySelector('[data-world-place-title]').textContent = state.place === '__unplaced__' ? 'Origin uncertain or unrecorded' : place?.label || 'Across the world';
    const periodLabel = time.all ? 'All periods' : `${formatWorldYear(time.start)} — ${formatWorldYear(time.end)}`;
    root.querySelector('[data-world-period]').textContent = periodLabel;
    const resultCount = `${results.length.toLocaleString('en-US')} ${results.length === 1 ? 'work' : 'works'}`;
    const originQualifier = state.place ? '' : ' mapped by origin';
    root.querySelector('[data-world-period-count]').textContent = resultCount;
    root.querySelector('[data-world-result-count]').textContent = `${resultCount}${originQualifier} · ${periodLabel}`;
    originNote.textContent = state.place === '__unplaced__'
      ? 'These records do not establish an origin confidently enough to place on the globe.'
      : place ? `Approximate ${place.precision === 'country' ? 'country' : 'regional'} location. Individual works retain their recorded origin and source details.`
        : 'Choose a light on the globe or a place from the list. Locations follow documented origins.';
    const uncertainDates = works.filter(work => (state.place === '__unplaced__' ? !placeById.has(work.placeId) : state.place ? work.placeId === state.place : placeById.has(work.placeId)) && (!Number.isFinite(work.start) || !Number.isFinite(work.end))).length;
    root.querySelector('[data-world-uncertainty]').textContent = uncertainDates
      ? time.all ? `${uncertainDates.toLocaleString('en-US')} records in this selection have uncertain dates. Narrowing the timeline uses only dependable date ranges.`
        : `${uncertainDates.toLocaleString('en-US')} records with uncertain dates are outside this time filter. Reset to all periods to see them.`
      : 'Recorded date ranges overlap the selected period; approximate dates remain approximate.';
    from.value = String(state.from); to.value = String(state.to);
    from.setAttribute('aria-valuetext',formatWorldYear(time.start));
    to.setAttribute('aria-valuetext',formatWorldYear(time.end));
    fromText.value = formatWorldYear(time.start); toText.value = formatWorldYear(time.end);
    const fill = root.querySelector('[data-world-range-fill]');
    fill.style.left = `${state.from / 10}%`; fill.style.width = `${(state.to-state.from) / 10}%`;
    const cardResults = state.place ? results.slice(0, WORLD_SELECTION_LIMIT) : [];
    const nextCardKey = cardResults.map(work => work.slug).join('|');
    if (nextCardKey !== cardKey) {
      const cards = document.createDocumentFragment();
      for (const [index, work] of cardResults.entries()) cards.append(workCard(work, index));
      list.replaceChildren(cards); list.scrollLeft = 0; cardKey = nextCardKey;
    }
    if (selection) {
      selection.hidden = !state.place;
      const title = root.querySelector('[data-world-selection-title]');
      if (title) title.textContent = place?.label || (state.place === '__unplaced__' ? 'Origin uncertain or unrecorded' : '');
      const count = root.querySelector('[data-world-selection-count]');
      if (count) count.textContent = `${resultCount} · ${periodLabel}`;
      root.dataset.worldSelectionOpen = String(Boolean(state.place));
      if (seeAll) {
        seeAll.href = worldCollectionHref(root.dataset.worldCollectionUrl || '/collection/',
          { place: state.place, from: time.start, to: time.end, all: time.all }, location.href);
        seeAll.textContent = `See all ${results.length.toLocaleString('en-US')} ${results.length === 1 ? 'work' : 'works'} from here`;
      }
    }
    empty.hidden = results.length !== 0;
    const shown = root.querySelector('[data-world-shown-count]');
    if (shown) {
      shown.hidden = results.length === 0;
      shown.textContent = `Showing ${cardResults.length.toLocaleString('en-US')} of ${results.length.toLocaleString('en-US')} works`;
    }
    updateWorkLinks();
    globe?.update({counts,selectedId:place?.id || null});
    root.dataset.selectedPlace = state.place;
    root.dataset.resultCount = String(results.length);
    root.dataset.periodFrom = String(time.start); root.dataset.periodTo = String(time.end);
  }

  function workCard(work, index) {
    const card = document.createElement('a'); card.className = 'world-work';
    card.style.setProperty('--world-card-delay', `${index * 60}ms`);
    card.dataset.worldWorkUrl = work.url;
    const image = document.createElement('img');
    image.src = `${root.dataset.worldStillsBase}${work.slug}.webp`;
    image.alt = ''; image.width = 160; image.height = 190; image.loading = 'lazy'; image.decoding = 'async';
    const copy = document.createElement('div');
    const title = document.createElement(compact ? 'h4' : 'h3'); title.dataset.worldWorkTitle = ''; title.textContent = work.title;
    if (work.fullTitle) card.title = work.fullTitle;
    const maker = document.createElement('p'); maker.textContent = work.maker || '';
    const date = document.createElement('p'); date.textContent = work.dateLabel || 'Date not recorded';
    const action = document.createElement('span'); action.textContent = 'Examine the work ↗';
    copy.append(title);
    if (work.maker) copy.append(maker);
    copy.append(date,action); card.append(image,copy);
    return card;
  }

  function choosePlace(id) {
    const started = performance.now();
    const nextPlace = id === '__unplaced__' || placeById.has(id) ? id : '';
    if (nextPlace && !state.place) {
      returnView = globe?.captureView?.() || null;
      returnScrollTarget = scrollTarget();
      returnPageY = returnScrollTarget === window ? window.scrollY : root.scrollTop;
      returnFocus = document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
        ? document.activeElement : select;
    }
    if (!nextPlace && state.place) { closeSelection(); return; }
    state.place = nextPlace;
    render();
    if (state.place && selection) {
      clearTimeout(restoreTimer);
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const keyboardChoice = keyboardInteraction;
      const sidePanel = matchMedia('(min-width: 1024px)').matches;
      root.querySelector('.world-observatory')?.scrollIntoView({ block: sidePanel ? 'nearest' : 'start', behavior: reduced ? 'instant' : 'smooth' });
      const token = ++selectionToken;
      let followedSelection = false;
      cancelAnimationFrame(selectionFrame);
      const measureVisible = () => {
        if (signal.aborted || token !== selectionToken || selection.hidden) return;
        const elapsed = performance.now() - started;
        const firstCard = list.firstElementChild;
        const image = firstCard?.querySelector('img');
        const box = (image || empty).getBoundingClientRect();
        const headerBottom = document.fullscreenElement === root ? 0
          : document.querySelector('[data-v3-header]')?.getBoundingClientRect().bottom || 0;
        const visibleHeight = Math.max(0, Math.min(box.bottom, innerHeight) - Math.max(box.top, 0, headerBottom));
        const halfVisible = box.height > 0 && visibleHeight / box.height >= .5;
        if (!sidePanel && !halfVisible && !followedSelection && elapsed >= (reduced ? 0 : 450)) {
          // A short screen can fit the globe or the stills, but not both in full.
          // After the selected layout settles, make one small follow movement.
          followedSelection = true;
          const delta = box.bottom - (innerHeight - 20);
          if (Math.abs(delta) > 1) scrollTarget().scrollBy({ top: delta, behavior: reduced ? 'instant' : 'smooth' });
        }
        const visible = box.width > 0 && box.right > 0 && box.left < innerWidth && halfVisible
          && (!image || (image.complete && image.naturalWidth > 0))
          && Number(getComputedStyle(firstCard || empty).opacity) > 0;
        if (!visible && elapsed < 5000) { selectionFrame = requestAnimationFrame(measureVisible); return; }
        if (!visible) { root.dataset.worldSelectionVisibleError = 'The selected works did not enter the viewport'; return; }
        delete root.dataset.worldSelectionVisibleError;
        root.dataset.worldSelectionVisibleMs = elapsed.toFixed(2);
        if (!root.hasAttribute('data-world-first-selection-ms')) root.dataset.worldFirstSelectionMs = elapsed.toFixed(2);
        if (keyboardChoice && keyboardInteraction) root.querySelector('[data-world-selection-title]')?.focus({ preventScroll: true });
        root.dispatchEvent(new CustomEvent('atrium:world-selection-visible', {
          detail: { place: state.place, elapsedMs: elapsed, works: list.children.length }, bubbles: true,
        }));
      };
      selectionFrame = requestAnimationFrame(() => { selectionFrame = requestAnimationFrame(measureVisible); });
    }
  }
  function closeSelection(restore = true) {
    const restoreFocus = keyboardInteraction || selection?.contains(document.activeElement);
    selectionToken++; cancelAnimationFrame(selectionFrame);
    state.place = ''; render();
    if (restore && returnView) {
      const restoredMode = globe?.setMode(returnView.mode) === false ? 'map' : returnView.mode;
      setMode(restoredMode);
      globe?.restoreView?.(returnView);
    }
    const pageY = returnPageY;
    const scrollOwner = returnScrollTarget;
    const focus = returnFocus;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    clearTimeout(restoreTimer);
    if (restore && pageY !== null) restoreTimer = window.setTimeout(() => {
      if (signal.aborted || state.place) return;
      if (scrollOwner === window || scrollOwner?.isConnected) scrollOwner.scrollTo({ top: pageY, behavior: reduced ? 'instant' : 'smooth' });
      if (restoreFocus) {
        if (focus?.isConnected) focus.focus({ preventScroll: true });
        if (!focus || document.activeElement !== focus) {
          root.querySelector('[data-world-mode][aria-pressed="true"]')?.focus({ preventScroll: true });
        }
      }
    }, reduced ? 0 : 480);
    returnView = null;
    returnFocus = null; returnPageY = null; returnScrollTarget = null;
  }
  function queueRender() { if (signal.aborted) return; cancelAnimationFrame(frame); frame = requestAnimationFrame(render); }
  on(select,'change',() => choosePlace(select.value));
  on(selectionClose, 'click', () => closeSelection());
  root.addEventListener('pointerdown', () => { keyboardInteraction = false; }, { signal, capture: true });
  on(root, 'keydown', event => {
    if (['Tab', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)) keyboardInteraction = true;
  });
  on(window, 'keydown', event => {
    // Safari can leave body focused after a pointer chooses Globe or Map.
    // Keep Escape available there without intercepting header/dialog controls.
    const active = document.activeElement;
    if (event.key === 'Escape' && state.place && !event.defaultPrevented
      && (active === document.body || root.contains(active)) && !document.querySelector('dialog[open]')) {
      keyboardInteraction = true; event.preventDefault(); closeSelection();
    }
  });
  on(from,'input',() => {state.from = Math.min(Number(from.value),state.to);queueRender();});
  on(to,'input',() => {state.to = Math.max(Number(to.value),state.from);queueRender();});
  on(root.querySelector('[data-world-reset]'),'click',() => {
    closeSelection(false);
    state.from = 0;state.to = 1000;
    root.querySelector('[data-world-date-error]').textContent = '';
    globe?.reset(); globe?.setAutoRotate(true);
    setMode(globe?.setMode('globe') === false ? 'map' : 'globe');render();
  });
  on(root.querySelector('[data-world-date-form]'),'submit',event => {
    event.preventDefault();
    const a = parseWorldYear(fromText.value), b = parseWorldYear(toText.value);
    const error = root.querySelector('[data-world-date-error]');
    if (a === null || b === null) {error.textContent = 'Enter a year with BCE or CE, for example 500 BCE. There is no year zero.';return;}
    if (a > b) {error.textContent = 'The starting date must come before the ending date.';return;}
    if (a < stops[0] || b > stops.at(-1)) {error.textContent = `Choose dates between ${formatWorldYear(stops[0])} and ${formatWorldYear(stops.at(-1))}.`;return;}
    state.from = yearToPosition(a,stops);state.to = yearToPosition(b,stops);error.textContent = '';render();
  });
  function setMode(mode) {
    state.mode = mode === 'map' ? 'map' : 'globe';
    for (const item of root.querySelectorAll('[data-world-mode]')) item.setAttribute('aria-pressed',String(item.dataset.worldMode === state.mode));
    root.querySelector('[data-world-map-hint]').textContent = state.mode === 'globe'
      ? 'Touch or drag the globe to turn · Pinch to zoom'
      : 'Choose a light or use the place list';
    root.dataset.worldMode = state.mode;
    root.dispatchEvent(new Event('world-mode-change'));
    updateWorkLinks();
  }
  for (const button of root.querySelectorAll('[data-world-mode]')) {
    on(button,'click',() => {
      const requested = button.dataset.worldMode;
      setMode(globe?.setMode(requested) === false ? 'map' : requested);
    });
  }
  setMode(state.mode);render();
  try {
    const { createWorldGlobe } = await import('./world-globe.js');
    signal.throwIfAborted();
    globe = createWorldGlobe({
      host:root.querySelector('[data-world-globe]'),places,onSelect:choosePlace,autoRotate:true,presentation:'signature',
      // In the overview these float over the top of the stage; a light's label must not open under them.
      overlays:() => root.querySelectorAll('.world-map-toolbar > *'),
      onReady:info => {if(signal.aborted)return;setMode(info.mode);root.dataset.worldState='ready';if(loading)loading.hidden=true;},
      onError:(error,info) => {if(signal.aborted)return;root.dataset.worldState='fallback';setMode(info?.mode || error?.mode || 'map');if(loading)loading.textContent='Choose a place from the list to explore its works.';},
      onZoomChange:info => updateWorldZoomControls(root,info),
      onAutoRotateChange:() => root.dispatchEvent(new Event('world-rotation-change')),
    });
    disconnectControls = connectWorldViewControls(root,globe,root);
    if (state.place && !returnView) {
      returnView = globe.captureView?.() || null;
      returnScrollTarget = scrollTarget();
      returnPageY = returnScrollTarget === window ? window.scrollY : root.scrollTop;
      returnFocus = root.querySelector('[data-world-mode="globe"]');
    }
    setMode(globe.setMode(state.mode) === false ? 'map' : state.mode);render();
  } catch {
    if(signal.aborted)return;
    if (loading) loading.textContent = 'Choose a place from the list to explore its works.';
  }
}
