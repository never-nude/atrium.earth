// Gestures edit the placed world anchor, never the tracked camera. A drag must
// start on the sculpture; two fingers on the camera canvas explicitly resize it.
export function bindArtworkGestures({ THREE, canvas, camera, model, anchor, canEdit, getScale, setScale }) {
  const pointers = new Map();
  const raycaster = new THREE.Raycaster(), screen = new THREE.Vector2();
  const plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3();
  let dragging = false, pinch;
  const rayAt = event => {
    const rect = canvas.getBoundingClientRect();
    screen.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    raycaster.setFromCamera(screen, camera);
  };
  const distance = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };
  const cancel = () => {
    for (const id of pointers.keys()) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    pointers.clear(); dragging = false; pinch = undefined;
  };
  const down = event => {
    if (!canEdit() || event.button > 0 || pointers.size >= 2) return;
    pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    if (pointers.size === 2) {
      dragging = false;
      const separation = distance();
      pinch = separation > 8 ? { distance: separation, scale: getScale() } : undefined;
    } else {
      rayAt(event); model.updateWorldMatrix(true, true);
      const hit = raycaster.intersectObject(model, true)[0];
      dragging = Boolean(hit);
      if (hit) {
        plane.set(new THREE.Vector3(0, 1, 0), -hit.point.y);
        offset.copy(anchor.position).sub(hit.point);
      }
    }
    event.preventDefault();
  };
  const move = event => {
    if (!pointers.has(event.pointerId)) return;
    if (!canEdit()) { cancel(); return; }
    pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    if (pinch && pointers.size === 2) setScale(pinch.scale * distance() / pinch.distance);
    else if (dragging && pointers.size === 1) {
      rayAt(event);
      if (raycaster.ray.intersectPlane(plane, point) && point.distanceTo(camera.position) < 15) {
        // Keep the base on its original surface while translating horizontally.
        anchor.position.x = point.x + offset.x; anchor.position.z = point.z + offset.z;
      }
    }
    event.preventDefault();
  };
  const up = event => {
    pointers.delete(event.pointerId);
    dragging = false; pinch = undefined;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);
  return {
    cancel,
    dispose() {
      cancel();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('lostpointercapture', up);
    },
  };
}
