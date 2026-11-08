// Catalogue text stays text. No fetched value is interpolated into HTML.
function localPath(value) {
  return typeof value === 'string' && /^\/(?!\/)/.test(value) && !/[\\\u0000-\u001f]/.test(value) ? value : '';
}

export function createCollectionCard(document, data, { spatial = false } = {}) {
  const href = localPath(data?.href);
  const thumbnail = localPath(data?.thumbnail);
  if (!href || !/\/works\/[a-z0-9_/-]+\/$/i.test(href) || !thumbnail || typeof data.title !== 'string' || typeof data.caption !== 'string') throw new Error('Invalid collection card');
  const card = document.createElement('article');
  card.className = 'v3-card';
  card.dataset.v3Card = '';
  for (const key of ['search', 'year', 'wing', 'era', 'place', 'material', 'maker', 'makerLabel', 'size', 'studioPreviewBytes', 'studioPeekAvailable', 'studioIndex', 'studioIngested']) {
    if (data.attributes?.[key] !== undefined && data.attributes[key] !== null) card.dataset[key] = String(data.attributes[key]);
  }
  const link = document.createElement('a');
  link.setAttribute('href', href);
  const image = document.createElement('div');
  image.className = 'v3-card__image v3-float';
  if (/^[a-z0-9_-]+$/i.test(data.id)) image.style.viewTransitionName = `w-${data.id}`;
  const img = document.createElement('img');
  img.setAttribute('src', thumbnail);
  img.alt = data.alt || data.title;
  img.width = 720;
  img.height = 900;
  img.loading = 'lazy';
  img.decoding = 'async';
  image.append(img);
  const copy = document.createElement('div');
  copy.className = 'v3-card__copy';
  const heading = document.createElement('h3');
  heading.textContent = data.caption;
  copy.append(heading);
  if (data.detail) {
    const detail = document.createElement('p');
    detail.textContent = data.detail;
    copy.append(detail);
  }
  link.append(image, copy);
  card.append(link);
  if (spatial && data.spatialLabel) {
    const spatialLink = document.createElement('a');
    spatialLink.className = 'v3-card__spatial-link';
    spatialLink.setAttribute('href', `${href}#ar-vr`);
    spatialLink.setAttribute('aria-label', `View ${data.title} in AR or VR — ${data.spatialLabel}`);
    spatialLink.append(document.createTextNode('View in AR / VR '));
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    spatialLink.append(arrow);
    card.append(spatialLink);
  }
  return card;
}
