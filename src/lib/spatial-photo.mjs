import { stampArtworkPhoto } from './spatial-artwork-label.mjs';

export async function photoCanvasFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const ratio = Math.min(1, 4096 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}

export function bindSpatialPhotos(element, label) {
  const find = (selector) => element.querySelector(selector);
  const panel = find('[data-spatial-photo-panel]');
  const input = find('[data-spatial-photo-input]');
  const result = find('[data-spatial-photo-result]');
  const status = find('[data-spatial-photo-status]');
  const save = find('[data-spatial-photo-save]');
  const share = find('[data-spatial-photo-share]');
  let version = 0, url, file;
  const filename = `atrium-${(label.title || 'artwork').normalize('NFKD').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80) || 'artwork'}.jpg`;
  const show = () => { panel.open = true; panel.scrollIntoView({ block: 'nearest' }); };
  const cancel = () => { version++; };
  const prepare = async (getCanvas) => {
    const current = ++version;
    status.textContent = 'Adding the artwork label…';
    result.hidden = true;
    file = undefined;
    if (url) URL.revokeObjectURL(url);
    url = undefined; save.removeAttribute('href');
    try {
      const canvas = await getCanvas();
      await document.fonts?.ready;
      if (current !== version) return false;
      stampArtworkPhoto(canvas, label);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.94));
      if (current !== version) return false;
      if (!blob) throw new Error('Could not encode photo');
      file = new File([blob], filename, { type: 'image/jpeg' });
      url = URL.createObjectURL(blob);
      find('[data-spatial-photo-preview]').src = url;
      save.href = url; save.download = filename;
      let canShare = false;
      try { canShare = typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] }); } catch {}
      share.hidden = !canShare;
      result.hidden = false;
      status.textContent = 'Label added. Save or share your photo below.';
      return true;
    } catch (error) {
      if (current !== version) return false;
      status.textContent = 'This photo could not be opened. Choose a saved JPEG or PNG and try again.';
      return false;
    }
  };
  find('[data-spatial-photo-choose]').addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const selected = input.files?.[0];
    input.value = '';
    if (selected) { show(); void prepare(() => photoCanvasFromFile(selected)); }
  });
  share.addEventListener('click', () => {
    if (!file) return;
    // Run the share sheet in the user's gesture; encoding has already finished.
    void navigator.share({ files: [file], title: label.title }).catch((error) => {
      if (error?.name !== 'AbortError') status.textContent = 'Sharing is unavailable here. Use Download photo instead.';
    });
  });
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) { cancel(); if (url) URL.revokeObjectURL(url); }
  });
  return { prepare, show, cancel };
}
