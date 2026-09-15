import { spatialDevice, probeSpatialSupport } from './spatial-capabilities.mjs';
import { makeQuickLookScene, startSpatialSession } from './spatial-session.mjs';
import { displayReferenceFor } from './spatial-access.mjs';
import { quickLookLabelFragment } from './spatial-artwork-label.mjs';
import { bindSpatialPhotos } from './spatial-photo.mjs';
import { loadBrowserAREngine, requestBrowserARMotion } from './spatial-browser-ar-loader.mjs';

export function bindSpatialViewing(element, getContext, activate) {
  const find = (selector) => element.querySelector(selector);
  const dialog = find('[data-spatial-dialog]');
  const panel = find('.spatial-panel');
  const overlay = find('[data-spatial-overlay]');
  const ar = find('[data-spatial-ar]');
  const vr = find('[data-spatial-vr]');
  const quickLook = find('[data-quick-look]');
  const quickLookOptions = find('[data-quick-look-options]');
  const quickLookPrepare = find('[data-quick-look-prepare]');
  const status = find('[data-spatial-status]');
  const supportMode = find('[data-support-mode]');
  const supportHeight = find('[data-support-height]');
  const recommendation = element.dataset.supportRecommendation ? { kind: element.dataset.supportRecommendation } : undefined;
  const supportOptions = () => ({ mode: supportMode.value, height: Number(supportHeight.value), recommendation });
  const showSupport = ({ visible, height }) => {
    find('[data-spatial-support-control]').hidden = !visible;
    find('[data-spatial-support-height]').value = String(height);
    find('[data-spatial-support-value]').textContent = `${Math.round(height * 100)} cm`;
  };
  const title = element.dataset.title;
  const artworkLabel = JSON.parse(element.dataset.artworkLabelJson || JSON.stringify({ title }));
  const photos = bindSpatialPhotos(element, artworkLabel);
  const capture = find('[data-spatial-photo-capture]');
  const captureStatus = find('[data-spatial-capture-status]');
  const reviewPhoto = find('[data-spatial-photo-review]');
  const confirmPlacement = find('[data-spatial-confirm-placement]');
  const proposedSize = find('[data-spatial-proposed-size]');
  const overlayControls = find('.spatial-overlay-controls');
  let browserPlaced = false, photoStatusTimer;
  const showDimensions = ({ height, width, depth }) => {
    const meters = Math.max(height, width, depth) >= 1;
    const format = new Intl.NumberFormat('en', { maximumFractionDigits: meters ? 2 : 1 });
    find('[data-spatial-dimensions]').textContent = [height, width, depth]
      .map(value => format.format(value * (meters ? 1 : 100))).join(' × ') + (meters ? ' m' : ' cm');
  };
  let capturing = false;
  let captureReady = false;
  let captureVersion = 0;
  const verifiedReference = element.dataset.verifiedReference === 'true';
  const verifiedModel = () => !verifiedReference || getContext()?.verifiedAsset === true;
  const reference = verifiedReference && element.dataset.referenceAxis ? {
    axis: element.dataset.referenceAxis, meters: Number(element.dataset.referenceMeters),
    ...(element.dataset.referenceExtentFraction !== undefined
      ? { extentFraction: Number(element.dataset.referenceExtentFraction) } : {}),
  } : null;
  const defaultMaxExtentMeters = Number(element.dataset.defaultMaxExtentMeters) || 1;
  const viewingReference = () => verifiedReference ? reference : displayReferenceFor(getContext()?.box, defaultMaxExtentMeters);
  const showScale = (value) => {
    find('[data-spatial-scale]').value = String(value);
    find('[data-spatial-size]').textContent = `${Math.round(value * 100)}%`;
  };
  const pageUrl = document.querySelector('link[rel="canonical"]')?.href || location.href;
  const xr = navigator.xr;
  let relAR = false;
  try { relAR = Boolean(document.createElement('a').relList?.supports?.('ar')); } catch {}
  const device = spatialDevice({
    userAgent: navigator.userAgent, platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints, relAR,
    webView: Boolean(window.webkit?.messageHandlers),
  });
  const quickLookSupported = device.quickLook;
  const browserARSupported = device.apple && !device.embedded && window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
  if (quickLookSupported) find('[data-spatial-photo-help]').textContent = 'Atrium AR photos already include the fixed artwork label. For photos taken in Apple AR, choose the saved photo here to add its label. Portrait and landscape photos keep their orientation.';
  const handoff = find('[data-spatial-handoff]');
  const urlInput = find('[data-spatial-url]');
  const linkStatus = find('[data-spatial-link-status]');
  const retry = find('[data-spatial-retry]');
  urlInput.value = pageUrl;
  find('[data-spatial-share]').hidden = typeof navigator.share !== 'function';
  let exportVersion = 0;
  let checkVersion = 0;
  let loadFailed = false;
  let capabilities = { ar: false, vr: false, checked: false };
  let busy = false;
  let session;
  let pending;
  let modelUrl;
  let quickLookFixedScale = false;
  const updateQuickLookLink = () => {
    if (!modelUrl) return;
    quickLook.href = `${modelUrl}#${quickLookLabelFragment({
      fixedScale: quickLookFixedScale, pageUrl,
    })}`;
  };
  const invalidateQuickLook = () => {
    if (modelUrl) URL.revokeObjectURL(modelUrl);
    modelUrl = undefined;
    quickLook.removeAttribute('href');
    quickLook.hidden = true; ar.hidden = false;
  };
  const updateSupportChoice = () => {
    find('[data-support-height-control]').hidden = supportMode.value === 'surface'
      || (supportMode.value === 'auto' && recommendation && recommendation.kind !== 'plinth');
    find('[data-support-height-value]').textContent = `${Math.round(Number(supportHeight.value) * 100)} cm`;
    find('[data-support-note]').textContent = supportMode.value === 'plinth'
      ? 'Place the virtual stand on the floor. In Apple AR, the artwork and stand keep their prepared size.'
      : supportMode.value === 'surface'
        ? 'Place the artwork directly on a real table or the floor. No virtual furniture is added.'
        : recommendation
          ? 'VR follows the display recommendation at the selected starting size. In AR, use a real surface or choose a virtual stand.'
          : 'Small displayed pieces get a stand in VR. In AR, use a real table or choose a virtual stand.';
  };
  const say = (message) => { status.textContent = message; };
  function showHandoff(mode) {
    handoff.open = true;
    find('[data-device-help]').textContent = mode === 'vr'
      ? 'Open this link in your headset’s browser, then choose “Enter VR”. You can continue exploring in 3D here.'
      : device.apple
        ? 'Open this link in Safari on your iPhone or iPad. If you are inside another app, use its menu to open the page in Safari.'
        : device.android
          ? 'Open this link in Chrome on an AR-capable Android phone. If you are inside another app, open the page in Chrome.'
          : 'Open this link in Safari on an iPhone or iPad, or Chrome on an AR-capable Android phone. For VR, use your headset’s browser.';
    handoff.scrollIntoView({ block: 'nearest' });
    urlInput.focus({ preventScroll: true });
    urlInput.select();
  }
  async function copyPage() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      linkStatus.textContent = 'Link copied. Paste it into the browser on your other device.';
    } catch {
      urlInput.focus(); urlInput.select();
      linkStatus.textContent = 'Select and copy the link above, then open it on your other device.';
    }
  }
  async function sharePage() {
    try {
      if (typeof navigator.share !== 'function') { await copyPage(); return; }
      await navigator.share({ title, text: `Explore ${title} in 3D on Atrium.Earth`, url: pageUrl });
      linkStatus.textContent = 'Link shared.';
    } catch (error) {
      if (error?.name !== 'AbortError') await copyPage();
    }
  }
  function update() {
    const ready = Boolean(getContext());
    const arAvailable = capabilities.ar || browserARSupported || quickLookSupported;
    supportMode.disabled = busy;
    supportHeight.disabled = busy;
    quickLookOptions.hidden = !quickLookSupported || capabilities.ar;
    quickLookPrepare.disabled = busy || !ready || !verifiedModel();
    ar.disabled = busy || !capabilities.checked || (arAvailable && !ready);
    vr.disabled = busy || !capabilities.checked || (capabilities.vr && !ready);
    if (ready && !verifiedModel()) {
      ar.disabled = true; vr.disabled = true;
      say('AR / VR is unavailable because this version of the model could not be matched to its verified size reference. You can continue exploring in 3D.');
    }
    ar.toggleAttribute('data-handoff', !arAvailable);
    ar.textContent = !capabilities.checked ? 'Checking your device…'
      : arAvailable && !ready ? loadFailed ? 'Sculpture unavailable' : 'Loading sculpture…'
      : capabilities.ar || browserARSupported ? 'Place in your room' : quickLookSupported ? 'Prepare Apple AR' : 'Use an AR phone';
    vr.textContent = !capabilities.checked ? 'Checking your device…'
      : capabilities.vr && !ready ? loadFailed ? 'Sculpture unavailable' : 'Loading sculpture…'
      : capabilities.vr ? 'Enter VR' : 'Use a VR headset';
    find('[data-ar-support]').textContent = capabilities.ar || browserARSupported
      ? 'The artwork label stays fixed on screen and is included in your photo. Allow camera and motion access to begin.'
      : quickLookSupported
        ? 'Prepare the work, then tap Open in AR. If your browser cannot open it, try Safari.'
        : device.embedded ? 'This app’s browser may block AR. Open this work in Safari on iPhone or Chrome on Android.'
        : device.apple ? 'Try Safari on this iPhone or iPad to open the work in AR.'
        : device.android ? 'Try Chrome on an AR-capable Android phone.'
        : 'Move to an AR-capable phone or tablet using this work’s link.';
    find('[data-vr-support]').textContent = capabilities.vr
      ? verifiedReference ? 'Your headset is ready. Trigger to turn. The documented size stays fixed.' : 'Your headset is ready. Trigger to turn; thumbstick to resize.'
      : 'Open the work in a headset browser that supports immersive viewing.';
    retry.hidden = !loadFailed;
  }
  async function checkCapabilities() {
    const version = ++checkVersion;
    if (window.isSecureContext && xr) {
      // Publish each result independently: a slow VR check must not block AR.
      await Promise.all(['ar', 'vr'].map(async (mode) => {
        const supported = await probeSpatialSupport(xr, `immersive-${mode}`);
        if (version !== checkVersion) return;
        capabilities[mode] = supported;
        capabilities.checked = true;
        update();
      }));
    }
    if (version !== checkVersion) return;
    capabilities.checked = true;
    update();
  }
  const reset = () => {
    clearTimeout(photoStatusTimer); browserPlaced = false;
    confirmPlacement.hidden = true; confirmPlacement.disabled = true; proposedSize.hidden = true;
    overlayControls.hidden = false;
    captureVersion++; capturing = false; captureReady = false;
    capture.hidden = true; capture.disabled = true;
    captureStatus.textContent = '';
    session = undefined; pending = undefined; busy = false;
    overlay.hidden = true; panel.hidden = false;
    dialog.classList.remove('spatial-browser-ar');
    showScale(1);
    update();
  };
  const errorMessage = (error) => error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
    ? 'Permission was not granted. You can try again or keep exploring in the screen view.'
    : error?.name === 'AbortError'
      ? 'Immersive viewing was cancelled. The screen view is ready.'
      : 'Immersive viewing could not start on this device. Please try again, or use the screen view.';

  function enter(mode) {
    if (busy || !getContext() || !verifiedModel()) return;
    busy = true; update();
    pending = new AbortController();
    panel.hidden = true; overlay.hidden = false;
    find('.spatial-overlay-controls').open = true;
    captureStatus.textContent = '';
    find('[data-spatial-place]').hidden = mode !== 'immersive-ar';
    find('[data-spatial-instructions]').textContent = 'Starting immersive view…';
    // requestSession must run directly inside the click, before imports or awaits.
    let request;
    try {
      request = xr.requestSession(mode, mode === 'immersive-ar'
        ? { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay', 'camera-access'], domOverlay: { root: overlay } }
        : { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking', 'dom-overlay'], domOverlay: { root: overlay } });
    } catch (error) { reset(); say(errorMessage(error)); return; }
    void startSpatialSession(getContext(), request, mode, overlay, {
      signal: pending.signal,
      reference: viewingReference(),
      support: supportOptions(),
      artworkLabel,
      onSupport: showSupport,
      onStatus: (text) => {
        find('[data-spatial-instructions]').textContent = text;
        if (text.startsWith('Placed')) {
          find('.spatial-overlay-controls').open = false;
          if (!captureReady) captureStatus.textContent = 'You can also save this view with a screenshot.';
        }
      },
      onCaptureAvailable: (available) => {
        captureReady = available; capture.hidden = !available; capture.disabled = !available || capturing;
        if (available && !capturing) captureStatus.textContent = '';
      },
      onScale: showScale,
      fixedScale: verifiedReference,
      onEnd: () => { reset(); say('Back on screen. You can start another immersive view whenever you like.'); },
    }).then((active) => { session = active; }).catch((error) => { reset(); say(errorMessage(error)); });
  }

  function enterBrowserAR() {
    if (busy || !getContext() || !verifiedModel()) return;
    // Ask for motion inside this click, before loading the camera runtime.
    let motion;
    try { motion = requestBrowserARMotion(); } catch (error) { say(errorMessage(error)); return; }
    busy = true; update();
    const controller = new AbortController(); pending = controller;
    controller.signal.addEventListener('abort', () => {
      if (pending === controller && !session) reset();
    }, { once: true });
    panel.hidden = true; overlay.hidden = false; dialog.classList.add('spatial-browser-ar');
    browserPlaced = false; reviewPhoto.hidden = true;
    overlayControls.open = false; overlayControls.hidden = true;
    confirmPlacement.hidden = false; confirmPlacement.disabled = true; proposedSize.hidden = true;
    find('[data-spatial-place]').hidden = false;
    find('[data-spatial-instructions]').textContent = 'Loading the camera…';
    captureStatus.textContent = 'Loading the camera…';
    void Promise.all([motion, loadBrowserAREngine(), import('./spatial-browser-ar.mjs')]).then(async ([, engine, module]) => {
      if (controller.signal.aborted) throw new DOMException('Viewing cancelled.', 'AbortError');
      const active = await module.startBrowserARSession(getContext(), engine, overlay, {
        signal: controller.signal, reference: viewingReference(), support: supportOptions(), artworkLabel,
        fixedScale: verifiedReference, onScale: showScale, onSupport: showSupport,
        onDimensions: showDimensions,
        onPlacementChange: ({ placed, available }) => {
          browserPlaced = placed;
          confirmPlacement.hidden = placed; confirmPlacement.disabled = !available;
          proposedSize.hidden = placed || !available;
          overlayControls.hidden = !placed;
          if (!placed) overlayControls.open = false;
          capture.hidden = !placed;
        },
        onStatus: (text) => {
          find('[data-spatial-instructions]').textContent = text;
          if (!capturing) captureStatus.textContent = text.startsWith('Placed') || text.startsWith('Surface found') ? '' : text;
          if (text.startsWith('Placed')) find('.spatial-overlay-controls').open = false;
        },
        onCaptureAvailable: (available) => {
          captureReady = available; capture.hidden = !browserPlaced; capture.disabled = !available || capturing;
        },
        onEnd: () => { if (pending === controller) { reset(); say('Back on screen. Your photos are ready below.'); } },
        onError: (error) => { say(`${errorMessage(error)} You can also choose Apple AR below.`); },
      });
      if (controller.signal.aborted || pending !== controller) await active.end(); else session = active;
    }).catch((error) => {
      if (pending === controller) reset();
      say(`${errorMessage(error)}${error?.name === 'AbortError' ? '' : ' You can also choose Apple AR below.'}`);
    });
  }

  async function prepareQuickLook() {
    if (busy || !getContext() || !verifiedModel()) return;
    busy = true; update(); say('Preparing the sculpture for AR…');
    const version = ++exportVersion;
    let converted;
    try {
      const context = getContext();
      const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
      converted = makeQuickLookScene(context.THREE, context.model, context.box, viewingReference(), supportOptions());
      // Quick Look has no screen-space HUD. Export just the work and optional
      // stand: no rotating plaque or bottom banner covering Apple's shutter.
      const bytes = await new USDZExporter().parseAsync(converted.scene, { maxTextureSize: 2048, quickLookCompatible: true });
      if (version !== exportVersion) return;
      if (modelUrl) URL.revokeObjectURL(modelUrl);
      modelUrl = URL.createObjectURL(new Blob([bytes], { type: 'model/vnd.usdz+zip' }));
      // Preserve the physical reference in Apple's viewer, with or without a stand.
      const fixedScale = verifiedReference || converted.hasSupport;
      quickLookFixedScale = fixedScale;
      updateQuickLookLink();
      quickLook.hidden = false; ar.hidden = !browserARSupported;
      say(!verifiedReference
        ? converted.hasSupport
          ? 'Size unverified. Ready at the chosen default display size. Tap “Open in AR” to place the stand. The artwork and stand keep their prepared size.'
          : 'Size unverified. Ready at the chosen default display size. Tap “Open in AR” to place the work; pinch to resize it.'
        : converted.hasSupport
        ? 'Ready. Tap “Open in AR” and place the stand on the floor. The artwork and stand keep their prepared size.'
        : fixedScale
          ? 'Ready. Tap “Open in AR” to place the sculpture. It keeps its prepared physical size as you walk around it.'
          : 'Ready. Tap “Open in AR” to place the sculpture. Its physical size is not yet verified; pinch to adjust the display size.');
      quickLook.focus();
    } catch (error) {
      if (version !== exportVersion) return;
      say('This sculpture could not be prepared for Apple AR. You can still explore it in 3D here.');
      console.warn('Atrium Quick Look preparation failed:', error);
    } finally {
      converted?.dispose();
      if (version === exportVersion) { busy = false; update(); }
    }
  }

  function loadModel() {
    loadFailed = false; update();
    say(getContext() ? '' : 'Loading the sculpture…');
    void activate();
  }
  function openOptions() {
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('spatial-modal-open');
    find('[data-spatial-close]').focus({ preventScroll: true });
    dialog.scrollTop = 0;
    loadModel();
    if (browserARSupported) void loadBrowserAREngine().catch(() => {});
    void checkCapabilities();
  }
  find('[data-spatial-open]').addEventListener('click', openOptions);
  window.addEventListener('hashchange', () => { if (location.hash === '#ar-vr') openOptions(); });
  // Deep links open options only; entering AR or VR still needs a user gesture.
  if (location.hash === '#ar-vr') openOptions();
  retry.addEventListener('click', loadModel);
  find('[data-spatial-close]').addEventListener('click', () => dialog.close());
  find('[data-spatial-screen]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('spatial-modal-open');
    pending?.abort();
    exportVersion++;
    if (!pending) { busy = false; update(); }
    // Safari does not always focus the opening button after a pointer click.
    find('[data-spatial-open]').focus({ preventScroll: true });
  });
  dialog.addEventListener('cancel', () => { pending?.abort(); });
  find('[data-spatial-exit]').addEventListener('click', () => {
    pending?.abort();
    if (dialog.classList.contains('spatial-browser-ar')) reset();
  });
  // A tap on a DOM overlay button must not also place or rotate the sculpture.
  overlay.addEventListener('beforexrselect', (event) => {
    if (event.target.closest('button, input, label, summary, details')) event.preventDefault();
  });
  capture.addEventListener('click', async () => {
    if (!session || !captureReady || capturing) return;
    const version = ++captureVersion;
    clearTimeout(photoStatusTimer);
    capturing = true; capture.disabled = true;
    reviewPhoto.hidden = true;
    captureStatus.textContent = 'Taking photo…';
    try {
      const labelled = Boolean(session.photoIncludesLabel);
      const canvas = await session.capturePhoto();
      const prepared = await photos.prepare(() => canvas, { labelled });
      if (version !== captureVersion) return;
      if (!prepared) throw new Error('Photo could not be prepared');
      reviewPhoto.hidden = false;
      const browserAR = dialog.classList.contains('spatial-browser-ar');
      captureStatus.textContent = browserAR ? 'Photo ready' : 'Photo ready. View it to save or share.';
      if (browserAR) photoStatusTimer = setTimeout(() => {
        if (version === captureVersion && captureReady && captureStatus.textContent === 'Photo ready') captureStatus.textContent = '';
      }, 2200);
    } catch (error) {
      if (version !== captureVersion) return;
      captureStatus.textContent = 'The photo could not be captured. Try again, or save this view with a screenshot.';
    } finally {
      if (version === captureVersion) { capturing = false; capture.disabled = !captureReady; }
    }
  });
  reviewPhoto.addEventListener('click', async () => {
    if (capturing) return;
    try { await session?.end(); } catch { return; }
    photos.show();
  });
  find('[data-spatial-scale]').addEventListener('input', (event) => session?.setScale(event.target.value));
  find('[data-spatial-support-height]').addEventListener('input', (event) => {
    supportHeight.value = event.target.value;
    updateSupportChoice();
    invalidateQuickLook();
    session?.setSupportHeight(event.target.value);
  });
  for (const control of [supportMode, supportHeight]) {
    control.addEventListener('input', () => { updateSupportChoice(); invalidateQuickLook(); say(''); });
  }
  quickLookPrepare.addEventListener('click', () => void prepareQuickLook());
  find('[data-spatial-reset-size]').addEventListener('click', () => session?.setScale(1));
  find('[data-spatial-turn]').addEventListener('click', () => session?.rotate(Math.PI / 6));
  find('[data-spatial-place]').addEventListener('click', () => session?.reposition());
  confirmPlacement.addEventListener('click', () => session?.place());
  ar.addEventListener('click', () => {
    if (capabilities.ar) enter('immersive-ar');
    else if (browserARSupported) enterBrowserAR();
    else if (quickLookSupported) void prepareQuickLook();
    else showHandoff('ar');
  });
  vr.addEventListener('click', () => {
    if (capabilities.vr) enter('immersive-vr');
    else showHandoff('vr');
  });
  find('[data-spatial-copy]').addEventListener('click', copyPage);
  urlInput.addEventListener('click', () => urlInput.select());
  find('[data-spatial-share]').addEventListener('click', sharePage);
  const root = element.closest('[data-viewer]');
  root.addEventListener('atrium:viewer-ready', () => { invalidateQuickLook(); loadFailed = false; update(); if (!busy && status.textContent === 'Loading the sculpture…') say(''); });
  root.addEventListener('atrium:viewer-error', () => { loadFailed = true; update(); say('The sculpture could not load. Try again, or open this work on another device.'); });
  window.addEventListener('pagehide', (event) => {
    pending?.abort();
    if (!event.persisted) { exportVersion++; invalidateQuickLook(); }
  });
  xr?.addEventListener?.('devicechange', checkCapabilities);
  updateSupportChoice();
  void checkCapabilities();
}
