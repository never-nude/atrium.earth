import { layoutArtworkLabel, paintArtworkLabel } from './spatial-artwork-label.mjs';
import { artworkLabelPlacements, labelPlacementIsClear } from './spatial-label-placement.mjs';

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
  let disposed = false, placement, pendingPlacement;
  const resetPlacement = () => {
    placement = undefined; pendingPlacement = undefined;
    canvas.style.removeProperty('left'); canvas.style.removeProperty('top'); canvas.style.removeProperty('bottom');
    delete canvas.dataset.labelPosition;
  };
  const draw = () => {
    if (disposed) return;
    resetPlacement();
    const rect = canvas.getBoundingClientRect();
    const viewport = overlay.getBoundingClientRect();
    const width = rect.width;
    if (!width) return;
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    // The HUD is anchored at the bottom. Its available height must not depend
    // on its previous painted height, or every redraw would shrink the text.
    const maxHeight = Math.max(80, Math.min(140, viewport.height * .3));
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
    updatePlacement(artwork, now = performance.now()) {
      if (disposed || canvas.hidden) return;
      const viewport = overlay.getBoundingClientRect(), size = canvas.getBoundingClientRect();
      const shutter = overlay.querySelector('[data-spatial-photo-capture]')?.getBoundingClientRect();
      const exit = overlay.querySelector('[data-spatial-exit]')?.getBoundingClientRect();
      const controls = overlay.querySelector('.spatial-overlay-controls')?.getBoundingClientRect();
      const view = {
        left: Math.max(16, (controls?.left ?? viewport.left + 16) - viewport.left),
        right: Math.min(viewport.width - 16, (exit?.right ?? viewport.right - 16) - viewport.left),
        top: Math.max(16, viewport.height * .2),
        bottom: (shutter?.height ? shutter.top - viewport.top : viewport.height - 76) - 16,
      };
      const choices = artworkLabelPlacements(view, size, artwork), best = choices[0];
      const clear = placement && labelPlacementIsClear(placement, view, artwork);
      const sameSide = choices.find(choice => choice.side === placement?.side);
      // Hold still while this area remains useful. Require substantially more
      // room and a persistent candidate before switching to another clear area.
      if (clear && (best.side === placement.side || (sameSide && best.space < sameSide.space * 1.3))) {
        pendingPlacement = undefined; return;
      }
      if (placement && best.side === placement.side && Math.abs(best.left - placement.left) + Math.abs(best.top - placement.top) < 12) return;
      if (placement) {
        if (pendingPlacement?.side !== best.side) pendingPlacement = { side: best.side, since: now };
        if (now - pendingPlacement.since < (clear ? 650 : 350)) return;
      }
      placement = best; pendingPlacement = undefined;
      canvas.style.left = `${best.left}px`; canvas.style.top = `${best.top}px`; canvas.style.bottom = 'auto';
      canvas.dataset.labelPosition = best.side;
    },
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
