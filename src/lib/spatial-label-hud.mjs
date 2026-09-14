import { createArtworkLabelCanvas } from './spatial-artwork-label.mjs';

// Headsets often have no DOM overlay. Render a small camera-relative label there
// as well, independent of sculpture rotation, placement and physical scale.
export function createSpatialLabelHUD(THREE, label, mode) {
  const canvas = createArtworkLabelCanvas(label);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const object = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  }));
  object.name = 'Atrium artwork label';
  object.renderOrder = 10000;
  object.frustumCulled = false;
  object.visible = false;
  const poseMatrix = new THREE.Matrix4();
  const orientation = new THREE.Quaternion();
  const offset = new THREE.Vector3();
  return {
    object,
    update(pose) {
      if (!pose?.views?.[0]) { object.visible = false; return; }
      const p = pose.views[0].projectionMatrix;
      const distance = mode === 'immersive-vr' ? 1.2 : 0.7;
      const visibleWidth = 2 * distance / p[0];
      const width = mode === 'immersive-vr' ? Math.min(0.55, visibleWidth * 0.6) : visibleWidth * 0.85;
      const height = width * canvas.height / canvas.width;
      const left = distance * (p[8] - 1) / p[0];
      const bottom = distance * (p[9] - 1) / p[5];
      const margin = visibleWidth * 0.05;
      poseMatrix.fromArray(pose.transform.matrix);
      orientation.setFromRotationMatrix(poseMatrix);
      // Keep the VR label in the comfortable central field rather than at the
      // headset lens edge. AR without DOM uses the phone's lower-left corner.
      offset.set(mode === 'immersive-vr' ? -0.15 : left + margin + width / 2,
        mode === 'immersive-vr' ? -0.28 : bottom + margin + height / 2, -distance).applyQuaternion(orientation);
      object.position.setFromMatrixPosition(poseMatrix).add(offset);
      object.quaternion.copy(orientation);
      object.scale.set(width, height, 1);
      object.visible = true;
    },
    dispose() { object.removeFromParent(); object.geometry.dispose(); object.material.dispose(); texture.dispose(); },
  };
}
