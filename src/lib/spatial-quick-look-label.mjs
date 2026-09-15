import { strFromU8, strToU8, zipSync } from 'three/examples/jsm/libs/fflate.module.js';
import { createArtworkLabelCanvas } from './spatial-artwork-label.mjs';

// A scene object is photographed by Quick Look without replacing its camera UI.
// Keep it outside Artwork's physical-scale transform and clear of the sculpture.
export function addQuickLookArtworkLabel(THREE, scene, label) {
  const artwork = scene.getObjectByName('Artwork');
  const bounds = new THREE.Box3().setFromObject(artwork, true);
  const size = bounds.getSize(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  const canvas = createArtworkLabelCanvas(label, 260, 3);
  // Flatten translucency: a real plaque needs an opaque, readable background.
  const context = canvas.getContext('2d');
  context.globalCompositeOperation = 'destination-over';
  context.fillStyle = '#0e1626';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const width = Math.max(0.12, extent * 0.65);
  const height = width * canvas.height / canvas.width;
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveMap: texture,
    roughness: 1, metalness: 0, toneMapped: false,
  });
  const object = new THREE.Mesh(geometry, material);
  object.name = `AtriumArtworkLabel_${object.uuid.replaceAll('-', '_')}`;
  object.position.set(
    bounds.max.x + Math.max(0.025, extent * 0.1) + width / 2,
    Math.max(bounds.min.y + height / 2, bounds.min.y + size.y * 0.65),
    bounds.getCenter(new THREE.Vector3()).z,
  );
  scene.add(object);
  scene.updateMatrixWorld(true);
  return {
    object,
    dispose() { object.removeFromParent(); geometry.dispose(); material.dispose(); texture.dispose(); },
  };
}

// Apple Preliminary USD behaviors, supported by AR Quick Look:
// https://developer.apple.com/documentation/usd/lookatcameraaction
// https://developer.apple.com/documentation/usd/groupaction
// Free look (zero upVector) also follows camera elevation, useful above small works:
// https://engine.needle.tools/docs/how-to-guides/everywhere-actions/
function cameraFacingBehavior(name) {
  if (!/^AtriumArtworkLabel_[A-Za-z0-9_]+$/.test(name)) throw new Error('Invalid artwork label target');
  return `
      def Preliminary_Behavior "AtriumLabelFacesCamera" {
        rel triggers = [ <SceneEntered> ]
        rel actions = [ <FollowCamera> ]
        uniform bool exclusive = false
        def Preliminary_Trigger "SceneEntered" {
          uniform token info:id = "SceneTransition"
          uniform token type = "enter"
        }
        def Preliminary_Action "FollowCamera" {
          uniform token info:id = "Group"
          uniform token type = "serial"
          uniform bool loops = true
          uniform uint performCount = 0
          rel actions = [ <FaceCamera> ]
          def Preliminary_Action "FaceCamera" {
            uniform token info:id = "LookAtCamera"
            rel affectedObjects = [ </Root/Scenes/Scene/${name}> ]
            uniform double duration = 1
            uniform vector3d front = (0, 0, 1)
            uniform vector3d upVector = (0, 0, 0)
          }
        }
      }
`;
}

export function faceQuickLookLabelToCamera(bytes, name) {
  // USDZExporter writes uncompressed ZIP entries. Retain views of their bytes
  // instead of inflating/copying every model texture again on a phone.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = {};
  let offset = 0;
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    if (view.getUint16(offset + 8, true) !== 0 || (view.getUint16(offset + 6, true) & 8)) {
      throw new Error('Expected an uncompressed USDZ export');
    }
    const length = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const start = offset + 30 + nameLength + view.getUint16(offset + 28, true);
    if (start + length > bytes.length) throw new Error('Incomplete USDZ export');
    const filename = strFromU8(bytes.subarray(offset + 30, offset + 30 + nameLength));
    files[filename] = bytes.subarray(start, start + length);
    offset = start + length;
  }
  if (!files['model.usda']) throw new Error('Missing USDZ scene');
  const model = strFromU8(files['model.usda']);
  if (!model.includes(`def Xform "${name}"`)) throw new Error('Missing exported artwork label');
  // Insert within the existing Scene prim; a second same-layer `over Root`
  // declaration is invalid USD even though it resembles layer composition.
  const anchor = 'token preliminary:planeAnchoring:alignment = "horizontal"';
  if (!model.includes(anchor)) throw new Error('Missing Quick Look scene anchor');
  files['model.usda'] = strToU8(model.replace(anchor, anchor + '\n' + cameraFacingBehavior(name)));

  // Every file's data must start on a 64-byte boundary, including after the
  // changed scene length. Keep the primary USD scene first and compression off.
  offset = 0;
  for (const [filename, data] of Object.entries(files)) {
    const headerEnd = offset + 30 + strToU8(filename).length;
    const padding = (64 - ((headerEnd + 4) % 64)) % 64;
    files[filename] = [data, { extra: { 12345: new Uint8Array(padding) } }];
    offset = headerEnd + 4 + padding + data.length;
  }
  return zipSync(files, { level: 0 });
}
