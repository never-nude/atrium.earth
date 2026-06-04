import './style.css';
import Box from 'lucide/dist/esm/icons/box.mjs';
import CircleGauge from 'lucide/dist/esm/icons/circle-gauge.mjs';
import Grid2X2 from 'lucide/dist/esm/icons/grid-2x2.mjs';
import LoaderCircle from 'lucide/dist/esm/icons/loader-circle.mjs';
import Search from 'lucide/dist/esm/icons/search.mjs';
import SlidersHorizontal from 'lucide/dist/esm/icons/sliders-horizontal.mjs';
import X from 'lucide/dist/esm/icons/x.mjs';
import catalog from './data/catalog.json';
import previews from './data/previews.json';

const app = document.querySelector('#app');
const heroSlug = 'michelangelo/david';
const pageSize = 48;

const filters = [
  { id: 'all', label: 'All' },
  { id: 'ancient', label: 'Ancient' },
  { id: 'renaissance', label: 'Renaissance' },
  { id: 'americas', label: 'Americas' },
  { id: 'africa', label: 'Africa' },
  { id: 'asia', label: 'Asia' },
];

const state = {
  query: '',
  filter: 'all',
  shown: pageSize,
  modalViewer: null,
};

function icon(nodes, className = 'icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of nodes) {
    const child = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) child.setAttribute(key, value);
    svg.appendChild(child);
  }
  return svg;
}

function periodName(work) {
  if (work.period) return work.period;
  const year = Number(work.year_sort);
  if (Number.isFinite(year) && year < 500) return 'Ancient';
  if (Number.isFinite(year) && year < 1700) return 'Renaissance';
  return 'Modern';
}

function matchesFilter(work) {
  if (state.filter === 'all') return true;
  if (state.filter === 'ancient') return periodName(work).toLowerCase() === 'ancient';
  if (state.filter === 'renaissance') return periodName(work).toLowerCase() === 'renaissance';
  if (state.filter === 'americas') return work.collection?.startsWith('americas');
  if (state.filter === 'africa') return work.collection?.startsWith('sub-saharan-africa');
  if (state.filter === 'asia') return work.collection?.startsWith('asia');
  return true;
}

function filteredWorks() {
  const query = state.query.trim().toLowerCase();
  return catalog.filter((work) => {
    if (!matchesFilter(work)) return false;
    if (!query) return true;
    return work.search.includes(query);
  });
}

