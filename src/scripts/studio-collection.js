import { legacyWingRoutes } from '../data/wing-legacy-routes';
import { withBase } from '../lib/urls';
import { COLLECTION_PAGE_SIZE, COLLECTION_FILTER_KEYS, normalizeCollectionText, unpackCollectionIndex, readCollectionState, writeCollectionState, selectCollectionWindow, collectionPageNumber } from '../lib/collection-window.mjs';
import { createCollectionCard } from '../lib/collection-card.mjs';
import { groupMakerFacet } from '../lib/maker-groups.mjs';

// Framed miniatures reuse one native viewer and never create collection tools or nested frames.
const isStudioPeek = window.parent !== window && new URLSearchParams(location.search).get('studio-peek') === '1';
if (!isStudioPeek && !document.documentElement.classList.contains('studio-peek')) {
// Collection enhancements preserve the native work viewer and its model settings.
const STORAGE_KEY = 'atrium-studio-saved-v1';
const PAGE_SIZE = COLLECTION_PAGE_SIZE;
const FILTER_KEYS = COLLECTION_FILTER_KEYS;
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const saveButtons = new Map();
const explorers = [];
let controlId = 0;
let activePeek = null;
let peekOpenTimer = 0;
let peekCloseTimer = 0;
let peekPendingCard = null;
let storageAvailable = true;
let saved = readSaved();
let enhancePeekCards = () => {};

function normalize(value) {
  return normalizeCollectionText(value);
}

function workPath(value) {
  try {
    const url = new URL(value, location.origin);
    if (url.origin !== location.origin || !url.pathname.startsWith('/works/') || url.pathname === '/works/') return '';
    return `${url.pathname.replace(/\/+$/, '')}/`;
  } catch { return ''; }
}

function readSaved() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return new Set(Array.isArray(value) ? value.filter(item => typeof item === 'string').map(workPath).filter(Boolean) : []);
  } catch {
    storageAvailable = false;
    return new Set();
  }
}

function announce(message) {
  let region = document.querySelector('[data-studio-announcement]');
  if (!region) {
    region = document.createElement('p');
    region.className = 'studio-announcement v3-sr-only';
    region.dataset.studioAnnouncement = '';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  region.textContent = message;
}

function icon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4Z');
  svg.append(path);
  return svg;
}

function updateSavedUI() {
  for (const [pathname, buttons] of saveButtons) {
    const isSaved = saved.has(pathname);
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(isSaved));
      button.setAttribute('aria-label', `${isSaved ? 'Remove' : 'Save'} ${button.dataset.studioWorkTitle}${isSaved ? ' from saved works' : ''}`);
      button.title = isSaved ? 'Remove from saved works' : 'Save this work on this browser';
      button.querySelector('.studio-save-label').textContent = isSaved ? 'Saved' : 'Save';
    }
  }
  for (const count of document.querySelectorAll('[data-studio-saved-count]')) count.textContent = String(saved.size);
}

function addSaveButton(container, pathname, title, objectPage = false) {
  if (!pathname) return;
  const existing = container.querySelector(':scope > [data-studio-save]');
  if (existing) {
    if (!saveButtons.has(pathname)) saveButtons.set(pathname, new Set());
    saveButtons.get(pathname).add(existing);
    return;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `studio-save${objectPage ? ' studio-save--object' : ''}`;
  button.dataset.studioSave = pathname;
  button.dataset.studioWorkTitle = title || 'this work';
  const label = document.createElement('span');
  label.className = 'studio-save-label';
  button.append(icon(), label);
  if (objectPage) container.insertBefore(button, container.querySelector('.v3-object-nav'));
  else container.append(button);
  if (!saveButtons.has(pathname)) saveButtons.set(pathname, new Set());
  saveButtons.get(pathname).add(button);
}

for (const card of document.querySelectorAll('[data-v3-card]')) {
  const link = card.querySelector('a[href]');
  if (link) addSaveButton(card, workPath(link.href), card.querySelector('h3')?.textContent?.trim());
}
const objectActions = document.querySelector('.v3-object-actions');
if (objectActions) addSaveButton(objectActions, workPath(location.href), document.querySelector('h1')?.textContent?.trim(), true);

document.addEventListener('click', event => {
  const button = event.target instanceof Element ? event.target.closest('[data-studio-save]') : null;
  if (!button) return;
  const pathname = button.dataset.studioSave;
  if (!pathname) return;
  const wasSaved = saved.has(pathname);
  if (wasSaved) saved.delete(pathname); else saved.add(pathname);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...saved]));
    storageAvailable = true;
  } catch { storageAvailable = false; }
  updateSavedUI();
  for (const explorer of explorers) explorer.refreshSaved();
  announce(`${wasSaved ? 'Removed from saved works.' : 'Work saved.'}${storageAvailable ? ' Saved works are stored on this browser.' : ' Browser storage is unavailable; this change lasts for this visit.'}`);
  if (button.closest('[data-v3-card]')?.hidden) document.querySelector('[data-studio-saved-toggle]')?.focus();
});

