const FORM_CONTROL = 'input, textarea, select, button, a, summary, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';

// Mouse double-click stays native. Recognize touch double-taps directly so
// browsers that only dispatch the two pointer sequences still reset the view.
export function bindViewerReset(canvas, reset, signal) {
  const touches = new Map();
  let lastTap;
  const options = { passive: true, signal };
  canvas.addEventListener('dblclick', event => {
    if (event.pointerType !== 'touch' && !event.sourceCapabilities?.firesTouchEvents) reset();
  }, options);
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: false });
    if (touches.size > 1) {
      lastTap = undefined;
      for (const touch of touches.values()) touch.moved = true;
    }
  }, options);
  canvas.addEventListener('pointermove', event => {
    const touch = touches.get(event.pointerId);
    if (touch && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) >= 8) touch.moved = true;
  }, options);
  const finish = event => {
    const touch = touches.get(event.pointerId);
    if (!touch) return;
    touches.delete(event.pointerId);
    const { clientX: x, clientY: y, timeStamp: time } = event;
    if (event.type !== 'pointerup' || touch.moved || Math.hypot(x - touch.x, y - touch.y) >= 8) {
      lastTap = undefined;
      return;
    }
    if (lastTap && time - lastTap.time <= 340 && Math.hypot(x - lastTap.x, y - lastTap.y) <= 36) {
      lastTap = undefined;
      reset();
    } else {
      lastTap = { x, y, time };
    }
  };
  const capture = { ...options, capture: true };
  canvas.ownerDocument.addEventListener('pointerup', finish, capture);
  canvas.ownerDocument.addEventListener('pointercancel', finish, capture);
  canvas.addEventListener('lostpointercapture', finish, options);
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