function previewFor(work) {
  return previews[work.slug] || null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function posterUrl(work) {
  return `/previews/posters/${work.slug}/poster.svg`;
}

async function loadViewer(container, options) {
  const { attachViewer } = await import('./viewer.js');
  return attachViewer(container, options);
}

function renderShell() {
  app.innerHTML = `
    <header class="site-header">
      <a class="brand" href="/" aria-label="atrium home">
        <span class="brand-mark"></span>
        <span>atrium</span>
      </a>
      <nav class="top-nav" aria-label="Primary">
        <a href="#collection">Collection</a>
        <a href="#rooms">Rooms</a>
      </nav>
    </header>

    <main>
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="eyebrow">atrium.earth</p>
          <h1 id="hero-title">Sculpture after dark.</h1>
          <p class="hero-lede">A nocturnal gallery of marble bodies, bronze myths, saints, fragments, masks, and borrowed moonlight.</p>
          <div class="hero-actions">
            <a class="button button-primary" href="#collection">Enter collection</a>
            <button class="button button-quiet" type="button" data-load-hero>Reveal David</button>
          </div>
        </div>

        <div class="hero-stage" aria-label="Featured preview area">
          <div class="hero-stage__poster" data-hero-poster>
            <span class="poster-kicker">Michelangelo</span>
            <span class="poster-title">David</span>
            <span class="poster-year">1501-1504</span>
          </div>
          <div class="viewer hero-viewer" data-hero-viewer hidden></div>
          <p class="hero-stage__caption">A single figure waits in the dark.</p>
        </div>
      </section>

      <section class="metrics" aria-label="Collection metrics">
        <div class="metric">
          <span class="metric__value">${catalog.length}</span>
          <span class="metric__label">works in the gallery</span>
        </div>
        <div class="metric">
          <span class="metric__value">${Object.keys(previews).length}</span>
          <span class="metric__label">lit for close study</span>
        </div>
        <div class="metric">
          <span class="metric__value">6</span>
          <span class="metric__label">rooms taking shape</span>
        </div>
      </section>

      <section id="collection" class="collection" aria-labelledby="collection-title">
        <div class="section-head">
          <div>
            <p class="eyebrow">The collection</p>
            <h2 id="collection-title">Choose a shadow.</h2>
          </div>
          <div class="search-wrap">
            <label class="sr-only" for="search">Search works</label>
            <div class="search-box">
              <span data-search-icon></span>
              <input id="search" type="search" placeholder="Search title, artist, period" autocomplete="off" />
            </div>
          </div>
        </div>

        <div class="toolbar" aria-label="Collection filters">
          <div class="toolbar-label"><span data-filter-icon></span><span>View</span></div>
          <div class="segments" role="list" data-filters></div>
        </div>

        <div class="result-line" data-result-line></div>
        <div class="grid" data-grid></div>
        <div class="more-row">
          <button class="button button-quiet" type="button" data-show-more>More works</button>
        </div>
      </section>

      <section id="rooms" class="process" aria-labelledby="process-title">
        <div class="section-head">
          <div>
            <p class="eyebrow">Rooms</p>
            <h2 id="process-title">Start with an atmosphere.</h2>
          </div>
        </div>
        <div class="process-grid">
          <article>
            <span data-process-icon-a></span>
            <h3>Antiquity</h3>
            <p>Gods, athletes, votives, broken bodies, and long shadows.</p>
          </article>
          <article>
            <span data-process-icon-b></span>
            <h3>Renaissance</h3>
            <p>Michelangelo, Donatello, saints, prisoners, and unfinished stone.</p>
          </article>
          <article>
            <span data-process-icon-c></span>
            <h3>Elsewhere</h3>
            <p>Masks, posts, bowls, figures, and fragments from wider worlds.</p>
          </article>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <span>atrium.earth</span>
      <span>dream gallery in progress</span>
    </footer>

    <div class="modal" data-modal hidden>
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
        <button class="icon-button modal-close" type="button" data-close-modal aria-label="Close preview"></button>
        <div class="modal-viewer-wrap">
          <div class="viewer modal-viewer" data-modal-viewer></div>
          <div class="modal-loading" data-modal-loading></div>
        </div>
        <aside class="modal-copy">
          <p class="eyebrow" data-modal-period></p>
          <h2 id="modal-title" data-modal-title></h2>
          <dl class="detail-list">
            <div><dt>Artist</dt><dd data-modal-artist></dd></div>
            <div><dt>Date</dt><dd data-modal-year></dd></div>
            <div><dt>Source</dt><dd data-modal-source></dd></div>
            <div><dt>Study</dt><dd data-modal-preview></dd></div>
          </dl>
        </aside>
      </div>
    </div>
  `;

  app.querySelector('[data-search-icon]').append(icon(Search));
  app.querySelector('[data-filter-icon]').append(icon(SlidersHorizontal));
  app.querySelector('[data-process-icon-a]').append(icon(Grid2X2, 'process-icon'));
  app.querySelector('[data-process-icon-b]').append(icon(CircleGauge, 'process-icon'));
  app.querySelector('[data-process-icon-c]').append(icon(Box, 'process-icon'));
  app.querySelector('[data-close-modal]').append(icon(X));
  app.querySelector('[data-modal-loading]').append(icon(LoaderCircle, 'loader-icon'));

  const filterWrap = app.querySelector('[data-filters]');
  for (const filter of filters) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = filter.label;
    button.dataset.filter = filter.id;
    button.className = filter.id === state.filter ? 'segment is-active' : 'segment';
    filterWrap.append(button);
  }
}

function renderCard(work) {
  const ready = previewFor(work);
  const card = document.createElement('article');
  card.className = 'work-card';
  card.classList.toggle('has-preview', Boolean(ready));

  const period = periodName(work);
  card.innerHTML = `
    <button class="work-card__poster" type="button" data-open-work="${escapeHtml(work.slug)}">
      <img src="${escapeHtml(posterUrl(work))}" alt="${escapeHtml(work.title)}" loading="lazy" decoding="async">
      <span class="work-card__index">${String(work.index).padStart(3, '0')}</span>
      <span class="work-card__period">${escapeHtml(period)}</span>
    </button>
    <div class="work-card__body">
      <div>
        <h3>${escapeHtml(work.title)}</h3>
        <p>${escapeHtml(work.artist || work.source_institution || 'Open collection')}${work.year ? ` · ${escapeHtml(work.year)}` : ''}</p>
      </div>
    </div>
  `;
  return card;
}