window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  saved = readSaved();
  updateSavedUI();
  for (const explorer of explorers) explorer.refreshSaved();
});

function selectControl(labelText, className, dataKey, options) {
  const label = document.createElement('label');
  label.className = className;
  const span = document.createElement('span');
  span.textContent = labelText;
  const select = document.createElement('select');
  select.id = `studio-collection-control-${++controlId}`;
  label.htmlFor = select.id;
  select.dataset[dataKey] = '';
  for (const [value, text] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.append(option);
  }
  label.append(span, select);
  return { label, select };
}

async function initializeExplorer(explorer) {
  const form = explorer.querySelector('[data-v3-filter-form]');
  const search = explorer.querySelector('[data-v3-search]');
  const grid = explorer.querySelector('[data-v3-grid]');
  const count = explorer.querySelector('[data-v3-count]');
  const empty = explorer.querySelector('[data-v3-empty]');
  if (!form || !search || !grid || !count || !empty) return;
  const filters = [...form.querySelectorAll('[data-v3-filter]')];
  const initialCards = [...grid.querySelectorAll('[data-v3-card]')];
  let records = initialCards.map((card, index) => {
    const title = card.querySelector('h3')?.textContent?.trim() || '';
    const makerLabel = card.dataset.makerLabel || card.querySelector('.v3-card__copy p')?.textContent?.split('·')[0]?.trim() || '';
    const rawYear = card.dataset.year?.trim();
    const rawIndex = Number(card.dataset.studioIndex);
    return { card, index, catalogIndex: Number.isFinite(rawIndex) && rawIndex > 0 ? rawIndex : index, ingested: card.dataset.studioIngested || '', title, makerLabel, maker: card.dataset.maker || '', year: rawYear && Number.isFinite(Number(rawYear)) ? Number(rawYear) : null,
      search: normalize(`${card.dataset.search || ''} ${title} ${makerLabel}`), pathname: workPath(card.querySelector('a[href]')?.href || ''),
      facets: Object.fromEntries(FILTER_KEYS.map(key => [key, card.dataset[key] || ''])) };
  });
  const status = explorer.querySelector('[data-studio-index-status]');
  const pagination = explorer.querySelector('[data-studio-pagination]');
  const indexURL = explorer.dataset.studioIndexUrl;
  const cardData = new Map();
  const chunkRequests = new Map();
  let mountedCards = new Map(records.map(record => [record.pathname, record.card]));
  const originalCards = indexURL ? new Map() : new Map(mountedCards);
  if (indexURL) {
    if (status) { status.hidden = false; status.textContent = 'Preparing search across the collection…'; }
    try {
      const response = await fetch(indexURL, { credentials: 'same-origin', cache: 'no-cache' });
      if (!response.ok) throw new Error('Collection index unavailable');
      const payload = await response.json();
      if (payload.revision !== explorer.dataset.studioRevision) throw new Error('Collection edition changed');
      records = unpackCollectionIndex(payload).filter(record => explorer.dataset.studioSpatial !== 'true' || Boolean(record.size));
      for (const record of records) record.pathname = workPath(withBase(`/works/${record.slug}/`));
    } catch {
      if (status) {
        status.hidden = false;
        status.textContent = 'Search could not load. You can still open the works below and continue using the page links. ';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Retry search';
        retry.addEventListener('click', () => initializeExplorer(explorer), { once: true });
        status.append(retry);
      }
      return;
    }
  }
  for (const control of form.querySelectorAll('input, select, button')) control.disabled = false;
  async function ensureCards(selected) {
    const chunks = new Set(selected.filter(record => !mountedCards.has(record.pathname) && !originalCards.has(record.pathname) && !cardData.has(record.pathname)).map(record => record.chunk));
    await Promise.all([...chunks].map(chunk => {
      if (!chunkRequests.has(chunk)) {
        const request = fetch(`${explorer.dataset.studioChunkRoot}${chunk}.json?v=${encodeURIComponent(explorer.dataset.studioRevision)}`, { credentials: 'same-origin', cache: 'no-cache' }).then(async response => {
          if (!response.ok) throw new Error('Card details unavailable');
          const payload = await response.json();
          if (payload?.version !== 1 || payload.revision !== explorer.dataset.studioRevision || payload.chunk !== chunk || !Array.isArray(payload.cards)) throw new Error('Invalid card details');
          for (const card of payload.cards) {
            const pathname = workPath(card.href);
            if (!pathname) throw new Error('Invalid work identity');
            cardData.set(pathname, card);
          }
        }).catch(error => { chunkRequests.delete(chunk); throw error; });
        chunkRequests.set(chunk, request);
      }
      return chunkRequests.get(chunk);
    }));
  }
  const makers = new Map();
  for (const record of records) if (record.maker) {
    const group = groupMakerFacet(record.maker,record.makerLabel || record.maker.replace(/-/g,' '));
    if (!makers.has(group.value)) makers.set(group.value,group.label);
  }
  const makerControl = selectControl('Maker', 'studio-maker', 'studioMaker', [['', 'All makers'], ...[...makers].sort((a, b) => collator.compare(a[1], b[1]))]);
  const sortControl = selectControl('Sort', 'studio-sort', 'studioSort', [['curator', 'Curator’s order'], ['title', 'Title A–Z'], ['maker', 'Maker A–Z'], ['date', 'Date: earliest first'], ['newest', 'Recently added']]);
  const filterRow = form.querySelector('.v3-filter-row') || form;
  filterRow.prepend(makerControl.label);
  if (filterRow !== form) {
    const filterPanel = document.createElement('details');
    filterPanel.className = 'studio-filter-panel';
    const filterSummary = document.createElement('summary');
    filterSummary.textContent = 'Filter works';
    filterRow.before(filterPanel);
    filterPanel.append(filterSummary, filterRow);
    const desktopFilters = matchMedia('(min-width: 701px)');
    filterPanel.open = desktopFilters.matches;
    desktopFilters.addEventListener('change', () => { filterPanel.open = desktopFilters.matches; });
  }
  const controls = document.createElement('div');
  controls.className = 'studio-view-controls';
  const densityGroup = document.createElement('div');
  densityGroup.className = 'studio-density-controls';
  densityGroup.setAttribute('role', 'group');
  densityGroup.setAttribute('aria-label', 'Collection density');
  const densityButtons = ['grid', 'compact'].map(value => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'studio-view-button';
    button.dataset.studioDensityButton = value;
    button.textContent = value === 'grid' ? 'Gallery grid' : 'Compact grid';
    densityGroup.append(button);
    return button;
  });
  const savedToggle = document.createElement('button');
  savedToggle.type = 'button';
  savedToggle.className = 'studio-view-button';
  savedToggle.dataset.studioSavedToggle = '';
  savedToggle.textContent = 'Saved only';
  savedToggle.title = 'Show works saved on this browser';
  controls.append(count, sortControl.label, densityGroup, savedToggle);
  form.append(controls);
  count.classList.add('studio-collection-status');
  count.setAttribute('role', 'status');
  count.setAttribute('aria-live', 'polite');
  count.setAttribute('aria-atomic', 'true');
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'studio-load-more';
  more.dataset.studioLoadMore = '';
  grid.after(more);
  let density = 'grid';
  let savedOnly = false;
  let limit = PAGE_SIZE;
  let offset = (collectionPageNumber(location.pathname) - 1) * PAGE_SIZE;
  let timer = 0;
  let renderRequest = 0;
  let lastRenderFailed = false;
  let legacyWingNotice = null;

  function explainLegacyWings(params) {
    legacyWingNotice?.remove();
    legacyWingNotice = null;
    const retiredIds = [...new Set(params.getAll('wing'))].filter(id => Object.hasOwn(legacyWingRoutes, id));
    if (!retiredIds.length) return false;
    // A historical entrance can span several continents. Clear the ambiguous
    // filter rather than silently selecting one of its modern destinations.
    params.delete('wing');
    const suffix = params.toString();
    history.replaceState(history.state, '', `${location.pathname}${suffix ? `?${suffix}` : ''}${location.hash}`);
    const notice = document.createElement('aside');
    notice.dataset.studioLegacyWing = '';
    notice.setAttribute('aria-label', 'Updated wing navigation');
    Object.assign(notice.style, { marginBlock: '0 20px', padding: '16px', border: '1px solid var(--v3-line, #c9c9c9)', lineHeight: '1.6', fontSize: '14px' });
    const heading = document.createElement('strong');
    heading.textContent = 'The wings have changed';
    notice.append(heading);
    for (const id of retiredIds) {
      const explanation = document.createElement('p');
      explanation.style.marginBlock = '8px';
      explanation.textContent = legacyWingRoutes[id].line.replace('Choose a regional wing below', 'Choose a regional wing');
      notice.append(explanation);
    }
    const cleared = document.createElement('p');
    cleared.style.marginBlock = '8px';
    cleared.textContent = `${retiredIds.length === 1 ? 'The retired wing filter has' : 'The retired wing filters have'} been cleared. Your other filters remain in place.`;
    notice.append(cleared);
    const links = document.createElement('nav');
    links.setAttribute('aria-label', 'Related wing entrances');
    Object.assign(links.style, { display: 'flex', flexWrap: 'wrap', gap: '8px 20px' });
    const wingSelect = filters.find(select => select.dataset.v3Filter === 'wing');
    for (const id of new Set(retiredIds.flatMap(id => legacyWingRoutes[id].destinations))) {
      const link = document.createElement('a');
      link.href = withBase(`/wings/${id}/`);
      link.textContent = [...(wingSelect?.options || [])].find(option => option.value === id)?.textContent || id;
      links.append(link);
    }
    for (const id of retiredIds) {
      const link = document.createElement('a');
      link.href = withBase(`/wings/${id}/`);
      link.textContent = `About the former ${legacyWingRoutes[id].name} wing`;
      links.append(link);
    }
    notice.append(links);
    form.before(notice);
    legacyWingNotice = notice;
    return true;
  }

  function readURL() {
    const params = new URLSearchParams(location.search);
    const retiredWing = explainLegacyWings(params);
    const state = readCollectionState(params);
    search.value = state.q;
    makerControl.select.value = groupMakerFacet(state.maker,'').value;
    for (const select of filters) select.value = state[select.dataset.v3Filter] || '';
    sortControl.select.value = state.sort;
    savedOnly = state.saved;
    density = state.density;
    limit = PAGE_SIZE;
    const refined = state.q || state.maker || state.saved || state.sort !== 'curator' || FILTER_KEYS.some(key => state[key]);
    offset = refined ? 0 : (collectionPageNumber(location.pathname) - 1) * PAGE_SIZE;
    return retiredWing;
  }

  function currentState() {
    return { q: search.value, maker: makerControl.select.value, ...Object.fromEntries(filters.map(select => [select.dataset.v3Filter, select.value])), sort: sortControl.select.value, saved: savedOnly, density };
  }

  function writeURL() {
    const params = writeCollectionState(location.search, currentState());
    const suffix = params.toString();
    const pathname = offset ? location.pathname : explorer.dataset.studioEntrance || location.pathname;
    history.replaceState(history.state, '', `${pathname}${suffix ? `?${suffix}` : ''}${location.hash}`);
    syncCollectionLinks(suffix);
  }

  function syncCollectionLinks(suffix) {
    for (const link of explorer.querySelectorAll('[data-v3-collection-view]')) {
      const url = new URL(link.href, location.href);
      url.search = suffix;
      link.href = url.href;
    }
  }

  async function render(updateURL = true) {
    const request = ++renderRequest;
    const result = selectCollectionWindow(records, currentState(), { saved, offset, limit });
    if (updateURL) writeURL();
    else syncCollectionLinks(new URLSearchParams(location.search).toString());
    const missing = result.records.some(record => !mountedCards.has(record.pathname));
    if (missing) {
      grid.setAttribute('aria-busy', 'true');
      more.disabled = true;
      if (status) { status.hidden = false; status.textContent = 'Loading matching works…'; }
    }
    try {
      await ensureCards(result.records);
      if (request !== renderRequest) return;
      // Create all new cards before replacing anything, retaining the readable
      // current page if a partial network response is missing or malformed.
      const nextCards = new Map(result.records.map(record => [record.pathname, mountedCards.get(record.pathname) || originalCards.get(record.pathname) || createCollectionCard(document, cardData.get(record.pathname), { spatial: explorer.dataset.studioSpatial === 'true' })]));
      const focusedCard = document.activeElement instanceof Element ? document.activeElement.closest('[data-v3-card]') : null;
      const focusedPath = focusedCard && grid.contains(focusedCard) ? workPath(focusedCard.querySelector('a[href]')?.href || '') : '';
      if (activePeek && !nextCards.has(workPath(activePeek.card.querySelector('a[href]')?.href || ''))) closePeek();
      for (const [pathname, card] of mountedCards) if (!nextCards.has(pathname)) card.remove();
      if (focusedPath && !nextCards.has(focusedPath)) savedToggle.focus();
      let index = 0;
      for (const [pathname, card] of nextCards) {
        if (grid.children[index] !== card) {
          if (activePeek?.card === card) closePeek();
          grid.insertBefore(card, grid.children[index] || null);
        }
        addSaveButton(card, pathname, card.querySelector('h3')?.textContent?.trim());
        index += 1;
      }
      mountedCards = nextCards;
      // Detached cards are discarded; metadata and JSON, rather than thousands
      // of DOM nodes or save-button references, are the long-lived cache.
      for (const [pathname, buttons] of saveButtons) {
        for (const button of buttons) if (!button.isConnected) buttons.delete(button);
        if (!buttons.size) saveButtons.delete(pathname);
      }
      enhancePeekCards(grid);
      updateSavedUI();
      if (pagination) pagination.hidden = true;
      if (status) status.hidden = true;
      lastRenderFailed = false;
    } catch {
      if (request !== renderRequest) return;
      for (const record of result.records) if (!mountedCards.has(record.pathname) && !originalCards.has(record.pathname)) {
        cardData.delete(record.pathname);
        chunkRequests.delete(record.chunk);
      }
      if (status) { status.hidden = false; status.textContent = 'These results could not load. Your current works are still available. Try again, or continue with the page links below.'; }
      if (pagination) pagination.hidden = false;
      more.hidden = false;
      more.disabled = false;
      more.textContent = 'Retry loading results';
      lastRenderFailed = true;
      grid.removeAttribute('aria-busy');
      return;
    }
    grid.removeAttribute('aria-busy');
    more.disabled = false;
    const matches = result.total;
    const shown = result.records.length;
    const range = offset ? `${(offset + 1).toLocaleString()}–${(offset + shown).toLocaleString()}` : shown.toLocaleString();
    const message = matches ? `Showing ${range} of ${matches.toLocaleString()} ${matches === 1 ? 'work' : 'works'}${savedOnly ? ' saved on this browser' : ''}` : savedOnly ? 'No saved works match these filters.' : 'No works match these filters.';
    if (count.textContent !== message) count.textContent = message;
    grid.hidden = matches === 0;
    empty.hidden = matches !== 0;
    more.hidden = !result.hasMore;
    more.textContent = `Show ${Math.min(PAGE_SIZE, Math.max(0, matches - offset - shown))} more works`;
    explorer.dataset.studioDensity = density;
    for (const button of densityButtons) button.setAttribute('aria-pressed', String(button.dataset.studioDensityButton === density));
    savedToggle.setAttribute('aria-pressed', String(savedOnly));
    const emptyHeading = empty.querySelector('strong');
    const emptyText = empty.querySelector('p');
    if (emptyHeading) emptyHeading.textContent = savedOnly && saved.size === 0 ? 'Your saved collection starts here.' : 'No matching works.';
    if (emptyText) emptyText.textContent = savedOnly && saved.size === 0 ? 'Save a work with its bookmark button, then return here. Saved works stay on this browser.' : 'Try a broader search or clear the filters to explore the collection.';
    explorer.dispatchEvent(new CustomEvent('atrium:collection-rendered', { bubbles: true }));
  }

  function update() { window.clearTimeout(timer); limit = PAGE_SIZE; offset = 0; render(); }
  search.addEventListener('input', () => { renderRequest += 1; window.clearTimeout(timer); timer = window.setTimeout(update, 120); });
  for (const select of [...filters, makerControl.select, sortControl.select]) select.addEventListener('change', update);
  for (const button of densityButtons) button.addEventListener('click', () => { density = button.dataset.studioDensityButton; render(); });
  savedToggle.addEventListener('click', () => { savedOnly = !savedOnly; update(); });
  more.addEventListener('click', () => { if (!lastRenderFailed) limit += PAGE_SIZE; render(); });
  form.addEventListener('submit', event => { event.preventDefault(); update(); });
  form.addEventListener('reset', event => {
    event.preventDefault();
    search.value = '';
    for (const select of [...filters, makerControl.select]) select.value = '';
    sortControl.select.value = 'curator';
    density = 'grid';
    savedOnly = false;
    update();
  });
  explorer.querySelector('[data-v3-empty-reset]')?.addEventListener('click', () => { form.reset(); search.focus(); });
  window.addEventListener('popstate', () => { window.clearTimeout(timer); readURL(); render(false); });
  explorers.push({ refreshSaved() { if (savedOnly) render(false); } });
  const retiredWing = readURL();
  render(!retiredWing);
}

