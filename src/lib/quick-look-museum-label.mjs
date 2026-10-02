import { museumLabelFont, wrapMuseumLabelText } from './museum-label.mjs';

// The label is a physical, upright part of the AR scene. It has no camera-facing
// behavior, phone-orientation transform, or inherited scan-axis correction.
export function createMuseumPlacardCanvas(label) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const width = 320, padding = 16, resolution = 3;
  const groups = [
    [label.title, 21, 500], [label.maker, 14, 400],
    [[label.period, label.region].filter(Boolean).join(' · '), 13, 400],
    [label.material, 13, 400],
  ];
  const rows = [];
  let y = padding;
  for (const [text, size, weight] of groups) {
    if (!text) continue;
    const font = `${weight} ${size}px ${museumLabelFont}`;
    context.font = font;
    if (rows.length) y += 5;
    for (const line of wrapMuseumLabelText(context, text, width - padding * 2)) {
      rows.push({ text: line, font, y });
      y += size * 1.35;
    }
  }
  canvas.width = width * resolution;
  canvas.height = Math.ceil(y + padding) * resolution;
  context.scale(resolution, resolution);
  // One small, matte slate label keeps every fact readable against any room.
  context.fillStyle = '#0e1626';
  context.fillRect(0, 0, width, canvas.height / resolution);
  context.fillStyle = '#f7f5ef';
  context.textBaseline = 'top';
  for (const row of rows) {
    context.font = row.font;
    context.fillText(row.text, padding, row.y);
  }
  return { canvas, rows };
}

export function museumPlacardPlacement(bounds, aspect, clearance = bounds) {
  const height = bounds.max.y - bounds.min.y;
  const depth = bounds.max.z - bounds.min.z;
  const extent = Math.max(height, Math.min(bounds.max.x - bounds.min.x, depth));
  if (!(extent > 0) || !(aspect > 0) || !Number.isFinite(extent + aspect)) throw new Error('Artwork label needs valid bounds.');
  // Scale from artwork height, not its longest limb or an optional stand. Fit
  // long catalogue entries vertically while retaining every line of text.
  const width = Math.min(extent * .65, extent * .62 / aspect);
  const labelHeight = width * aspect;
  const gap = Math.max(.015, extent * .18, depth * .22);
  // Very flat works also get an upright label, wholly above their support plane.
  const bottom = bounds.min.y + Math.max(height * .68 - labelHeight, extent * .06);
  return {
    width, height: labelHeight, gap,
    x: clearance.max.x + gap + width / 2,
    y: bottom + labelHeight / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
}

export function addQuickLookMuseumLabel(THREE, scene, label) {
  const artwork = scene.getObjectByName('Artwork');
  if (!artwork || !label.title) throw new Error('Artwork label is unavailable.');
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(artwork, true);
  const clearance = new THREE.Box3().setFromObject(scene, true);
  const { canvas, rows } = createMuseumPlacardCanvas(label);
  const placement = museumPlacardPlacement(bounds, canvas.height / canvas.width, clearance);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveMap: texture,
    roughness: 1, metalness: 0, toneMapped: false,
  });
  const object = new THREE.Group();
  object.name = 'AtriumMuseumLabel';
  object.position.set(placement.x, placement.y, placement.z);
  // PlaneGeometry is XY, with Y up and its front normal along +Z, matching the
  // exported Y-up stage. The sibling Artwork keeps its own scale and transforms.
  const frontGeometry = new THREE.PlaneGeometry(placement.width, placement.height);
  const front = new THREE.Mesh(frontGeometry, material);
  front.name = 'MuseumLabelFront';
  // A separately authored back face remains readable when walking around the
  // work. Bake the half turn into geometry; no runtime rotation is involved.
  const backGeometry = frontGeometry.clone().rotateY(Math.PI);
  backGeometry.translate(0, 0, -Math.min(.001, placement.width * .002));
  const back = new THREE.Mesh(backGeometry, material);
  back.name = 'MuseumLabelBack';
  object.add(front, back);
  scene.add(object);
  scene.updateMatrixWorld(true);
  return {
    object, placement, canvas, rows,
    dispose() {
      object.removeFromParent();
      frontGeometry.dispose(); backGeometry.dispose(); material.dispose(); texture.dispose();
    },
  };
}
