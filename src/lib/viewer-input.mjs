const FORM_CONTROL = 'input, textarea, select, button, a, summary, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';

const TAP_MOVEMENT_PX = 8;
const DOUBLE_TAP_MS = 340;
const DOUBLE_TAP_PX = 36;

function bindCanvasTaps(canvas, { signal, onSingleTap, onDoubleTap }) {
  const pointers = new Map();
  let lastTap, singleTimer;

  function clearTap() {
    clearTimeout(singleTimer);
    lastTap = undefined;
  }

  function singleTap() {
    clearTap();
    onSingleTap?.();
  }

  const options = { passive: true, signal };
  canvas.addEventListener('pointerdown', event => {
    if (!onSingleTap && event.pointerType !== 'touch') return;
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
      clearTap();
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: false });
    if (pointers.size > 1) {
      clearTap();
      for (const pointer of pointers.values()) pointer.moved = true;
    }
  }, options);
  const capture = { ...options, capture: true };
  canvas.ownerDocument.addEventListener('pointermove', event => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer || Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < TAP_MOVEMENT_PX) return;
    pointer.moved = true;
    clearTap();
  }, capture);
  function finish(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointers.delete(event.pointerId);
    const { clientX: x, clientY: y, timeStamp: time, pointerType: type } = event;
    if (event.type !== 'pointerup' || pointer.moved || Math.hypot(x - pointer.x, y - pointer.y) >= TAP_MOVEMENT_PX) {
      clearTap();
      return;
    }
    if (lastTap && type === lastTap.type && time - lastTap.time <= DOUBLE_TAP_MS &&
        Math.hypot(x - lastTap.x, y - lastTap.y) <= DOUBLE_TAP_PX) {
      clearTap();
      onDoubleTap();
      return;
    }
    if (lastTap && onSingleTap) singleTap();
    lastTap = { x, y, time, type };
    if (onSingleTap) singleTimer = setTimeout(singleTap, DOUBLE_TAP_MS);
  }
  canvas.ownerDocument.addEventListener('pointerup', finish, capture);
  canvas.ownerDocument.addEventListener('pointercancel', finish, capture);
  canvas.addEventListener('lostpointercapture', finish, options);
  signal.addEventListener('abort', () => { clearTap(); pointers.clear(); }, { once: true });
  return clearTap;
}

// Automatic viewers use native mouse double-click and direct touch double-tap.
export function bindViewerReset(canvas, reset, signal) {
  canvas.addEventListener('dblclick', event => {
    if (event.pointerType !== 'touch' && !event.sourceCapabilities?.firesTouchEvents) reset();
  }, { passive: true, signal });
  bindCanvasTaps(canvas, { signal, onDoubleTap: reset });
}

/** Start in the original handling mode, with tap-to-scroll available on demand. */
export function bindViewerInput({ canvas, controls, signal, wheelZoom = true, onToggle, onReset }) {
  const rotateSpeed = controls.rotateSpeed;
  const enablePan = controls.enablePan;
  let active = true;
  function applyMode() {
    // Allow OrbitControls to finish pointer bookkeeping even in scroll mode.
    controls.rotateSpeed = active ? rotateSpeed : 0;
    controls.enablePan = active && enablePan;
    controls.enableZoom = active;
    canvas.style.touchAction = active ? 'none' : 'pan-y';
  }
  const clearTap = bindCanvasTaps(canvas, {
    signal, onSingleTap: () => setActive(!active), onDoubleTap: onReset,
  });
  function setActive(next) {
    if (signal.aborted) return;
    clearTap();
    if (active === next) return;
    active = next;
    applyMode();
    onToggle?.(active);
  }
  canvas.addEventListener('wheel', event => {
    if (!active || !wheelZoom) event.stopImmediatePropagation();
  }, { capture: true, passive: true, signal });
  if (!signal.aborted) applyMode();
  return { isActive: () => active, setActive };
}

