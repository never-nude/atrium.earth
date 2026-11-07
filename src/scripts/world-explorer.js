import { createWorldGlobe } from './world-globe.js';
import {connectWorldViewControls,updateWorldZoomControls} from './world-view-controls.js';
import { timeStops, positionToYear, yearToPosition, formatWorldYear, parseWorldYear, workOverlapsPeriod } from '../lib/world-time.mjs';

const root = document.querySelector('[data-world-explorer]');
if (root) initialise(root);

async function initialise(root) {
  const source = root.querySelector('[data-world-data]');
  if (!source) return;
  const data = JSON.parse(source.textContent || '{}');
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
  const initialLimit = 3;
  const state = {place:'',from:0,to:1000,limit:initialLimit,mode:'globe'};
  let globe;
  let disconnectControls;
  let frame;

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

  function render() {
    const time = period();
    const eligible = ranked.filter(work => workOverlapsPeriod(work,time.start,time.end,time.all));
    const counts = Object.fromEntries(places.map(place => [place.id,0]));
    let unplaced = 0;
    for (const work of eligible) {
      if (work.placeId && Object.hasOwn(counts,work.placeId)) counts[work.placeId]++;
      else unplaced++;
    }
    const results = eligible.filter(work => state.place === '__unplaced__' ? !work.placeId : state.place ? work.placeId === state.place : Boolean(work.placeId));
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
    root.querySelector('[data-world-period-count]').textContent = `${results.length.toLocaleString('en-US')} ${results.length === 1 ? 'work' : 'works'} ↓`;
    root.querySelector('[data-world-result-count]').textContent = `${results.length.toLocaleString('en-US')} ${results.length === 1 ? 'work' : 'works'} · ${periodLabel}`;
    originNote.textContent = state.place === '__unplaced__'
      ? 'These records do not establish an origin confidently enough to place on the globe.'
      : place ? `Approximate ${place.precision === 'country' ? 'country' : 'regional'} location. Individual works retain their recorded origin and source details.`
        : 'Choose a glowing place, or use the list above. Colors identify broad geographic regions.';
    const uncertainDates = works.filter(work => (state.place === '__unplaced__' ? !work.placeId : state.place ? work.placeId === state.place : Boolean(work.placeId)) && (!Number.isFinite(work.start) || !Number.isFinite(work.end))).length;
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
    more.hidden = results.length <= state.limit;
    if (!more.hidden) more.firstChild.textContent = `Show more works (${Math.min(state.limit,results.length)} of ${results.length}) `;
    globe?.update({counts,selectedId:place?.id || null});
    root.dataset.selectedPlace = state.place;
    root.dataset.resultCount = String(results.length);
    root.dataset.periodFrom = String(time.start); root.dataset.periodTo = String(time.end);
  }

  function workCard(work) {
    const card = document.createElement('a'); card.className = 'world-work'; card.href = work.url;
    const image = document.createElement('img'); image.src = work.thumbnail; image.alt = work.fullTitle || work.title; image.width = 105; image.height = 128; image.loading = 'lazy'; image.decoding = 'async';
    const copy = document.createElement('div');
    const title = document.createElement('h3'); title.textContent = work.title;
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
  function queueRender() { cancelAnimationFrame(frame); frame = requestAnimationFrame(render); }
  select.addEventListener('change',() => choosePlace(select.value));
  from.addEventListener('input',() => {state.from = Math.min(Number(from.value),state.to);state.limit = initialLimit;queueRender();});
  to.addEventListener('input',() => {state.to = Math.max(Number(to.value),state.from);state.limit = initialLimit;queueRender();});
  more.addEventListener('click',() => {
    const firstNew = state.limit;
    state.limit += 6;render();
    list.children[firstNew]?.focus();
  });
  root.querySelector('[data-world-reset]').addEventListener('click',() => {
    state.place = '';state.from = 0;state.to = 1000;state.limit = initialLimit;
    root.querySelector('[data-world-date-error]').textContent = '';
    globe?.reset();render();
  });
  root.querySelector('[data-world-date-form]').addEventListener('submit',event => {
    event.preventDefault();
    const a = parseWorldYear(fromText.value), b = parseWorldYear(toText.value);
    const error = root.querySelector('[data-world-date-error]');
    if (a === null || b === null) {error.textContent = 'Enter a year with BCE or CE, for example 500 BCE. There is no year zero.';return;}
    if (a > b) {error.textContent = 'The starting date must come before the ending date.';return;}
    if (a < stops[0] || b > stops.at(-1)) {error.textContent = `Choose dates between ${formatWorldYear(stops[0])} and ${formatWorldYear(stops.at(-1))}.`;return;}
    state.from = yearToPosition(a,stops);state.to = yearToPosition(b,stops);state.limit = initialLimit;error.textContent = '';render();
  });
  function setMode(mode) {
    state.mode = mode;
    for (const item of root.querySelectorAll('[data-world-mode]')) item.setAttribute('aria-pressed',String(item.dataset.worldMode === mode));
    root.querySelector('[data-world-map-hint]').textContent = mode === 'globe' ? 'Drag to turn · Select a glowing place' : 'Select a glowing place';
    root.querySelector('[data-world-view-controls]').hidden = mode === 'map';
  }
  for (const button of root.querySelectorAll('[data-world-mode]')) {
    button.addEventListener('click',() => {
      const requested = button.dataset.worldMode;
      setMode(globe?.setMode(requested) === false ? 'map' : requested);
    });
  }
  render();
  try {
    globe = await createWorldGlobe({
      host:root.querySelector('[data-world-globe]'),places,onSelect:choosePlace,
      onReady:info => {setMode(info.mode);if(loading)loading.hidden=true;},
      onError:(error,info) => {setMode(info?.mode || error?.mode || 'map');if(loading)loading.textContent='Choose a place from the list to explore its works.';},
      onZoomChange:info => updateWorldZoomControls(root,info),
      onAutoRotateChange:() => root.dispatchEvent(new Event('world-rotation-change')),
    });
    disconnectControls = connectWorldViewControls(root,globe,root.querySelector('[data-world-viewport]'));
    render();
  } catch {
    if (loading) loading.textContent = 'Choose a place from the list to explore its works.';
  }
  window.addEventListener('pagehide',event => {cancelAnimationFrame(frame);if(!event.persisted){disconnectControls?.();globe?.destroy();}});
}
