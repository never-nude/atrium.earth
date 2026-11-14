import {connectWorldViewControls,updateWorldZoomControls} from './world-view-controls.js';
import { timeStops, positionToYear, yearToPosition, formatWorldYear, parseWorldYear, workOverlapsPeriod } from '../lib/world-time.mjs';
import { readWorldState, worldContinueUrl } from '../lib/world-state.mjs';
import { worldWorkHref } from '../lib/work-journey.mjs';

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
  const featured = new Set(data.featured || []);
  const ranked = [...works].sort((a, b) => Number(featured.has(b.slug)) - Number(featured.has(a.slug)) || a.title.localeCompare(b.title));
  const stops = timeStops(data.dateMin, data.dateMax);
  const from = root.querySelector('[data-world-from]');
  const to = root.querySelector('[data-world-to]');
  const fromText = root.querySelector('[data-world-date-from]');
  const toText = root.querySelector('[data-world-date-to]');
  const select = root.querySelector('[data-world-place]');
  const list = root.querySelector('[data-world-works]');
  const more = root.querySelector('[data-world-more]');
  const empty = root.querySelector('[data-world-empty]');
  const originNote = root.querySelector('[data-world-origin-note]');
  const loading = root.querySelector('[data-world-loading]');
  const initialLimit = compact ? 2 : 3;
  const context = { places, dateMin: stops[0], dateMax: stops.at(-1) };
  const inbound = readWorldState(compact ? '' : location.search, context);
  const state = {place:inbound.place,from:inbound.all ? 0 : yearToPosition(inbound.from,stops),to:inbound.all ? 1000 : yearToPosition(inbound.to,stops),limit:initialLimit,mode:inbound.mode};
  let globe;
  let disconnectControls;
  let frame;
  register({
    suspend() { cancelAnimationFrame(frame); },
    resume() { queueRender(); },
    destroy() { cancelAnimationFrame(frame); disconnectControls?.(); globe?.destroy(); },
  });

  const options = [...places].sort((a,b) => a.label.localeCompare(b.label));
  for (const place of options) {
    const option = document.createElement('option');
    option.value = place.id; option.textContent = place.label;
    select.append(option);
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

  function updateContinue() {
    const time = period();
    const href = worldContinueUrl(root.dataset.worldDetailUrl || '/world/', { place:state.place,mode:state.mode,from:time.start,to:time.end,all:time.all }, context, location.href);
    for (const link of root.querySelectorAll('[data-world-continue]')) link.href = href;
    for (const link of list.querySelectorAll('[data-world-work-url]')) {
      link.href = worldWorkHref(link.dataset.worldWorkUrl,{place:state.place,mode:state.mode,from:time.start,to:time.end,all:time.all},context,location.href);
    }
  }

  function render() {
    if (signal.aborted) return;
    const time = period();
    const eligible = ranked.filter(work => workOverlapsPeriod(work,time.start,time.end,time.all));
    const counts = Object.fromEntries(places.map(place => [place.id,0]));
    let unplaced = 0;
    for (const work of eligible) {
      if (work.placeId && Object.hasOwn(counts,work.placeId)) counts[work.placeId]++;
      else unplaced++;
    }
    const isPlaced = work => placeById.has(work.placeId);
    const results = eligible.filter(work => state.place === '__unplaced__' ? !isPlaced(work) : state.place ? work.placeId === state.place : isPlaced(work));
    const place = placeById.get(state.place);
    select.value = state.place;
    for (const option of select.options) {
      if (placeById.has(option.value)) {
        const item = placeById.get(option.value);
        option.textContent = `${item.label} · ${(counts[option.value] || 0).toLocaleString('en-US')}`;
      }
    }
    unknownOption.textContent = `Origin uncertain or unrecorded · ${unplaced.toLocaleString('en-US')}`;
    root.querySelector('[data-world-place-title]').textContent = state.place === '__unplaced__' ? 'Origin uncertain or unrecorded' : place?.label || 'Across the world';
    const periodLabel = time.all ? 'All periods' : `${formatWorldYear(time.start)} — ${formatWorldYear(time.end)}`;
    root.querySelector('[data-world-period]').textContent = periodLabel;
    const resultCount = `${results.length.toLocaleString('en-US')} ${results.length === 1 ? 'work' : 'works'}`;
    const originQualifier = state.place ? '' : ' mapped by origin';
    const periodCount = root.querySelector('[data-world-period-count]');
    periodCount.textContent = `${resultCount} ↓`;
    periodCount.setAttribute('aria-label', `${resultCount} for this period`);
    root.querySelector('[data-world-result-count]').textContent = `${resultCount}${originQualifier} · ${periodLabel}`;
    originNote.textContent = state.place === '__unplaced__'
      ? 'These records do not establish an origin confidently enough to place on the globe.'
      : place ? `Approximate ${place.precision === 'country' ? 'country' : 'regional'} location. Individual works retain their recorded origin and source details.`
        : 'Choose a glowing place, or use the list above. Colors identify broad geographic regions.';
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
    const cards = document.createDocumentFragment();
    for (const work of results.slice(0,state.limit)) cards.append(workCard(work));
    list.replaceChildren(cards);
    empty.hidden = results.length !== 0;
    if (more) {
      more.hidden = compact || results.length <= state.limit;
      if (!more.hidden) {
        const label = `Show more works (${Math.min(state.limit,results.length)} of ${results.length}) `;
        if (more.firstChild?.nodeType === 3) more.firstChild.textContent = label; else more.textContent = label;
      }
    }
    const shown = root.querySelector('[data-world-shown-count]');
    if (shown) { shown.hidden = results.length === 0; shown.textContent = `Showing ${Math.min(state.limit,results.length).toLocaleString('en-US')} of ${results.length.toLocaleString('en-US')} works`; }
    updateContinue();
    globe?.update({counts,selectedId:place?.id || null});
    root.dataset.selectedPlace = state.place;
    root.dataset.resultCount = String(results.length);
    root.dataset.periodFrom = String(time.start); root.dataset.periodTo = String(time.end);
  }

  function workCard(work) {
    const time = period();
    const card = document.createElement('a'); card.className = 'world-work';
    card.dataset.worldWorkUrl = work.url;
    card.href = worldWorkHref(work.url,{place:state.place,mode:state.mode,from:time.start,to:time.end,all:time.all},context,location.href);
    const image = document.createElement('img'); image.src = work.thumbnail; image.alt = work.fullTitle || work.title; image.width = 105; image.height = 128; image.loading = 'lazy'; image.decoding = 'async';
    const copy = document.createElement('div');
    const title = document.createElement(compact ? 'h4' : 'h3'); title.dataset.worldWorkTitle = ''; title.textContent = work.title;
    const maker = document.createElement('p'); maker.textContent = work.maker || '';
    const date = document.createElement('p'); date.textContent = work.dateLabel || 'Date not recorded';
    const action = document.createElement('span'); action.textContent = 'Examine the work ↗';
    copy.append(title);
    if (work.maker) copy.append(maker);
    copy.append(date,action); card.append(image,copy);
    return card;
  }

  function choosePlace(id) {
    state.place = id === '__unplaced__' || placeById.has(id) ? id : '';
    state.limit = initialLimit; render();
  }
  function queueRender() { if (signal.aborted) return; cancelAnimationFrame(frame); frame = requestAnimationFrame(render); }
  on(select,'change',() => choosePlace(select.value));
  on(from,'input',() => {state.from = Math.min(Number(from.value),state.to);state.limit = initialLimit;queueRender();});
  on(to,'input',() => {state.to = Math.max(Number(to.value),state.from);state.limit = initialLimit;queueRender();});
  on(more,'click',() => {
    if (compact) return;
    const firstNew = state.limit;
    state.limit += 6;render();
    list.children[firstNew]?.focus();
  });
  on(root.querySelector('[data-world-reset]'),'click',() => {
    state.place = '';state.from = 0;state.to = 1000;state.limit = initialLimit;
    root.querySelector('[data-world-date-error]').textContent = '';
    globe?.pause();globe?.reset();setMode(globe?.setMode('globe') === false ? 'map' : 'globe');render();
  });
  on(root.querySelector('[data-world-date-form]'),'submit',event => {
    event.preventDefault();
    const a = parseWorldYear(fromText.value), b = parseWorldYear(toText.value);
    const error = root.querySelector('[data-world-date-error]');
    if (a === null || b === null) {error.textContent = 'Enter a year with BCE or CE, for example 500 BCE. There is no year zero.';return;}
    if (a > b) {error.textContent = 'The starting date must come before the ending date.';return;}
    if (a < stops[0] || b > stops.at(-1)) {error.textContent = `Choose dates between ${formatWorldYear(stops[0])} and ${formatWorldYear(stops.at(-1))}.`;return;}
    state.from = yearToPosition(a,stops);state.to = yearToPosition(b,stops);state.limit = initialLimit;error.textContent = '';render();
  });
  function setMode(mode) {
    state.mode = mode === 'map' ? 'map' : 'globe';
    for (const item of root.querySelectorAll('[data-world-mode]')) item.setAttribute('aria-pressed',String(item.dataset.worldMode === state.mode));
    root.querySelector('[data-world-map-hint]').textContent = state.mode === 'globe' ? 'Drag to turn · Select a glowing place' : 'Select a glowing place';
    root.dataset.worldMode = state.mode;
    root.dispatchEvent(new Event('world-mode-change'));
    updateContinue();
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
      host:root.querySelector('[data-world-globe]'),places,onSelect:choosePlace,autoRotate:false,
      onReady:info => {if(signal.aborted)return;setMode(info.mode);root.dataset.worldState='ready';if(loading)loading.hidden=true;},
      onError:(error,info) => {if(signal.aborted)return;root.dataset.worldState='fallback';setMode(info?.mode || error?.mode || 'map');if(loading)loading.textContent='Choose a place from the list to explore its works.';},
      onZoomChange:info => updateWorldZoomControls(root,info),
      onAutoRotateChange:() => root.dispatchEvent(new Event('world-rotation-change')),
    });
    disconnectControls = connectWorldViewControls(root,globe,root.querySelector('[data-world-viewport]'));
    setMode(globe.setMode(state.mode) === false ? 'map' : state.mode);render();
  } catch {
    if(signal.aborted)return;
    if (loading) loading.textContent = 'Choose a place from the list to explore its works.';
  }
}