function renderGrid() {
  const works = filteredWorks();
  const shownWorks = works.slice(0, state.shown);
  const grid = app.querySelector('[data-grid]');
  const resultLine = app.querySelector('[data-result-line]');
  const more = app.querySelector('[data-show-more]');

  grid.innerHTML = '';
  resultLine.textContent = `${works.length} works`;
  for (const work of shownWorks) grid.append(renderCard(work));

  more.hidden = works.length <= state.shown;
}

async function loadHero() {
  const work = catalog.find((item) => item.slug === heroSlug);
  const preview = work && previewFor(work);
  const poster = app.querySelector('[data-hero-poster]');
  const viewer = app.querySelector('[data-hero-viewer]');
  const button = app.querySelector('[data-load-hero]');

  if (!preview || viewer.dataset.loaded) return;
  button.disabled = true;
  button.textContent = 'Revealing';
  viewer.hidden = false;
  poster.hidden = true;
  await loadViewer(viewer, {
    modelUrl: preview.url,
    spin: true,
    interactive: false,
    spinSpeed: 0.004,
    cameraPadding: 2.65,
    verticalBias: -0.35,
  });
  viewer.dataset.loaded = 'true';
  button.textContent = 'David revealed';
}

async function openWork(slug) {
  const work = catalog.find((item) => item.slug === slug);
  if (!work) return;
  const preview = previewFor(work);
  const modal = app.querySelector('[data-modal]');
  const panel = app.querySelector('.modal-panel');
  const viewer = app.querySelector('[data-modal-viewer]');
  const loading = app.querySelector('[data-modal-loading]');

  app.querySelector('[data-modal-period]').textContent = periodName(work);
  app.querySelector('[data-modal-title]').textContent = work.title;
  app.querySelector('[data-modal-artist]').textContent = work.artist || 'unknown';
  app.querySelector('[data-modal-year]').textContent = work.year || 'undated';
  app.querySelector('[data-modal-source]').textContent = work.source_institution || 'open source record';
  app.querySelector('[data-modal-preview]').textContent = preview ? '3D preview ready' : 'Preview queued';

  modal.hidden = false;
  panel.focus();
  viewer.innerHTML = '';
  loading.hidden = !preview;

  if (state.modalViewer?.dispose) state.modalViewer.dispose();
  state.modalViewer = null;

  if (preview) {
    state.modalViewer = await loadViewer(viewer, {
      modelUrl: preview.url,
      spin: true,
      interactive: true,
      spinSpeed: 0.0025,
      cameraPadding: 3.8,
      verticalBias: -0.28,
    });
  } else {
    viewer.innerHTML = '<div class="modal-placeholder">Preview asset queued</div>';
  }
  loading.hidden = true;
}

function closeModal() {
  const modal = app.querySelector('[data-modal]');
  if (state.modalViewer?.dispose) state.modalViewer.dispose();
  state.modalViewer = null;
  modal.hidden = true;
}

function bindEvents() {
  app.querySelector('#search').addEventListener('input', (event) => {
    state.query = event.currentTarget.value;
    state.shown = pageSize;
    renderGrid();
  });

  app.querySelector('[data-filters]').addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.filter = button.dataset.filter;
    state.shown = pageSize;
    for (const segment of app.querySelectorAll('.segment')) {
      segment.classList.toggle('is-active', segment.dataset.filter === state.filter);
    }
    renderGrid();
  });

  app.querySelector('[data-grid]').addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-work]');
    if (!button) return;
    openWork(button.dataset.openWork);
  });

  app.querySelector('[data-show-more]').addEventListener('click', () => {
    state.shown += pageSize;
    renderGrid();
  });

  app.querySelector('[data-load-hero]').addEventListener('click', loadHero);
  app.querySelector('[data-close-modal]').addEventListener('click', closeModal);
  app.querySelector('[data-modal]').addEventListener('click', (event) => {
    if (event.target.matches('[data-modal]')) closeModal();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
}

renderShell();
renderGrid();
bindEvents();