for (const explorer of document.querySelectorAll('[data-studio-explorer]')) initializeExplorer(explorer);
updateSavedUI();

function initializeGlobalSearch() {
  const dialog = document.createElement('dialog');
  dialog.className = 'studio-search-dialog';
  dialog.dataset.studioSearchDialog = '';
  dialog.setAttribute('aria-labelledby', 'studio-search-title');
  const heading = document.createElement('h2');
  heading.id = 'studio-search-title';
  heading.textContent = 'Search the collection';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'studio-search-close';
  close.setAttribute('aria-label', 'Close search');
  close.textContent = '×';
  const form = document.createElement('form');
  form.className = 'studio-search-form';
  form.action = '/collection/';
  form.method = 'get';
  const label = document.createElement('label');
  label.className = 'v3-sr-only';
  label.htmlFor = 'studio-global-search';
  label.textContent = 'Search works, makers and places';
  const input = document.createElement('input');
  input.type = 'search';
  input.name = 'q';
  input.id = 'studio-global-search';
  input.placeholder = 'Works, makers, places…';
  input.autocomplete = 'off';
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Search';
  const hint = document.createElement('p');
  hint.className = 'studio-search-hint';
  hint.textContent = 'Search titles, artists, places and materials. Press Esc to close.';
  form.append(label, input, submit);
  dialog.append(close, heading, form, hint);
  document.body.append(dialog);
  let previousFocus = null;
  function open() {
    if (dialog.open) { input.focus(); return; }
    previousFocus = document.activeElement;
    input.value = document.querySelector('[data-v3-search]')?.value || new URLSearchParams(location.search).get('q') || '';
    dialog.showModal();
    input.focus();
    input.select();
  }
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    dialog.close();
  });
  dialog.addEventListener('close', () => { if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const destination = new URL('/collection/', location.origin);
    if (input.value.trim()) destination.searchParams.set('q', input.value.trim());
    location.assign(destination.href);
  });
  document.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('[data-studio-search]')) { event.preventDefault(); open(); }
  });
  document.addEventListener('keydown', event => {
    if (event.repeat || event.altKey) return;
    const command = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    const typing = event.target instanceof Element && Boolean(event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'));
    if (command || (event.key === '/' && !event.metaKey && !event.ctrlKey && !typing && !document.querySelector('dialog[open]'))) {
      event.preventDefault();
      open();
    }
  });
}

