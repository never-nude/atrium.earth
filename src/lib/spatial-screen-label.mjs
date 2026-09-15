import { layoutArtworkLabel, paintArtworkLabel } from './spatial-artwork-label.mjs';

// This is a screen overlay, never a child of the artwork or its world anchor.
// Reuse its actual painted pixels when capturing, so rotation, safe areas and
// line wrapping match the live view exactly.
export function createScreenArtworkLabel(overlay, label, { visible = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'spatial-screen-label';
  canvas.dataset.spatialScreenLabel = '';
  canvas.hidden = !visible;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', [label.title, label.maker, label.period, label.region, label.material].filter(Boolean).join('. '));
  overlay.append(canvas);
  let disposed = false;
  const draw = () => {
    if (disposed) return;
    const rect = canvas.getBoundingClientRect();
    const viewport = overlay.getBoundingClientRect();
    const width = rect.width;
    if (!width) return;
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    const maxHeight = Math.max(100, viewport.height - (rect.y - viewport.y) - 136);
    const context = canvas.getContext('2d');
    const compact = { padding: 8, gap: 3, titleSize: 14, detailSize: 10.5 };
    let size = 1;
    let layout = layoutArtworkLabel(context, label, width * ratio, ratio, compact);
    while (layout.height > maxHeight * ratio && size > .7) {
      size -= .05;
      layout = layoutArtworkLabel(context, label, width * ratio, ratio * size, compact);
    }
    canvas.width = layout.width; canvas.height = layout.height;
    canvas.style.height = `${layout.height / ratio}px`;
    paintArtworkLabel(context, layout, 0, 0, { background: 'rgba(14,22,38,.52)', border: false, accentWidth: 1, textShadow: true });
  };
  const observer = new ResizeObserver(draw);
  observer.observe(overlay);
  void document.fonts.ready.then(draw);
  draw();
  return {
    setVisible(visible) { canvas.hidden = !visible; if (visible) draw(); },
    stamp(photo, cameraCanvas) {
      const view = cameraCanvas.getBoundingClientRect();
      const rect = canvas.getBoundingClientRect();
      const xScale = photo.width / view.width, yScale = photo.height / view.height;
      photo.getContext('2d').drawImage(canvas, (rect.x - view.x) * xScale, (rect.y - view.y) * yScale, rect.width * xScale, rect.height * yScale);
      return photo;
    },
    dispose() { disposed = true; observer.disconnect(); canvas.remove(); },
  };
}
