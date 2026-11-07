export function connectWorldViewControls(root, globe, fullscreenTarget) {
  const controls = root.querySelector('[data-world-view-controls]');
  if (!controls) return () => {};
  const events = new AbortController(); const signal = events.signal;
  const rotate = controls.querySelector('[data-world-rotate]');
  const fullscreen = controls.querySelector('[data-world-fullscreen]');
  const status = controls.querySelector('[data-world-view-status]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let fullscreenDenied = false;
  const syncPresentation = () => {
    const map = root.dataset.worldMode === 'map';
    const active = Boolean(fullscreenTarget && document.fullscreenElement === fullscreenTarget);
    controls.hidden = map && !active;
    for (const button of controls.querySelectorAll('button')) if (button !== fullscreen) button.hidden = map;
    for (const separator of controls.querySelectorAll(':scope > span')) separator.hidden = map;
    const supported = typeof fullscreenTarget?.requestFullscreen === 'function' && document.fullscreenEnabled !== false;
    // The exit action must survive Map mode, denied requests and renderer fallback.
    fullscreen.hidden = !active && (map || fullscreenDenied || !supported);
    fullscreen.setAttribute('aria-pressed', String(active));
    fullscreen.textContent = active ? 'Exit full screen' : 'Full screen';
    fullscreen.title = active ? 'Exit full screen' : 'Enter full screen';
  };
  const syncRotation = () => {
    rotate.setAttribute('aria-pressed',String(globe.isAutoRotating()));
    rotate.title = motion.matches ? 'Automatic rotation follows your reduced motion preference' : globe.isAutoRotating() ? 'Pause automatic rotation' : 'Start automatic rotation';
    rotate.disabled = motion.matches;
  };
  controls.querySelector('[data-world-zoom-in]').addEventListener('click',() => globe.zoomIn(),{signal});
  controls.querySelector('[data-world-zoom-out]').addEventListener('click',() => globe.zoomOut(),{signal});
  rotate.addEventListener('click',() => {globe.setAutoRotate(!globe.isAutoRotating());syncRotation();},{signal});
  controls.querySelector('[data-world-view-reset]').addEventListener('click',() => {globe.reset();syncRotation();},{signal});
  fullscreen.addEventListener('click',async () => {
    try {
      status.textContent = '';
      if (document.fullscreenElement === fullscreenTarget) await document.exitFullscreen();
      else await fullscreenTarget.requestFullscreen();
    } catch {status.textContent = 'Full screen is unavailable in this browser.';fullscreenDenied=true;syncPresentation();}
  },{signal});
  document.addEventListener('fullscreenchange',syncPresentation,{signal});
  root.addEventListener('world-mode-change',syncPresentation,{signal});
  motion.addEventListener('change',syncRotation,{signal});
  root.addEventListener('world-rotation-change',syncRotation,{signal});
  syncRotation(); syncPresentation(); return () => events.abort();
}
export function updateWorldZoomControls(root,state) {
  const zoomIn = root.querySelector('[data-world-zoom-in]');
  const zoomOut = root.querySelector('[data-world-zoom-out]');
  if (zoomIn) zoomIn.disabled = !state.canZoomIn;
  if (zoomOut) zoomOut.disabled = !state.canZoomOut;
}