initializeGlobalSearch();

function closePeek() {
  window.clearTimeout(peekCloseTimer);
  if (!activePeek) return;
  window.clearTimeout(activePeek.timeout);
  activePeek.frame.remove();
  activePeek.card.classList.remove('is-studio-peeking', 'is-studio-live');
  activePeek.button.setAttribute('aria-pressed', 'false');
  activePeek = null;
}

function initializePeeks() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hoverPointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const automaticAllowed = () => hoverPointer.matches && !reducedMotion.matches && !navigator.connection?.saveData;
  function cancelScheduled() {
    window.clearTimeout(peekOpenTimer);
    peekPendingCard = null;
  }
  function fail(request) {
    if (activePeek !== request) return;
    const explicit = request.pinned;
    closePeek();
    if (explicit) announce('This miniature is unavailable. Open the work to explore its full 3D view.');
  }
  function mount(card, button, image, work, title, explicit = false) {
    cancelScheduled();
    window.clearTimeout(peekCloseTimer);
    if (card.hidden) return;
    if (activePeek?.card === card && (!explicit || activePeek.ready || activePeek.pinned)) {
      if (explicit) activePeek.pinned = true;
      return;
    }
    closePeek();
    const frame = document.createElement('iframe');
    frame.className = 'studio-peek-frame';
    frame.title = `${title} — 3D miniature`;
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.style.pointerEvents = 'none';
    const link = card.querySelector('a[href]');
    const url = new URL(link.href, location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('studio-peek', '1');
    if (explicit) url.searchParams.set('intent', 'explicit');
    frame.src = url.href;
    const request = { card, button, frame, work, pinned: explicit, ready: false, timeout: 0 };
    activePeek = request;
    card.classList.add('is-studio-peeking');
    button.setAttribute('aria-pressed', 'true');
    frame.addEventListener('error', () => fail(request), { once: true });
    image.append(frame);
    request.timeout = window.setTimeout(() => { if (!request.ready) fail(request); }, 20000);
  }
  function leave(card) {
    if (peekPendingCard === card) cancelScheduled();
    if (activePeek?.card !== card || activePeek.pinned) return;
    window.clearTimeout(peekCloseTimer);
    peekCloseTimer = window.setTimeout(() => {
      if (activePeek?.card === card && !activePeek.pinned && !card.matches(':hover') && !card.contains(document.activeElement)) closePeek();
    }, 200);
  }
  function enhance(root = document) {
  for (const card of root.querySelectorAll('[data-v3-card]')) {
    const image = card.querySelector('.v3-card__image');
    const link = card.querySelector('a[href]');
    const pathname = workPath(link?.href || '');
    if (!image || !pathname || card.dataset.studioPeekAvailable === 'false' || card.querySelector(':scope > .studio-peek-trigger')) continue;
    const previewBytes = Number(card.dataset.studioPreviewBytes);
    const withinAutomaticBudget = Number.isFinite(previewBytes) && previewBytes > 0 && previewBytes <= 8 * 1024 * 1024;
    let work;
    try { work = decodeURIComponent(pathname.slice('/works/'.length).replace(/\/$/, '')); } catch { continue; }
    const title = card.querySelector('h3')?.textContent?.trim() || 'this work';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'studio-peek-trigger';
    button.setAttribute('aria-label', `Preview ${title} in 3D`);
    button.setAttribute('aria-pressed', 'false');
    button.title = 'Preview in 3D; select again to close';
    button.textContent = '3D';
    card.append(button);
    const label = document.createElement('span');
    label.className = 'studio-peek-label';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = 'Explore in 3D ↗';
    image.append(label);
    function schedule() {
      window.clearTimeout(peekCloseTimer);
      if (!automaticAllowed() || !withinAutomaticBudget || activePeek?.card === card || peekPendingCard === card) return;
      cancelScheduled();
      peekPendingCard = card;
      peekOpenTimer = window.setTimeout(() => {
        peekPendingCard = null;
        if (automaticAllowed() && withinAutomaticBudget && !card.hidden && (card.matches(':hover') || card.contains(document.activeElement))) mount(card, button, image, work, title);
      }, 350);
    }
    card.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') schedule(); });
    card.addEventListener('pointerleave', () => leave(card));
    card.addEventListener('focusin', schedule);
    card.addEventListener('focusout', event => { if (!card.contains(event.relatedTarget)) leave(card); });
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      cancelScheduled();
      if (activePeek?.card === card && activePeek.pinned) closePeek();
      else mount(card, button, image, work, title, true);
    });
  }
  }
  enhancePeekCards = enhance;
  enhance();
  window.addEventListener('message', event => {
    const request = activePeek;
    if (!request || event.origin !== location.origin || event.source !== request.frame.contentWindow || !event.data || typeof event.data !== 'object' || event.data.work !== request.work) return;
    if (event.data.type === 'atrium-studio-peek-unavailable') { fail(request); return; }
    if (event.data.type !== 'atrium-studio-peek-ready') return;
    request.ready = true;
    window.clearTimeout(request.timeout);
    request.frame.classList.add('is-ready');
    request.card.classList.add('is-studio-live');
  });
  reducedMotion.addEventListener('change', () => { cancelScheduled(); if (reducedMotion.matches && activePeek && !activePeek.pinned) closePeek(); });
  navigator.connection?.addEventListener('change', () => { if (navigator.connection.saveData) { cancelScheduled(); if (activePeek && !activePeek.pinned) closePeek(); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !document.querySelector('dialog[open]')) { cancelScheduled(); closePeek(); } });
  window.addEventListener('pagehide', () => { cancelScheduled(); closePeek(); });
}

initializePeeks();

}
