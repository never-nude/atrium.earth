const FORM_CONTROL = 'input, textarea, select, button, a, summary, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';

export const RELEASE_AFTER_MS = 5000;
const FADE_MS = 1500;
const TAP_MOVEMENT_PX = 8;
const DOUBLE_TAP_MS = 340;
const DOUBLE_TAP_PX = 36;
const MIN_VISIBLE_RATIO = 0.4;
const ORBIT_STEP_RADIANS = Math.PI / 36;
const selectedByDocument = new WeakMap();

/**
 * Register before OrbitControls so both the first pointer and later changes in
 * gesture direction reach it with the right speeds and capabilities.
 */
export function bindViewerGestures({
  canvas, stage, root, signal, wheelZoom = true, enabled = true,
  onSelect, onReset, onWheelOrbit, onStateChange,
}) {
  const document = canvas.ownerDocument;
  const window = document.defaultView;
  const ring = root.querySelector('[data-viewer-ring]');
  const pointers = new Map();
  let controls, selected = false, overlay = false, lastTap;
  let fullscreen = document.fullscreenElement === root;
  let fadeTimer, releaseTimer;

  const free = () => enabled && (selected || fullscreen);
  function applyGate() {
    if (controls) {
      controls.rotateSpeed = free() ? 0.9 : 0;
      controls.enableZoom = free();
      controls.enablePan = free();
    }
    // OrbitControls overwrites touchAction in its constructor. setControls()
    // reapplies this gate without disabling pointer tracking.
    canvas.style.touchAction = free() ? 'none' : 'pan-y';
  }

  function clearIdle() {
    clearTimeout(fadeTimer);
    clearTimeout(releaseTimer);
    ring?.classList.remove('is-fading');
  }

  function interact() {
    clearIdle();
    if (!selected || fullscreen || pointers.size || signal.aborted) return;
    fadeTimer = setTimeout(() => ring?.classList.add('is-fading'), RELEASE_AFTER_MS - FADE_MS);
    releaseTimer = setTimeout(deselect, RELEASE_AFTER_MS);
  }

  function changeSelection(next) {
    if (selected === next) return;
    selected = next;
    root.toggleAttribute('data-selected', selected);
    applyGate();
    if (selected) {
      selectedByDocument.set(document, deselect);
      onSelect?.();
    } else if (selectedByDocument.get(document) === deselect) {
      selectedByDocument.delete(document);
    }
    if (!signal.aborted) onStateChange?.({ selected, fullscreen });
  }

  function select() {
    if (!enabled || selected || fullscreen || signal.aborted) return;
    selectedByDocument.get(document)?.();
    changeSelection(true);
  }

  function deselect() {
    clearIdle();
    pointers.clear();
    lastTap = undefined;
    changeSelection(false);
  }

  function syncFullscreen() {
    const next = overlay || document.fullscreenElement === root;
    if (next === fullscreen || signal.aborted) return;
    fullscreen = next;
    const wasSelected = selected;
    deselect();
    if (next) selectedByDocument.get(document)?.();
    applyGate();
    if (!wasSelected) onStateChange?.({ selected, fullscreen });
  }

  function begin(event) {
    if (!enabled || pointers.has(event.pointerId)) return;
    const { clientX: x, clientY: y, pointerType: type, button } = event;
    pointers.set(event.pointerId, { x, y, type, button, moved: false });
    if (type === 'touch' && [...pointers.values()].filter(pointer => pointer.type === 'touch').length > 1) {
      for (const pointer of pointers.values()) pointer.moved = true;
      lastTap = undefined;
      select();
    }
    interact();
  }

  function move(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const dx = Math.abs(event.clientX - pointer.x);
    const dy = Math.abs(event.clientY - pointer.y);
    if (Math.hypot(dx, dy) >= TAP_MOVEMENT_PX) {
      pointer.moved = true;
      lastTap = undefined;
    }
    const handling = pointer.type === 'touch' ? pointer.moved && dx >= dy : dx > 0 || dy > 0;
    if (handling) select();
  }

  function finish(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointers.delete(event.pointerId);
    const cancelled = event.type !== 'pointerup';
    const distance = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
    if (!cancelled && !pointer.moved && distance < TAP_MOVEMENT_PX && (pointer.type === 'touch' || pointer.button === 0)) {
      select();
      const { clientX: x, clientY: y, timeStamp: time } = event;
      if (lastTap && lastTap.type === pointer.type && time - lastTap.time <= DOUBLE_TAP_MS &&
          Math.hypot(x - lastTap.x, y - lastTap.y) <= DOUBLE_TAP_PX) {
        lastTap = undefined;
        onReset?.();
      } else {
        lastTap = { type: pointer.type, x, y, time };
      }
    } else {
      lastTap = undefined;
    }
    interact();
  }

  if (!signal.aborted) {
    const passive = { passive: true, signal };
    const capture = { ...passive, capture: true };
    canvas.addEventListener('pointerdown', begin, capture);
    document.addEventListener('pointermove', move, capture);
    document.addEventListener('pointerup', finish, capture);
    document.addEventListener('pointercancel', finish, capture);
    canvas.addEventListener('lostpointercapture', finish, passive);
    canvas.addEventListener('wheel', event => {
      // Leave browser wheel scrolling and modifier-directed zoom available
      // whenever we are not handling ordinary wheel input on the sculpture.
      if (!free() || !wheelZoom || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        event.stopImmediatePropagation();
        return;
      }
      // Trackpad swipes arrive as pixel wheel deltas. Keep directional input
      // for orbit, and let Three handle line/page wheel steps as zoom.
      if (onWheelOrbit && event.deltaMode === 0) {
        event.stopImmediatePropagation();
        if (!event.cancelable || ![event.deltaX, event.deltaY].every(Number.isFinite) || (!event.deltaX && !event.deltaY)) return;
        event.preventDefault();
        const height = Math.max(1, canvas.clientHeight);
        const units = delta => Math.max(-0.5, Math.min(0.5, delta / height)) * 2.4 / ORBIT_STEP_RADIANS;
        onWheelOrbit(units(event.deltaX), units(event.deltaY));
      }
      interact();
    }, { capture: true, passive: false, signal });
    const leave = event => {
      // Keep Done reachable when the pointer moves from the stage into its own
      // caption or Options. Moving outside the viewer still releases it.
      if (event.pointerType === 'mouse' && !event.buttons && !fullscreen &&
          !root.contains(event.relatedTarget)) deselect();
    };
    stage.addEventListener('pointerleave', leave, passive);
    root.addEventListener('pointerleave', leave, passive);
    document.addEventListener('pointerdown', event => {
      if (!root.contains(event.target)) deselect();
      else if (selected) interact();
    }, capture);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') deselect();
    }, { signal });
    document.addEventListener('fullscreenchange', syncFullscreen, { signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) deselect();
    }, { signal });
    window?.addEventListener('blur', deselect, { signal });
    window?.addEventListener('scroll', () => {
      if (!pointers.size && !fullscreen) deselect();
    }, passive);
    const visibility = window?.IntersectionObserver && new window.IntersectionObserver(([entry]) => {
      if (entry && entry.intersectionRatio < MIN_VISIBLE_RATIO && !fullscreen && !signal.aborted) deselect();
    }, { threshold: MIN_VISIBLE_RATIO });
    visibility?.observe(stage);

    signal.addEventListener('abort', () => {
      enabled = false;
      deselect();
      applyGate();
      controls = undefined;
      visibility?.disconnect();
    }, { once: true });
  }

  applyGate();
  return {
    setControls(next) {
      if (signal.aborted) return;
      controls = next;
      applyGate();
    },
    setEnabled(next) {
      if (signal.aborted || next === enabled) return;
      enabled = next;
      if (!enabled) deselect();
      applyGate();
    },
    setFullscreen(next) {
      if (signal.aborted) return;
      overlay = next;
      syncFullscreen();
    },
    isSelected: () => selected,
    isFullscreen: () => fullscreen,
    interact,
    deselect,
  };
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
  spherical.theta = THREE.MathUtils.clamp(spherical.theta + horizontal * ORBIT_STEP_RADIANS, controls.minAzimuthAngle, controls.maxAzimuthAngle);
  spherical.phi = THREE.MathUtils.clamp(spherical.phi + vertical * ORBIT_STEP_RADIANS, Math.max(0.01, controls.minPolarAngle), Math.min(Math.PI - 0.01, controls.maxPolarAngle));
  offset.setFromSpherical(spherical).applyQuaternion(up.invert());
  camera.position.copy(controls.target).add(offset);
  camera.lookAt(controls.target);
}
