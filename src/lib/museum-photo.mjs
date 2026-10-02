import { captionMuseumPhoto } from './museum-label.mjs';

export async function museumPhotoFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    // Image.decode applies the photo's EXIF orientation before canvas drawing.
    await image.decode();
    const ratio = Math.min(1, 4096 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}

export function bindMuseumPhotos(element, label) {
  const find = selector => element.querySelector(selector);
  const dialog = find('[data-spatial-dialog]');
  const panel = find('.spatial-panel');
  const editor = find('[data-museum-photo-editor]');
  const input = find('[data-museum-photo-input]');
  const preview = find('[data-museum-photo-preview]');
  const status = find('[data-museum-photo-status]');
  const result = find('[data-museum-photo-result]');
  const save = find('[data-museum-photo-save]');
  const share = find('[data-museum-photo-share]');
  const positions = [...element.querySelectorAll('[data-museum-photo-position]')];
  let source, outputFile, outputUrl, version = 0, corner = 'left';
  const filename = `atrium-${(label.title || 'artwork').normalize('NFKD').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80) || 'artwork'}.jpg`;
  const clearOutput = () => {
    result.hidden = true; save.hidden = true; share.hidden = true; outputFile = undefined;
    preview.removeAttribute('src'); save.removeAttribute('href');
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = undefined;
  };
  const render = async () => {
    if (!source) return;
    const current = ++version;
    clearOutput(); status.textContent = 'Preparing your labeled photo…';
    positions.forEach(button => { button.disabled = false; button.setAttribute('aria-pressed', String(button.dataset.museumPhotoPosition === corner)); });
    try {
      await document.fonts?.ready;
      if (current !== version || !source) return;
      const canvas = captionMuseumPhoto(source, label, corner);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .95));
      if (current !== version) return;
      if (!blob) throw new Error('Could not encode image');
      outputFile = new File([blob], filename, { type: 'image/jpeg' });
      outputUrl = URL.createObjectURL(blob);
      preview.src = outputUrl; save.href = outputUrl; save.download = filename;
      let canShare = false;
      try { canShare = Boolean(navigator.share && navigator.canShare?.({ files: [outputFile] })); } catch {}
      share.hidden = !canShare; result.hidden = false; save.hidden = false;
      status.textContent = 'Ready. Your original photo stays unchanged.';
    } catch {
      if (current === version) { clearOutput(); status.textContent = 'This photo could not be prepared. Try another photo.'; }
    }
  };
  const close = () => {
    version++; source = undefined; clearOutput();
    editor.hidden = true; panel.hidden = false;
    dialog.classList.remove('is-photo-editor');
  };
  for (const button of element.querySelectorAll('[data-museum-photo-choose]')) {
    button.addEventListener('click', () => input.click());
  }
  input.addEventListener('change', () => {
    const file = input.files?.[0]; input.value = '';
    if (!file) return;
    const current = ++version;
    source = undefined; clearOutput(); corner = 'left';
    positions.forEach(button => { button.disabled = true; });
    panel.hidden = true; editor.hidden = false;
    dialog.classList.add('is-photo-editor'); dialog.scrollTop = 0;
    find('[data-museum-photo-back]').focus({ preventScroll: true });
    status.textContent = 'Opening your photo…';
    void museumPhotoFromFile(file).then(canvas => {
      if (current !== version) return;
      source = canvas; void render();
    }).catch(() => {
      if (current === version) status.textContent = 'This photo could not be opened. Choose a JPEG or PNG and try again.';
    });
  });
  positions.forEach(button => button.addEventListener('click', () => {
    if (!source || corner === button.dataset.museumPhotoPosition) return;
    corner = button.dataset.museumPhotoPosition; void render();
  }));
  share.addEventListener('click', () => {
    if (!outputFile) return;
    const failed = error => {
      if (error?.name !== 'AbortError') status.textContent = 'Sharing is unavailable here. Use Download photo to save your copy.';
    };
    try { void navigator.share({ files: [outputFile], title: label.title }).catch(failed); }
    catch (error) { failed(error); }
  });
  find('[data-museum-photo-back]').addEventListener('click', () => {
    close(); find('[data-museum-photo-choose]').focus();
  });
  dialog.addEventListener('close', close);
  window.addEventListener('pagehide', event => { if (!event.persisted) close(); });
  return { close };
}
