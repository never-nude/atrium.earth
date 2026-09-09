import { referenceScaleFor } from './physical-dimensions.mjs';

const clampHeight = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0.2, Math.min(1.4, number)) : 1;
};

// Bounds determine the furniture's fit, never evidence of an artwork's size.
// Automatic supports require the same valid physical reference used by AR/VR.
export function supportLayoutFor(box, reference, { mode = 'surface', sessionMode = 'immersive-vr', height = 1 } = {}) {
  const axes = ['x', 'y', 'z'];
  const validBounds = axes.every((axis) => Number.isFinite(box?.min?.[axis])
    && Number.isFinite(box?.max?.[axis]) && box.max[axis] >= box.min[axis]);
  const calibrated = validBounds && axes.includes(reference?.axis)
    && Number.isFinite(reference.meters) && reference.meters > 0
    && box.max[reference.axis] > box.min[reference.axis];
  const scale = validBounds ? referenceScaleFor(box, reference) : 1;
  const size = Object.fromEntries(axes.map((axis) => [axis,
    validBounds ? (box.max[axis] - box.min[axis]) * scale : 0,
  ]));
  const automatic = mode === 'auto' && sessionMode === 'immersive-vr' && calibrated
    && size.y > 0 && size.y <= 0.7 && size.x <= 1.2 && size.z <= 1.2;
  return {
    visible: mode === 'plinth' || automatic,
    height: clampHeight(height),
    width: Math.max(0.28, size.x + 0.12),
    depth: Math.max(0.28, size.z + 0.12),
    centerX: validBounds ? (box.min.x + box.max.x) * 0.5 * scale : 0,
    centerZ: validBounds ? (box.min.z + box.max.z) * 0.5 * scale : 0,
  };
}

// This group is independent of the artwork's scale. All dimensions are metres;
// its bottom rests at y=0 and its solid top is exactly the selected height.
export function createDisplaySupport(THREE, layout) {
  const object = new THREE.Group();
  object.name = 'Atrium display support';
  object.visible = Boolean(layout.visible);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    color: 0xc9c2b6,
    roughness: 1,
    metalness: 0,
    // A little fill keeps the furniture visible in scenes without room light.
    // Standard material also preserves compatibility with Apple USDZ exports.
    emissive: 0x605b52,
    emissiveIntensity: 0.3,
    transparent: false,
    opacity: 1,
    depthWrite: true,
  });
  const plinth = new THREE.Mesh(geometry, material);
  plinth.name = 'Display furniture';
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  plinth.scale.x = Number.isFinite(layout.width) && layout.width > 0 ? layout.width : 0.28;
  plinth.scale.z = Number.isFinite(layout.depth) && layout.depth > 0 ? layout.depth : 0.28;
  plinth.position.x = Number.isFinite(layout.centerX) ? layout.centerX : 0;
  plinth.position.z = Number.isFinite(layout.centerZ) ? layout.centerZ : 0;
  object.add(plinth);
  const setHeight = (meters) => {
    const height = clampHeight(meters);
    plinth.scale.y = height;
    plinth.position.y = height / 2;
    return height;
  };
  setHeight(layout.height);
  let disposed = false;
  return {
    object,
    setHeight,
    dispose() {
      if (disposed) return;
      disposed = true;
      object.removeFromParent();
      object.clear();
      geometry.dispose();
      material.dispose();
    },
  };
}
