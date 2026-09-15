import { referenceScaleFor } from './physical-dimensions.mjs';
import { createDisplaySupport, supportLayoutFor } from './display-support.mjs';
import { createScreenArtworkLabel } from './spatial-screen-label.mjs';

// XR8 supplies real camera frames, 6DoF poses and hit tests on iOS Safari. Atrium
// owns the UI and draws on the SAME WebGL canvas as the camera. Do not substitute
// a photo, an orientation-only camera, or a guessed fixed-distance placement.
export async function startBrowserARSession(context, XR8, overlay, options = {}) {
  if (options.signal?.aborted) throw new DOMException('Viewing cancelled.', 'AbortError');
  const { THREE, renderer, scene, camera, model, ground, grid, box } = context;
  const resume = context.suspend();
  const canvas = renderer.domElement;
  const saved = {
    canvasParent: canvas.parentNode, canvasNext: canvas.nextSibling, canvasStyle: canvas.getAttribute('style'),
    modelParent: model.parent, groundParent: ground.parent, groundPosition: ground.position.clone(),
    groundScale: ground.scale.clone(), groundVisible: ground.visible, gridVisible: grid.visible,
    background: scene.background, camera: camera.clone(), pixelRatio: renderer.getPixelRatio(),
    autoClear: renderer.autoClear, clearColor: renderer.getClearColor(new THREE.Color()), clearAlpha: renderer.getClearAlpha(),
  };
  const anchor = new THREE.Group();
  const content = new THREE.Group();
  const referenceScale = referenceScaleFor(box, options.reference);
  const layout = supportLayoutFor(box, options.reference, { ...options.support, sessionMode: 'immersive-ar' });
  const support = createDisplaySupport(THREE, layout);
  // Preview only the virtual object at reduced opacity. Never change camera
  // exposure, scene lights or the artwork's original materials.
  const previewMaterials = new Map(), previewMeshes = [];
  const previewMaterial = material => {
    if (!previewMaterials.has(material)) {
      const preview = material.clone();
      preview.transparent = true; preview.opacity *= .32; preview.depthWrite = false;
      // Keep cutout textures visible at the same relative alpha threshold.
      preview.alphaTest *= .32;
      previewMaterials.set(material, preview);
    }
    return previewMaterials.get(material);
  };
  for (const object of [model, support.object]) object.traverse(mesh => {
    if (!mesh.material) return;
    const original = mesh.material;
    const preview = Array.isArray(original) ? original.map(previewMaterial) : previewMaterial(original);
    previewMeshes.push({ mesh, original, preview });
  });
  const setPreview = preview => {
    for (const item of previewMeshes) item.mesh.material = preview ? item.preview : item.original;
    ground.visible = !preview && saved.groundVisible;
  };
  setPreview(true);
  let supportHeight = layout.visible ? layout.height : 0, displayScale = 1;
  const setScale = (value) => {
    const number = Number(value);
    displayScale = options.fixedScale ? 1 : Number.isFinite(number) ? Math.max(.1, Math.min(2, number)) : 1;
    content.scale.setScalar(referenceScale * displayScale);
    content.position.y = supportHeight - box.min.y * referenceScale * displayScale;
    ground.scale.copy(saved.groundScale).multiplyScalar(referenceScale * displayScale);
    options.onScale?.(displayScale);
    options.onDimensions?.({
      height: (box.max.y - box.min.y) * referenceScale * displayScale,
      width: (box.max.x - box.min.x) * referenceScale * displayScale,
      depth: (box.max.z - box.min.z) * referenceScale * displayScale,
    });
  };
  const setSupportHeight = (value) => {
    if (layout.visible) supportHeight = support.setHeight(value);
    setScale(displayScale);
    options.onSupport?.({ visible: layout.visible, height: supportHeight });
  };
  content.add(model); anchor.add(content, support.object, ground);
  ground.position.set(0, .001, 0); grid.visible = false;
  anchor.visible = false; scene.add(anchor);
  scene.background = null;
  renderer.autoClear = false;
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(1);
  camera.position.set(0, 1.6, 0); camera.quaternion.identity();
  camera.near = .01; camera.far = 1000;
  canvas.dataset.browserArCanvas = '';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;pointer-events:auto';
  overlay.prepend(canvas);
  const hud = createScreenArtworkLabel(overlay, options.artworkLabel, { visible: false });
  const reticle = new THREE.Mesh(new THREE.RingGeometry(.07, .09, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xeccf7a, side: THREE.DoubleSide, depthTest: false }));
  reticle.visible = false; scene.add(reticle);
  let ended = false, started = false, placed = false, tracking = false, captureReady = false;
  let frameReady = false, orientationChanged = false, trackingLostAt;
  const initialLandscape = overlay.clientWidth > overlay.clientHeight;
  // Start tracking in the chosen orientation. A physical rotation ends this map
  // and offers a fresh placement; it never silently carries an unreliable pose
  // into another view. Do not infer tracker readiness from projection ratios.
  let orientation = Number.isFinite(window.orientation) ? window.orientation : window.screen.orientation?.angle;
  let captureRequest, startupTimer, resolveStart, rejectStart;
  let lastStatus = '';
  let placementState = '';
  const placementAvailability = (available) => {
    const next = `${placed}:${available}`;
    if (next === placementState) return;
    placementState = next;
    options.onPlacementChange?.({ placed, available: !placed && available });
  };
  const status = text => { if (text !== lastStatus) { lastStatus = text; options.onStatus?.(text); } };
  const captureAvailability = () => {
    const available = started && placed && tracking && frameReady && !orientationChanged && !ended;
    if (available !== captureReady) { captureReady = available; options.onCaptureAvailable?.(available); }
  };
  const cancelCapture = () => {
    if (!captureRequest) return;
    clearTimeout(captureRequest.timer);
    captureRequest.reject(new DOMException('Photo cancelled.', 'AbortError'));
    captureRequest = undefined;
  };
  const cleanup = (reason = 'ended') => {
    if (ended) return;
    ended = true;
    clearTimeout(startupTimer);
    cancelCapture(); options.onCaptureAvailable?.(false);
    options.signal?.removeEventListener('abort', onAbort);
    document.removeEventListener('visibilitychange', onVisibility);
    resizeObserver.disconnect();
    XR8.stop(); XR8.clearCameraPipelineModules();
    hud.dispose();
    setPreview(false);
    previewMaterials.forEach(material => material.dispose());
    saved.modelParent.add(model); saved.groundParent.add(ground);
    ground.position.copy(saved.groundPosition); ground.scale.copy(saved.groundScale); ground.visible = saved.groundVisible;
    grid.visible = saved.gridVisible; scene.remove(anchor, reticle);
    reticle.geometry.dispose(); reticle.material.dispose(); support.dispose();
    scene.background = saved.background; camera.copy(saved.camera);
    renderer.autoClear = saved.autoClear; renderer.setPixelRatio(saved.pixelRatio);
    renderer.setClearColor(saved.clearColor, saved.clearAlpha);
    renderer.resetState();
    delete canvas.dataset.browserArCanvas;
    if (saved.canvasStyle === null) canvas.removeAttribute('style'); else canvas.setAttribute('style', saved.canvasStyle);
    saved.canvasParent.insertBefore(canvas, saved.canvasNext);
    resume();
    options.onEnd?.({ reason });
  };
  const fail = (error) => { if (ended) return; rejectStart?.(error); cleanup('error'); options.onError?.(error); };
  const onAbort = () => { rejectStart?.(new DOMException('Viewing cancelled.', 'AbortError')); cleanup(); };
  const onVisibility = () => { if (document.hidden) onAbort(); };
  const findSurface = () => {
    if (!tracking || !frameReady) return null;
    const hits = XR8.XrController.hitTest(initialLandscape ? .6 : .5, .58, ['FEATURE_POINT']);
    return hits.find(hit => {
      if (!hit.position || !['x', 'y', 'z'].every(axis => Number.isFinite(hit.position[axis]))
        || !(hit.distance > .1 && hit.distance < 15)
        || hit.position.y >= camera.position.y - .025) return false;
      // FEATURE_POINT hits can carry no rotation: the engine's setHitResult
      // writes only position and distance, leaving Quaternion32f at all zeros.
      // That is an unknown orientation, not an invalid placement point. Keep
      // the sculpture upright ourselves; only reject a supplied steep estimate.
      // See 8thwall/8thwall reality/engine/hittest/hit-test-performer.cc.
      const q = hit.rotation;
      if (!q) return hit.type === 'FEATURE_POINT';
      if (!['x', 'y', 'z', 'w'].every(axis => Number.isFinite(q[axis]))) return false;
      const norm = q.x ** 2 + q.y ** 2 + q.z ** 2 + q.w ** 2;
      if (norm === 0) return hit.type === 'FEATURE_POINT';
      return norm > .5 && 1 - 2 * (q.x ** 2 + q.z ** 2) / norm >= .85;
    }) || null;
  };
  const place = () => {
    if (placed || ended) return;
    const hit = findSurface();
    if (!hit) { anchor.visible = false; reticle.visible = false; placementAvailability(false); status('Move slowly to find a surface.'); return; }
    // Ground the model at the hit point and preserve its upright orientation.
    anchor.position.copy(hit.position);
    anchor.rotation.set(0, Math.atan2(camera.position.x - anchor.position.x, camera.position.z - anchor.position.z), 0);
    anchor.visible = true; placed = true; reticle.visible = false;
    setPreview(false);
    hud.setVisible(true);
    placementAvailability(false);
    status('Placed.');
    captureAvailability();
  };
  const finishForRotation = () => {
    if (ended || orientationChanged) return;
    orientationChanged = true;
    tracking = false;
    anchor.visible = false; reticle.visible = false;
    cancelCapture(); captureAvailability();
    // Let the engine finish dispatching its current callback before stopping it.
    queueMicrotask(() => {
      rejectStart?.(new DOMException('The view rotated.', 'AbortError'));
      cleanup('orientation');
    });
  };
  const resize = () => {
    if (ended || orientationChanged) return;
    const rect = overlay.getBoundingClientRect();
    if ((rect.width > rect.height) !== initialLandscape) { finishForRotation(); return; }
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      renderer.setSize(width, height, false);
    }
    // Address-bar/viewport height changes stay in this session. XR8 updates its
    // own calibrated intrinsics when it observes the canvas size change.
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(overlay); resize();
  document.addEventListener('visibilitychange', onVisibility);
  options.signal?.addEventListener('abort', onAbort, { once: true });
  setScale(1); setSupportHeight(supportHeight);
  placementAvailability(false);
  const ready = new Promise((resolve, reject) => { resolveStart = resolve; rejectStart = reject; });
  const active = {
    photoIncludesLabel: true,
    end: async () => cleanup(), setScale, setSupportHeight, place,
    rotate: (radians) => { anchor.rotation.y += radians; },
    reposition: () => {
      placed = false; anchor.visible = false; cancelCapture(); captureAvailability();
      setPreview(true);
      hud.setVisible(false); placementAvailability(false);
      status('Move slowly to find a surface.');
    },
    capturePhoto: () => {
      if (!captureReady || captureRequest) return Promise.reject(new Error('Photo capture is not ready.'));
      return new Promise((resolve, reject) => { captureRequest = { resolve, reject, timer: setTimeout(cancelCapture, 3000) }; });
    },
  };
  try {
    XR8.clearCameraPipelineModules();
    XR8.XrController.configure({ disableWorldTracking: false, scale: 'absolute' });
    XR8.addCameraPipelineModules([
      XR8.GlTextureRenderer.pipelineModule(),
      XR8.XrController.pipelineModule(),
      {
        name: 'atrium-browser-ar',
        onStart: ({ orientation: engineOrientation }) => {
          if (ended) return;
          if (Number.isFinite(engineOrientation)) orientation = engineOrientation;
          started = true; clearTimeout(startupTimer);
          XR8.XrController.updateCameraProjectionMatrix({
            origin: camera.position, facing: camera.quaternion,
            cam: { pixelRectWidth: canvas.width, pixelRectHeight: canvas.height, nearClipPlane: camera.near, farClipPlane: camera.far },
          });
          status('Move slowly to find a surface.');
          resolveStart(active);
        },
        onDeviceOrientationChange: ({ orientation: engineOrientation }) => {
          if (Number.isFinite(engineOrientation) && Number.isFinite(orientation)
            && ((engineOrientation - orientation) % 360) !== 0) finishForRotation();
        },
        onCameraStatusChange: ({ status: cameraStatus, stream }) => {
          if (ended) { stream?.getTracks().forEach(track => track.stop()); return; }
          if (cameraStatus === 'failed') fail(new DOMException('Camera access failed.', 'NotAllowedError'));
        },
        onException: error => fail(error),
        onUpdate: ({ processCpuResult }) => {
          if (ended || orientationChanged) return;
          const reality = processCpuResult?.reality;
          frameReady = reality?.intrinsics?.length === 16 && reality.position && reality.rotation
            && [...reality.intrinsics, ...['x', 'y', 'z'].map(axis => reality.position[axis]),
              ...['x', 'y', 'z', 'w'].map(axis => reality.rotation[axis])].every(Number.isFinite);
          tracking = Boolean(frameReady && reality.trackingStatus === 'NORMAL');
          if (frameReady) {
            camera.projectionMatrix.fromArray(reality.intrinsics);
            camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
            camera.position.copy(reality.position); camera.quaternion.copy(reality.rotation);
            camera.updateMatrixWorld(true);
          }
          if (!placed) {
            const hit = findSurface();
            reticle.visible = Boolean(hit);
            anchor.visible = Boolean(hit);
            placementAvailability(Boolean(hit));
            if (hit) {
              reticle.position.copy(hit.position); anchor.position.copy(hit.position);
              anchor.rotation.set(0, Math.atan2(camera.position.x - anchor.position.x, camera.position.z - anchor.position.z), 0);
              status('Surface found. Place when ready.');
            }
            else status('Move slowly to find a surface.');
          } else if (!tracking) {
            trackingLostAt ??= performance.now();
            // Never leave a drifting sculpture on the camera during sustained
            // tracking loss. The existing anchor can return if tracking recovers.
            if (performance.now() - trackingLostAt > 400) anchor.visible = false;
            status('Move slowly to recover tracking.');
          } else {
            trackingLostAt = undefined; anchor.visible = true;
            if (lastStatus.startsWith('Move slowly to recover')) status('Placed.');
          }
          captureAvailability();
        },
        onRender: () => {
          if (ended || !started || !frameReady || orientationChanged) return;
          // The preceding GlTextureRenderer has already drawn the real camera.
          // Reset Three's GL cache, then clear DEPTH only, retaining those pixels.
          renderer.resetState(); renderer.setViewport(0, 0, canvas.width, canvas.height);
          renderer.clearDepth(); renderer.render(scene, camera);
          if (!captureRequest) return;
          const request = captureRequest; captureRequest = undefined; clearTimeout(request.timer);
          try {
            if (!captureReady) throw new Error('Camera tracking is not ready.');
            const photo = document.createElement('canvas');
            photo.width = canvas.width; photo.height = canvas.height;
            // Copy in this render callback, before WebGL discards the backbuffer.
            photo.getContext('2d').drawImage(canvas, 0, 0);
            request.resolve(hud.stamp(photo, canvas));
          } catch (error) { request.reject(error); }
        },
      },
    ]);
    startupTimer = setTimeout(() => fail(new Error('Camera startup timed out.')), 45000);
    XR8.run({ canvas, webgl2: true, allowedDevices: XR8.XrConfig.device().MOBILE, cameraConfig: { direction: XR8.XrConfig.camera().BACK } });
  } catch (error) { fail(error); }
  return ready;
}
