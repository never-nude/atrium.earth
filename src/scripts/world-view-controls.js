export function connectWorldViewControls(root, globe, fullscreenTarget) {
  const controls = root.querySelector('[data-world-view-controls]');
  if (!controls) return () => {};
  controls.hidden = false;
  const events = new AbortController(); const signal = events.signal;
  const rotate = controls.querySelector('[data-world-rotate]');
  const fullscreen = controls.querySelector('[data-world-fullscreen]');
  const status = controls.querySelector('[data-world-view-status]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const syncRotation = () => {
    rotate.setAttribute('aria-pressed',String(globe.isAutoRotating()));
    rotate.title = motion.matches ? 'Automatic rotation follows your reduced motion preference' : globe.isAutoRotating() ? 'Pause automatic rotation' : 'Start automatic rotation';
    rotate.disabled = motion.matches;
  };
  controls.querySelector('[data-world-zoom-in]').addEventListener('click',() => globe.zoomIn(),{signal});
  controls.querySelector('[data-world-zoom-out]').addEventListener('click',() => globe.zoomOut(),{signal});
  rotate.addEventListener('click',() => {globe.setAutoRotate(!globe.isAutoRotating());syncRotation();},{signal});
  controls.querySelector('[data-world-view-reset]').addEventListener('click',() => {globe.reset();syncRotation();},{signal});
  fullscreen.hidden = typeof fullscreenTarget.requestFullscreen !== 'function' || document.fullscreenEnabled === false;
  fullscreen.addEventListener('click',async () => {
    try {
      status.textContent = '';
      if (document.fullscreenElement === fullscreenTarget) await document.exitFullscreen();
      else await fullscreenTarget.requestFullscreen();
    } catch {status.textContent = 'Full screen is unavailable in this browser.';fullscreen.hidden=true;}
  },{signal});
  document.addEventListener('fullscreenchange',() => {
    const active = document.fullscreenElement === fullscreenTarget;
    fullscreen.setAttribute('aria-pressed',String(active));
    fullscreen.textContent = active ? 'Exit full screen' : 'Full screen';
    fullscreen.title = active ? 'Exit full screen' : 'Enter full screen';
  },{signal});
  motion.addEventListener('change',syncRotation,{signal});
  root.addEventListener('world-rotation-change',syncRotation,{signal});
  syncRotation(); return () => events.abort();
}
export function updateWorldZoomControls(root,state) {
  const zoomIn = root.querySelector('[data-world-zoom-in]');
  const zoomOut = root.querySelector('[data-world-zoom-out]');
  if (zoomIn) zoomIn.disabled = !state.canZoomIn;
  if (zoomOut) zoomOut.disabled = !state.canZoomOut;
}
