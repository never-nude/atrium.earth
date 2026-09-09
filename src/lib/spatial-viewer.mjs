import { makeQuickLookScene, startSpatialSession } from './spatial-session.mjs';

export function bindSpatialViewing(element, getContext, activate) {
  const find = (selector) => element.querySelector(selector);
  const dialog = find('[data-spatial-dialog]');
  const panel = find('.spatial-panel');
  const overlay = find('[data-spatial-overlay]');
  const ar = find('[data-spatial-ar]');
  const vr = find('[data-spatial-vr]');
  const quickLook = find('[data-quick-look]');
  const status = find('[data-spatial-status]');
  const title = element.dataset.title;
  const reference = element.dataset.referenceAxis ? {
    axis: element.dataset.referenceAxis, meters: Number(element.dataset.referenceMeters),
  } : null;
  const showScale = (value) => {
    find('[data-spatial-scale]').value = String(value);
    find('[data-spatial-size]').textContent = `${Math.round(value * 100)}%`;
  };
  const pageUrl = document.querySelector('link[rel="canonical"]')?.href || location.href;
  const xr = navigator.xr;
  const quickLookSupported = Boolean(document.createElement('a').relList?.supports?.('ar'));
  let capabilities = { ar: false, vr: false, checked: false };
  let busy = false;
  let session;
  let pending;
  let modelUrl;
  const say = (message) => { status.textContent = message; };
  function update() {
    const ready = Boolean(getContext());
    ar.disabled = busy || !ready || !(capabilities.ar || quickLookSupported);
    vr.disabled = busy || !ready || !capabilities.vr;
    ar.textContent = !capabilities.checked ? 'Checking your device…' : capabilities.ar ? 'Place in your room' : quickLookSupported ? 'Prepare AR view' : 'Open on an AR phone';
    vr.textContent = !capabilities.checked ? 'Checking your device…' : capabilities.vr ? 'Enter VR' : 'Open in a VR headset';
    find('[data-ar-support]').textContent = capabilities.ar ? 'Uses your camera to find a surface. You choose when to start.' : quickLookSupported ? 'Opens in Apple Quick Look. Preparing a large sculpture may take a moment.' : 'Use Safari on an AR-capable iPhone or iPad, or an AR-capable Android browser.';
    find('[data-vr-support]').textContent = capabilities.vr ? 'Your headset supports immersive viewing.' : 'Requires a headset browser with WebXR support. The screen view works on this device.';
  }
  async function checkCapabilities() {
    if (window.isSecureContext && xr) {
      const values = await Promise.allSettled([xr.isSessionSupported('immersive-ar'), xr.isSessionSupported('immersive-vr')]);
      capabilities.ar = values[0].status === 'fulfilled' && values[0].value;
      capabilities.vr = values[1].status === 'fulfilled' && values[1].value;
    }
    capabilities.checked = true;
    update();
  }
  const reset = () => {
    session = undefined; busy = false;
    overlay.hidden = true; panel.hidden = false;
    showScale(1);
    update();
  };
  const errorMessage = (error) => error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
    ? 'Permission was not granted. You can try again or keep exploring in the screen view.'
    : error?.name === 'AbortError'
      ? 'Immersive viewing was cancelled. The screen view is ready.'
      : 'Immersive viewing could not start on this device. Please try again, or use the screen view.';

  function enter(mode) {
    if (busy || !getContext()) return;
    busy = true; update();
    pending = new AbortController();
    panel.hidden = true; overlay.hidden = false;
    find('[data-spatial-place]').hidden = mode !== 'immersive-ar';
    find('[data-spatial-instructions]').textContent = 'Starting immersive view…';
    // requestSession must run directly inside the click, before imports or awaits.
    let request;
    try {
      request = xr.requestSession(mode, mode === 'immersive-ar'
        ? { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: overlay } }
        : { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking', 'dom-overlay'], domOverlay: { root: overlay } });
    } catch (error) { reset(); say(errorMessage(error)); return; }
    void startSpatialSession(getContext(), request, mode, overlay, {
      signal: pending.signal,
      reference,
      onStatus: (text) => { find('[data-spatial-instructions]').textContent = text; },
      onScale: showScale,
      onEnd: () => { reset(); say('Back on screen. You can start another immersive view whenever you like.'); },
    }).then((active) => { session = active; }).catch((error) => { reset(); say(errorMessage(error)); });
  }

  async function prepareQuickLook() {
    if (busy || !getContext()) return;
    busy = true; update(); say('Preparing the sculpture for AR…');
    let converted;
    try {
      const context = getContext();
      const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
      converted = makeQuickLookScene(context.THREE, context.model, context.box, reference);
      const bytes = await new USDZExporter().parseAsync(converted.scene, { maxTextureSize: 2048, quickLookCompatible: true });
      if (modelUrl) URL.revokeObjectURL(modelUrl);
      modelUrl = URL.createObjectURL(new Blob([bytes], { type: 'model/vnd.usdz+zip' }));
      quickLook.href = `${modelUrl}#allowsContentScaling=1&canonicalWebPageURL=${encodeURIComponent(pageUrl)}`;
      quickLook.hidden = false; ar.hidden = true;
      say('Ready. Tap “Open in AR” to place the sculpture. Pinch to change its display size.');
      quickLook.focus();
    } catch (error) {
      say('This sculpture could not be prepared for Apple AR. You can still explore it in 3D here.');
      console.warn('Atrium Quick Look preparation failed:', error);
    } finally { converted?.dispose(); busy = false; update(); }
  }

  find('[data-spatial-open]').addEventListener('click', () => {
    dialog.showModal();
    say(getContext() ? '' : 'Loading the sculpture. Immersive options will be ready in a moment…');
    void activate(); update();
  });
  find('[data-spatial-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', () => { pending?.abort(); });
  find('[data-spatial-exit]').addEventListener('click', () => {
    pending?.abort();
  });
  // A tap on a DOM overlay button must not also place or rotate the sculpture.
  overlay.addEventListener('beforexrselect', (event) => {
    if (event.target.closest('button, input, label')) event.preventDefault();
  });
  find('[data-spatial-scale]').addEventListener('input', (event) => session?.setScale(event.target.value));
  find('[data-spatial-reset-size]').addEventListener('click', () => session?.setScale(1));
  find('[data-spatial-turn]').addEventListener('click', () => session?.rotate(Math.PI / 6));
  find('[data-spatial-place]').addEventListener('click', () => session?.reposition());
  ar.addEventListener('click', () => capabilities.ar ? enter('immersive-ar') : void prepareQuickLook());
  vr.addEventListener('click', () => enter('immersive-vr'));
  find('[data-spatial-share]').addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title, text: `Explore ${title} in 3D on Atrium.Earth`, url: pageUrl });
      else { await navigator.clipboard.writeText(pageUrl); say('Link copied. Open it on your phone or in your headset’s browser.'); }
    } catch (error) {
      if (error?.name !== 'AbortError') say(`Open this address on your device: ${pageUrl}`);
    }
  });
  const root = element.closest('[data-viewer]');
  root.addEventListener('atrium:viewer-ready', () => { update(); if (!busy) say(''); });
  root.addEventListener('atrium:viewer-error', () => { update(); say('The sculpture could not load. Close this panel and choose “Examine in 3D” to retry.'); });
  window.addEventListener('pagehide', (event) => {
    pending?.abort();
    if (!event.persisted && modelUrl) URL.revokeObjectURL(modelUrl);
  });
  xr?.addEventListener?.('devicechange', checkCapabilities);
  void checkCapabilities();
}
