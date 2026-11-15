const FORM_CONTROL = 'input, textarea, select, button, a, summary, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';

const TAP_MOVEMENT_PX = 8;
const DOUBLE_TAP_MS = 340;
const DOUBLE_TAP_PX = 36;

// Keep the first direction for the whole one-finger gesture. This follows
// model-viewer's SmoothControls election, including horizontal ties.
export function createTouchGesture() {
  let owner = null;
  let startX = 0, startY = 0;
  return {
    get owner() { return owner; },
    begin(x, y, fullscreen) {
      startX = x;
      startY = y;
      owner = fullscreen ? 'sculpture' : 'pending';
    },
    addFinger() { owner = 'sculpture'; },
    move(x, y) {
      if (owner === 'pending') {
        const dx = Math.abs(x - startX), dy = Math.abs(y - startY);
        if (Math.max(dx, dy) >= 2) owner = dy > dx ? 'page' : 'sculpture';
      }
      return owner;
    },
    end() { owner = null; },
  };
}

export function createRotationHold(signal, onChange) {
  let timer, interacting = false, held = false;
  function setHeld(next) {
    if (held === next) return;
    held = next;
    onChange();
  }
  function rest() {
    clearTimeout(timer);
    setHeld(true);
    if (!interacting) timer = setTimeout(() => setHeld(false), 4000);
  }
  signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return {
    get held() { return held; },
    setInteracting(next) { interacting = next; rest(); },
    noteInput: rest,
  };
}

export function bindViewerInput({ canvas, controls, signal, wheelZoom = true, onInteraction, onWheel, onTurn, onReset, onDiscardInertia }) {
  const document = canvas.ownerDocument;
  const pointers = new Map();
  const touch = createTouchGesture();
  const rotateSpeed = controls.rotateSpeed;
  const capture = { capture: true, passive: true, signal };
  let fullscreen = false;
  let nativeTouch = false, interacting = false;
  let lastTap;

  function syncInteraction() {
    const next = nativeTouch || pointers.size > 0;
    if (next === interacting) return;
    interacting = next;
    onInteraction(next);
  }

  function updateSpeed() {
    controls.rotateSpeed = touch.owner && touch.owner !== 'sculpture' ? 0 : rotateSpeed;
  }

  function finish(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointers.delete(event.pointerId);
    const canceled = event.type !== 'pointerup';
    if (canceled) onDiscardInertia();
    if (!pointers.size) {
      touch.end();
      updateSpeed();
      canvas.style.cursor = 'grab';
    }
    syncInteraction();

    const { clientX: x, clientY: y, timeStamp: time } = event;
    if (pointer.type !== 'touch' || canceled || pointer.moved || Math.hypot(x - pointer.x, y - pointer.y) >= TAP_MOVEMENT_PX) {
      lastTap = undefined;
    } else if (lastTap && time - lastTap.time <= DOUBLE_TAP_MS && Math.hypot(x - lastTap.x, y - lastTap.y) <= DOUBLE_TAP_PX) {
      lastTap = undefined;
      onReset();
    } else {
      lastTap = { x, y, time };
    }
  }

  function cancelPointer(pointerId) {
    if (!pointers.has(pointerId)) return;
    // Three's own pointercancel listener clears its document listeners and
    // pointer state. Forward cancellation when the browser only sends touchcancel.
    canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId, bubbles: true }));
    if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  }

  canvas.addEventListener('pointerdown', event => {
    if (!controls.enabled || pointers.has(event.pointerId)) return;
    const isTouch = event.pointerType === 'touch';
    if (!isTouch && event.button !== 0 && event.button !== 1 && event.button !== 2) return;
    const first = pointers.size === 0;
    pointers.set(event.pointerId, { type: event.pointerType, x: event.clientX, y: event.clientY, moved: false, turns: event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey });
    syncInteraction();
    if (first) {
      onDiscardInertia();
      if (isTouch) touch.begin(event.clientX, event.clientY, fullscreen);
      else canvas.style.cursor = 'grabbing';
    }
    if (isTouch && pointers.size > 1) {
      touch.addFinger();
      for (const pointer of pointers.values()) pointer.moved = true;
      lastTap = undefined;
    }
    updateSpeed();
  }, capture);

  document.addEventListener('pointermove', event => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const moved = event.clientX !== pointer.x || event.clientY !== pointer.y;
    if (moved && (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) >= TAP_MOVEMENT_PX)) {
      pointer.moved = true;
      lastTap = undefined;
    }
    if (pointer.type === 'touch') {
      if (touch.move(event.clientX, event.clientY) === 'sculpture' && pointers.size === 1 && moved) {
        pointer.moved = true;
        onTurn();
      }
      updateSpeed();
    } else if (pointer.turns && moved) onTurn();
  }, capture);

  // WebKit needs a non-passive listener installed before the gesture begins.
  // Keep ownership after a sideways start even when the finger moves vertically.
  canvas.addEventListener('touchmove', event => {
    if (touch.owner === 'pending' && event.touches.length === 1) {
      touch.move(event.touches[0].clientX, event.touches[0].clientY);
      updateSpeed();
    }
    if (touch.owner === 'sculpture' && event.cancelable) event.preventDefault();
  }, { passive: false, signal });

  document.addEventListener('pointerup', finish, capture);
  document.addEventListener('pointercancel', finish, capture);
  canvas.addEventListener('lostpointercapture', event => cancelPointer(event.pointerId), capture);
  // A native scroll cancels the pointer before the thumb actually lifts.
  function updateNativeTouch(event) {
    nativeTouch = event.targetTouches.length > 0;
    syncInteraction();
  }
  canvas.addEventListener('touchstart', updateNativeTouch, capture);
  canvas.addEventListener('touchend', updateNativeTouch, capture);
  canvas.addEventListener('touchcancel', event => {
    for (const [id, pointer] of pointers) if (pointer.type === 'touch') cancelPointer(id);
    updateNativeTouch(event);
  }, capture);
  document.defaultView?.addEventListener('blur', () => {
    nativeTouch = false;
    for (const id of pointers.keys()) cancelPointer(id);
    syncInteraction();
  }, capture);
  signal.addEventListener('abort', () => {
    for (const id of pointers.keys()) cancelPointer(id);
  }, { once: true });

  canvas.addEventListener('dblclick', event => {
    if (event.pointerType !== 'touch' && !event.sourceCapabilities?.firesTouchEvents) onReset();
  }, capture);
  canvas.addEventListener('wheel', event => {
    const modified = event.ctrlKey || event.metaKey;
    if (!controls.enabled || !wheelZoom || (!fullscreen && !modified)) {
      event.stopImmediatePropagation();
      return;
    }
    if (event.cancelable) event.preventDefault();
    onWheel();
  }, { capture: true, passive: false, signal });

  canvas.style.cursor = 'grab';
  function setFullscreen(next) {
    fullscreen = next;
    canvas.style.touchAction = fullscreen ? 'none' : 'pan-y';
  }
  setFullscreen(false);
  return { setFullscreen };
}

/** Bridge Safari trackpad magnification to the sculpture when wheel zoom is enabled. */
export function bindViewerZoom({ canvas, signal, canHandle, onZoom, onInteraction = () => {} }) {
  const document = canvas.ownerDocument;
  const touchPointers = new Set();
  let previousScale;
  const passive = { capture: true, passive: true, signal };
  const gesture = { capture: true, passive: false, signal };
  const validScale = scale => Number.isFinite(scale) && scale > 0;
  const clearGesture = () => {
    if (previousScale === undefined) return;
    previousScale = undefined;
    onInteraction(false);
  };
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
    onInteraction(true);
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
