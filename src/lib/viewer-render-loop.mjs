// A viewer draws only after an invalidation or while its controls are moving.
// Visibility/suspension gates keep every activation mode on the same lifecycle.
export function createViewerRenderLoop({ draw, onError = error => { throw error; }, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame, visible = true, hidden = false }) {
  let frame = null;
  let previous;
  let suspended = false;
  let destroyed = false;
  let dirty = true;
  const active = () => !destroyed && visible && !hidden && !suspended;
  function cancel() {
    if (frame !== null) cancelFrame(frame);
    frame = null; previous = undefined;
  }
  function schedule() { if (active() && frame === null) frame = requestFrame(tick); }
  function tick(now) {
    frame = null;
    if (!active()) { previous = undefined; return; }
    const elapsed = previous === undefined ? 0 : Math.max(0, Math.min((now - previous) / 1000, 1));
    previous = now;
    dirty = false;
    let moving;
    try { moving = draw(elapsed) === true; }
    catch (error) { destroyed = true; cancel(); onError(error); return; }
    if (active() && (moving || dirty)) schedule();
    else previous = undefined;
  }
  function invalidate() { if (!destroyed) { dirty = true; schedule(); } }
  function gate() { if (!active()) cancel(); else invalidate(); }
  return {
    invalidate,
    setVisible(value) { visible = Boolean(value); gate(); },
    setHidden(value) { hidden = Boolean(value); gate(); },
    setSuspended(value) { suspended = Boolean(value); gate(); },
    destroy() { destroyed = true; dirty = false; cancel(); },
  };
}

export function bindViewerRenderEvents({ loop, controls, visibilityTarget = document, media, onMotionChange, signal }) {
  const invalidate = () => loop.invalidate();
  const stop = () => {
    for (const type of ['change', 'start', 'end']) controls.removeEventListener(type, invalidate);
    loop.destroy();
  };
  if (signal.aborted) { stop(); return; }
  for (const type of ['change', 'start', 'end']) controls.addEventListener(type, invalidate);
  visibilityTarget.addEventListener('visibilitychange', () => loop.setHidden(visibilityTarget.hidden), { signal });
  media.addEventListener('change', onMotionChange, { signal });
  signal.addEventListener('abort', stop, { once: true });
}
