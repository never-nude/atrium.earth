const FORM_CONTROL = 'input, textarea, select, button, a, summary, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';

const DOUBLE_TAP_MS = 340;
const DOUBLE_TAP_PX = 36;

const SCROLL_QUIET_MS = 150;
const scrollClocks = new WeakMap();
const touchSequences = new WeakMap();

function scrollClock(document) {
  if (!scrollClocks.has(document)) {
    let last = -Infinity;
    document.addEventListener('scroll', () => { last = performance.now(); }, { capture: true, passive: true });
    scrollClocks.set(document, () => last);
  }
  return scrollClocks.get(document);
}

export function createTouchGesture(hit) {
  let owner = null, lockedToPage = false;
  function hits(point) { return hit(point.clientX, point.clientY); }
  function hitsMidpoint(points) {
    return points.length > 1 && hit(
      (points[0].clientX + points[1].clientX) / 2,
      (points[0].clientY + points[1].clientY) / 2,
    );
  }
  return {
    get owner() { return owner; },
    begin(points, canClaim, fullscreen) {
      lockedToPage = !canClaim;
      owner = canClaim && (fullscreen || hits(points[0]) || hitsMidpoint(points)) ? 'sculpture' : 'page';
    },
    addFinger(points, canClaim) {
      if (owner !== 'page') return;
      if (!canClaim) lockedToPage = true;
      if (!lockedToPage && hitsMidpoint(points)) owner = 'sculpture';
    },
    end() { owner = null; lockedToPage = false; },
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
    if (signal.aborted) return;
    clearTimeout(timer);
    setHeld(true);
    if (!interacting) timer = setTimeout(() => setHeld(false), 4000);
  }
  signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return {
    get held() { return held; },
    get interacting() { return interacting; },
    setInteracting(next) { interacting = next; rest(); },
    noteInput: rest,
    resume() {
      if (interacting || !held || signal.aborted) return false;
      clearTimeout(timer);
      setHeld(false);
      return true;
    },
  };
}