/** Bridge Safari trackpad magnification to the sculpture while it is handling. */
export function bindViewerZoom({ canvas, signal, canHandle, onZoom }) {
  const document = canvas.ownerDocument;
  const touchPointers = new Set();
  let previousScale;
  const passive = { capture: true, passive: true, signal };
  const gesture = { capture: true, passive: false, signal };
  const validScale = scale => Number.isFinite(scale) && scale > 0;
  const clearGesture = () => { previousScale = undefined; };
  function ownsGesture() {
    if (!canHandle() || touchPointers.size) clearGesture();
    return previousScale !== undefined;
  }

  // A touchscreen pinch already reaches OrbitControls as two touch pointers.
  canvas.addEventListener('pointerdown', event => {
    clearGesture();
    if (event.pointerType === 'touch') touchPointers.add(event.pointerId);
  }, passive);
  const releaseTouch = event => { touchPointers.delete(event.pointerId); };
  document.addEventListener('pointerup', releaseTouch, passive);
  document.addEventListener('pointercancel', releaseTouch, passive);
  canvas.addEventListener('lostpointercapture', releaseTouch, passive);
  document.defaultView?.addEventListener('blur', () => { clearGesture(); touchPointers.clear(); }, passive);

  canvas.addEventListener('gesturestart', event => {
    clearGesture();
    if (!canHandle() || touchPointers.size || !event.cancelable) return;
    previousScale = validScale(event.scale) ? event.scale : 1;
    event.preventDefault();
  }, gesture);
  canvas.addEventListener('gesturechange', event => {
    if (!ownsGesture()) return;
    event.preventDefault();
    if (!validScale(event.scale)) return;
    const factor = previousScale / event.scale;
    previousScale = event.scale;
    if (validScale(factor) && factor !== 1) onZoom(factor);
  }, gesture);
  canvas.addEventListener('gestureend', event => {
    if (ownsGesture()) event.preventDefault();
    clearGesture();
  }, gesture);
  document.addEventListener('gestureend', clearGesture, { passive: true, signal });

  // Some Safari versions also produce Ctrl-wheel from magnification. Keep
  // Three's normal wheel behavior outside an owned GestureEvent sequence.
  canvas.addEventListener('wheel', event => {
    if (!event.ctrlKey || !ownsGesture()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, gesture);
}

// Scope shortcuts to the focused 3D surface, leaving sliders, links and native
// controls alone even when their keyboard events bubble through the stage.
export function handleViewerKey(event, actions) {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.target?.closest?.(FORM_CONTROL)) return false;
  const orbit = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (orbit) actions.orbit(...orbit);
  else if (event.key === '+' || event.key === '=') actions.zoom(0.68);
  else if (event.key === '-' || event.key === '_') actions.zoom(1.46);
  else if (event.key === '0' || event.key === 'Home') actions.reset();
  else if (event.key.toLowerCase() === 'w') actions.toggleWireframe();
  else return false;
  event.preventDefault();
  return true;
}

export function orbitViewer(THREE, camera, controls, horizontal, vertical) {
  if (!controls.enabled || !Number.isFinite(horizontal) || !Number.isFinite(vertical)) return;
  const offset = camera.position.clone().sub(controls.target);
  const up = new THREE.Quaternion().setFromUnitVectors(camera.up, new THREE.Vector3(0, 1, 0));
  const spherical = new THREE.Spherical().setFromVector3(offset.applyQuaternion(up));
  const step = Math.PI / 36;
  spherical.theta = THREE.MathUtils.clamp(spherical.theta + horizontal * step, controls.minAzimuthAngle, controls.maxAzimuthAngle);
  spherical.phi = THREE.MathUtils.clamp(spherical.phi + vertical * step, Math.max(0.01, controls.minPolarAngle), Math.min(Math.PI - 0.01, controls.maxPolarAngle));
  offset.setFromSpherical(spherical).applyQuaternion(up.invert());
  camera.position.copy(controls.target).add(offset);
  camera.lookAt(controls.target);
}