export function bindViewerInput({
  canvas, controls, signal, wheelZoom = true, hit, onOrbit, onPan, onZoom,
  onInteraction, onWheel, onTurn, onReset, onDiscardInertia,
}) {
  const document = canvas.ownerDocument;
  const lastScroll = scrollClock(document);
  const touch = createTouchGesture((x, y) => hit(x, y, true));
  const capture = { capture: true, passive: true, signal };
  let fullscreen = false, sequence, landedAt, previous, lastTap, mouse;
  let moved = false;

  const claimable = event => event.cancelable && controls.enabled && (fullscreen || (
    performance.now() - lastScroll() >= SCROLL_QUIET_MS && lastScroll() < (landedAt ?? Infinity)
  ));
  const prevent = event => { if (event.cancelable) event.preventDefault(); };
  const singlePoint = points => points.length === 1 ? points[0] : {
    clientX: (points[0].clientX + points[1].clientX) / 2,
    clientY: (points[0].clientY + points[1].clientY) / 2,
  };
  function measure(points) {
    const first = points[0].identifier, second = points[1]?.identifier;
    return {
      point: singlePoint(points),
      ids: second === undefined ? [first, undefined] : [Math.min(first, second), Math.max(first, second)],
      distance: points.length < 2 ? 0 : Math.hypot(points[0].clientX - points[1].clientX, points[0].clientY - points[1].clientY),
    };
  }

  function holdTouch(event) {
    prevent(event);
    onInteraction(true);
    onDiscardInertia();
  }

  function addTouch(event) {
    const points = event.touches;
    const owned = touch.owner === 'sculpture';
    touch.addFinger(points, claimable(event));
    if (touch.owner === 'sculpture') {
      if (!owned) holdTouch(event);
      else prevent(event);
      previous = measure(points);
      moved = true;
      lastTap = undefined;
    }
  }

  function startTouch(event) {
    if (!event.touches.length || event.defaultPrevented || touchSequences.has(document)) return;
    touch.begin(event.touches, claimable(event), fullscreen);
    landedAt = performance.now();
    sequence = new AbortController();
    touchSequences.set(document, sequence);
    moved = event.touches.length > 1;
    if (touch.owner === 'sculpture') {
      holdTouch(event);
      previous = measure(event.touches);
    } else lastTap = undefined;
    // Keep the non-passive document listeners scoped to an active touch so a
    // second finger can land beyond the canvas without delaying other traffic.
    const gesture = { capture: true, passive: false, signal: sequence.signal };
    document.addEventListener('touchstart', addTouch, gesture);
    document.addEventListener('touchmove', event => { if (event.target !== canvas) moveTouch(event); }, gesture);
    document.addEventListener('touchend', endTouch, gesture);
    document.addEventListener('touchcancel', endTouch, gesture);
  }

  function moveTouch(event) {
    if (touch.owner !== 'sculpture' || !event.touches.length || !controls.enabled) return;
    prevent(event);
    const next = measure(event.touches);
    const sameFingers = previous.ids.every((id, index) => id === next.ids[index]);
    const dx = next.point.clientX - previous.point.clientX, dy = next.point.clientY - previous.point.clientY;
    if (sameFingers) {
      if (next.ids[1] !== undefined) {
        if (previous.distance > 0 && next.distance > 0 && next.distance !== previous.distance) onZoom(previous.distance / next.distance);
        if (dx || dy) onPan(dx, dy);
      } else if (dx || dy) {
        onOrbit(dx, dy);
        onTurn();
      }
      if (dx || dy || next.distance !== previous.distance) moved = true;
    }
    previous = next;
  }

  function clearTouch(canceled) {
    const owned = touch.owner === 'sculpture';
    if (owned) {
      if (canceled) onDiscardInertia();
      onInteraction(false);
    }
    if (touchSequences.get(document) === sequence) touchSequences.delete(document);
    sequence?.abort();
    sequence = undefined;
    touch.end();
    previous = undefined;
    landedAt = undefined;
  }

  function endTouch(event) {
    const canceled = event.type === 'touchcancel';
    const owned = touch.owner === 'sculpture';
    if (owned) prevent(event);
    if (!canceled && event.touches.length) {
      if (owned) previous = measure(event.touches);
      return;
    }
    clearTouch(canceled);
    if (!owned || canceled || moved || !event.changedTouches.length) {
      lastTap = undefined;
      return;
    }
    const {clientX: x, clientY: y} = event.changedTouches[0];
    const time = event.timeStamp;
    if (lastTap && time - lastTap.time <= DOUBLE_TAP_MS && Math.hypot(x - lastTap.x, y - lastTap.y) <= DOUBLE_TAP_PX) {
      lastTap = undefined;
      onReset();
    } else lastTap = { x, y, time };
  }

  canvas.addEventListener('touchstart', startTouch, { passive: false, signal });
  // WebKit can make touchmove non-cancelable unless a non-passive listener
  // is already installed when the first finger lands.
  canvas.addEventListener('touchmove', moveTouch, { passive: false, signal });
  canvas.addEventListener('pointerdown', event => {
    // Native TouchEvents alone decide who receives a finger. Three still owns
    // mouse and wheel gestures, which use its original pointer capture.
    if (event.pointerType === 'touch') { event.stopImmediatePropagation(); return; }
    if (!controls.enabled || sequence || event.button > 2 || (!fullscreen && !hit(event.clientX, event.clientY, false))) {
      event.stopImmediatePropagation();
      return;
    }
    mouse = { id: event.pointerId, turns: event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey };
    onInteraction(true);
    onDiscardInertia();
    canvas.style.cursor = 'grabbing';
  }, capture);
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || mouse) return;
    canvas.style.cursor = fullscreen || hit(event.clientX, event.clientY, false) ? 'grab' : 'auto';
  }, capture);
  canvas.addEventListener('pointerleave', () => { if (!mouse) canvas.style.cursor = 'auto'; }, capture);
  document.addEventListener('pointermove', event => {
    if (mouse?.id === event.pointerId && mouse.turns && (event.movementX || event.movementY)) onTurn();
  }, capture);
  function endMouse(event) {
    if (mouse?.id !== event.pointerId) return;
    mouse = undefined;
    if (event.type !== 'pointerup') onDiscardInertia();
    canvas.style.cursor = fullscreen || hit(event.clientX, event.clientY, false) ? 'grab' : 'auto';
    onInteraction(false);
  }
  document.addEventListener('pointerup', endMouse, capture);
  document.addEventListener('pointercancel', endMouse, capture);
  function cancelMouse() {
    if (!mouse) return;
    const { id } = mouse;
    canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: id, bubbles: true }));
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    mouse = undefined;
    onInteraction(false);
    canvas.style.cursor = 'auto';
  }
  canvas.addEventListener('lostpointercapture', cancelMouse, capture);
  document.defaultView?.addEventListener('blur', () => { clearTouch(true); cancelMouse(); }, capture);
  signal.addEventListener('abort', () => { clearTouch(true); cancelMouse(); }, { once: true });
  canvas.addEventListener('contextmenu', event => {
    if (!mouse && !fullscreen && !hit(event.clientX, event.clientY, false)) event.stopImmediatePropagation();
  }, capture);
  canvas.addEventListener('dblclick', event => {
    if (event.pointerType !== 'touch' && !event.sourceCapabilities?.firesTouchEvents && (fullscreen || hit(event.clientX, event.clientY, false))) onReset();
  }, capture);
  canvas.addEventListener('wheel', event => {
    const modified = event.ctrlKey || event.metaKey;
    if (!controls.enabled || !wheelZoom || (!fullscreen && !modified)) {
      event.stopImmediatePropagation();
      return;
    }
    prevent(event);
    onWheel();
  }, { capture: true, passive: false, signal });

  function setFullscreen(next) {
    fullscreen = next;
    canvas.style.cursor = fullscreen ? 'grab' : 'auto';
    canvas.style.touchAction = fullscreen ? 'none' : 'auto';
  }
  setFullscreen(false);
  return { setFullscreen, get hasTouchSequence() { return Boolean(sequence); } };
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

export function orbitViewer(THREE, camera, controls, horizontal, vertical, step = Math.PI / 36) {
  if (!controls.enabled || !Number.isFinite(horizontal) || !Number.isFinite(vertical)) return;
  const offset = camera.position.clone().sub(controls.target);
  const up = new THREE.Quaternion().setFromUnitVectors(camera.up, new THREE.Vector3(0, 1, 0));
  const spherical = new THREE.Spherical().setFromVector3(offset.applyQuaternion(up));
  spherical.theta = THREE.MathUtils.clamp(spherical.theta + horizontal * step, controls.minAzimuthAngle, controls.maxAzimuthAngle);
  spherical.phi = THREE.MathUtils.clamp(spherical.phi + vertical * step, Math.max(0.01, controls.minPolarAngle), Math.min(Math.PI - 0.01, controls.maxPolarAngle));
  offset.setFromSpherical(spherical).applyQuaternion(up.invert());
  camera.position.copy(controls.target).add(offset);
  camera.lookAt(controls.target);
}
