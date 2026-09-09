import { referenceScaleFor } from './physical-dimensions.mjs';
import { createDisplaySupport, supportLayoutFor } from './display-support.mjs';

// WebXR owns the render loop only during an immersive session. Everything moved
// into the room is restored on exit, including a denied or interrupted start.
export async function startSpatialSession(context, sessionPromise, mode, overlay, options = {}) {
  const { THREE, renderer, scene, camera, model, ground, grid, box, suspend } = context;
  const session = await sessionPromise;
  if (options.signal?.aborted) {
    await session.end();
    throw new DOMException('Viewing cancelled.', 'AbortError');
  }
  let resume;
  try { resume = suspend(); }
  catch (error) { await session.end(); throw error; }
  const saved = {
    parent: model.parent, groundParent: ground.parent,
    groundPosition: ground.position.clone(), groundVisible: ground.visible,
    groundScale: ground.scale.clone(),
    gridPosition: grid.position.clone(), gridVisible: grid.visible,
    background: scene.background, camera: camera.clone(),
    xrEnabled: renderer.xr.enabled,
    clearColor: renderer.getClearColor(new THREE.Color()), clearAlpha: renderer.getClearAlpha(),
  };
  // Furniture lives in room metres. Only the artwork receives its reference scale.
  const anchor = new THREE.Group();
  const referenceScale = referenceScaleFor(box, options.reference);
  const layout = supportLayoutFor(box, options.reference, { ...options.support, sessionMode: mode });
  const placementSurface = layout.visible ? 'floor' : 'floor or table';
  const support = createDisplaySupport(THREE, layout);
  let supportHeight = layout.visible ? layout.height : 0;
  const content = new THREE.Group();
  let displayScale = 1;
  const setScale = (value) => {
    const number = Number(value);
    displayScale = Number.isFinite(number) ? Math.max(0.1, Math.min(2, number)) : 1;
    const scale = referenceScale * displayScale;
    content.scale.setScalar(scale);
    content.position.y = supportHeight - box.min.y * scale;
    ground.scale.copy(saved.groundScale).multiplyScalar(scale);
    options.onScale?.(displayScale);
  };
  setScale(1);
  content.add(model);
  anchor.add(content, support.object);
  anchor.add(ground);
  ground.position.set(0, 0.001, 0);
  grid.position.y = 0;
  grid.visible = mode === 'immersive-vr';
  anchor.position.set(0, 0, -2);
  anchor.visible = mode === 'immersive-vr';
  scene.add(anchor);
  const showSupport = () => options.onSupport?.({ visible: layout.visible, height: supportHeight });
  const setSupportHeight = (meters) => {
    if (!layout.visible) return;
    supportHeight = support.setHeight(meters);
    content.position.y = supportHeight - box.min.y * referenceScale * displayScale;
    showSupport();
  };
  showSupport();
  scene.background = mode === 'immersive-ar' ? null : new THREE.Color('#101c2c');
  renderer.setClearColor(mode === 'immersive-ar' ? 0 : '#101c2c', mode === 'immersive-ar' ? 0 : 1);
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.09, 0.12, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xe4d3a4, side: THREE.DoubleSide, depthTest: false }),
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
  let hitSource;
  let ended = false;
  let cleaned = false;
  let placed = mode === 'immersive-vr';
  let hasSurface = false;
  let lastFrame;
  const setStatus = (message) => options.onStatus?.(message);
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    ended = true;
    hitSource?.cancel();
    renderer.setAnimationLoop(null);
    session.removeEventListener('end', onEnd);
    session.removeEventListener('select', onSelect);
    options.signal?.removeEventListener('abort', onAbort);
    saved.parent.add(model);
    saved.groundParent.add(ground);
    ground.position.copy(saved.groundPosition);
    ground.scale.copy(saved.groundScale);
    ground.visible = saved.groundVisible;
    grid.position.copy(saved.gridPosition);
    grid.visible = saved.gridVisible;
    scene.remove(anchor, reticle);
    reticle.geometry.dispose();
    reticle.material.dispose();
    support.dispose();
    scene.background = saved.background;
    camera.copy(saved.camera);
    renderer.xr.enabled = saved.xrEnabled;
    renderer.setClearColor(saved.clearColor, saved.clearAlpha);
    resume();
    options.onEnd?.();
  };
  // Three's session-end listener also restores the framebuffer and viewport.
  const onEnd = () => { ended = true; queueMicrotask(cleanup); };
  const onAbort = () => { void session.end().catch(() => setStatus('Use your device’s system exit control to leave immersive viewing.')); };
  const onSelect = () => {
    if (mode === 'immersive-ar' && reticle.visible) {
      anchor.position.setFromMatrixPosition(reticle.matrix);
      anchor.visible = true;
      placed = true;
      reticle.visible = false;
      setStatus('Placed. Walk around the sculpture, or adjust its size and direction.');
    } else if (mode === 'immersive-vr') {
      anchor.rotation.y += Math.PI / 6;
    }
  };
  session.addEventListener('end', onEnd);
  session.addEventListener('select', onSelect);
  options.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType(mode === 'immersive-ar' ? 'local' : 'local-floor');
    await renderer.xr.setSession(session);
    if (ended || options.signal?.aborted) throw new DOMException('Viewing cancelled.', 'AbortError');
    if (mode === 'immersive-ar') {
      const viewerSpace = await session.requestReferenceSpace('viewer');
      if (ended || options.signal?.aborted) throw new DOMException('Viewing cancelled.', 'AbortError');
      hitSource = await session.requestHitTestSource({ space: viewerSpace });
      if (!hitSource) throw new Error('Surface detection is unavailable.');
      if (ended || options.signal?.aborted) {
        hitSource.cancel();
        throw new DOMException('Viewing cancelled.', 'AbortError');
      }
      setStatus(`Move your phone to find a ${placementSurface}. Tap the ring to place ${layout.visible ? 'the stand and sculpture' : 'the sculpture'}.`);
    } else setStatus('Walk around the sculpture. Trigger to turn; thumbstick up or down to resize.');
    renderer.setAnimationLoop((time, frame) => {
      if (ended) return;
      const elapsed = lastFrame === undefined ? 0 : Math.min(0.1, Math.max(0, (time - lastFrame) / 1000));
      lastFrame = time;
      if (mode === 'immersive-vr') {
        for (const source of session.inputSources || []) {
          const axes = source.gamepad?.axes || [];
          const axis = axes.length >= 4 ? axes[3] : axes[1];
          if (Math.abs(axis || 0) < 0.2) continue;
          setScale(displayScale * Math.exp(-axis * elapsed));
          break;
        }
      }
      if (mode === 'immersive-ar' && !placed && frame && hitSource) {
        reticle.visible = false;
        for (const hit of frame.getHitTestResults(hitSource)) {
          const pose = hit.getPose(renderer.xr.getReferenceSpace());
          // Keep sculptures upright: use horizontal surfaces, not nearby walls.
          if (!pose || pose.transform.matrix[5] < 0.85) continue;
          reticle.matrix.fromArray(pose.transform.matrix);
          reticle.visible = true;
          break;
        }
        if (hasSurface !== reticle.visible) {
          hasSurface = reticle.visible;
          setStatus(hasSurface ? `Surface found. Tap to place ${layout.visible ? 'the stand and sculpture on the floor' : 'the sculpture'}.` : `Move your phone to find a ${placementSurface}.`);
        }
      }
      renderer.render(scene, camera);
    });
    return {
      end: () => session.end(),
      setScale,
      setSupportHeight,
      rotate: (radians) => { anchor.rotation.y += radians; },
      reposition: () => {
        if (mode !== 'immersive-ar') return;
        placed = false; hasSurface = false; anchor.visible = false;
        setStatus(`Find a ${placementSurface}, then tap to place ${layout.visible ? 'the stand and sculpture' : 'the sculpture'} again.`);
      },
    };
  } catch (error) {
    if (!ended) await session.end().catch(() => {});
    cleanup();
    throw error;
  }
}

// Flatten the displayed pose into static meshes for Quick Look. This preserves
// the placement of skinned scans and splits material groups the USDZ exporter
// otherwise omits. Originals, textures, and the live viewer are never modified.
export function makeQuickLookScene(THREE, model, box, reference, supportOptions = {}) {
  const result = new THREE.Group();
  const scale = referenceScaleFor(box, reference);
  result.scale.setScalar(scale);
  result.position.y = -box.min.y * scale;
  const layout = supportLayoutFor(box, reference, { ...supportOptions, sessionMode: 'quick-look' });
  const support = createDisplaySupport(THREE, layout);
  const assembly = new THREE.Group();
  assembly.name = 'Atrium display';
  result.name = 'Artwork';
  result.position.y += layout.visible ? layout.height : 0;
  assembly.add(result);
  if (layout.visible) assembly.add(support.object);
  const geometries = new Set();
  const dispose = () => {
    for (const geometry of geometries) geometry.dispose();
    support.dispose();
  };
  try {
    model.updateWorldMatrix(true, true);
    model.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.visible) return;
      let parent = mesh.parent;
      while (parent && parent !== model.parent) {
        if (!parent.visible) return;
        parent = parent.parent;
      }
      const geometry = mesh.geometry.clone();
      geometries.add(geometry);
      if (mesh.isSkinnedMesh || mesh.morphTargetInfluences?.some(Boolean)) {
        mesh.skeleton?.update();
        const position = geometry.getAttribute('position');
        const point = new THREE.Vector3();
        for (let i = 0; i < position.count; i++) {
          mesh.getVertexPosition(i, point);
          position.setXYZ(i, point.x, point.y, point.z);
        }
        geometry.deleteAttribute('skinIndex'); geometry.deleteAttribute('skinWeight');
        geometry.morphAttributes = {};
        geometry.computeVertexNormals();
      }
      geometry.applyMatrix4(mesh.matrixWorld);
      // Baking a mirrored transform removes Three's automatic front-face flip.
      if (mesh.matrixWorld.determinant() < 0) {
        if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
        const index = geometry.index;
        for (let i = 0; i < index.count; i += 3) {
          const second = index.getX(i + 1);
          index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, second);
        }
      }
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const groups = Array.isArray(mesh.material) ? geometry.groups : [{ start: 0, count: geometry.index?.count ?? geometry.attributes.position.count, materialIndex: 0 }];
      for (const group of groups) {
        const material = materials[group.materialIndex ?? 0];
        if (!material?.visible) continue;
        if (!material.isMeshStandardMaterial) throw new Error('This surface cannot be exported to AR.');
        let surface = geometry;
        if (Array.isArray(mesh.material)) {
          surface = geometry.clone();
          const indexes = geometry.index ? Array.from(geometry.index.array).slice(group.start, group.start + group.count) : Array.from({ length: group.count }, (_, i) => group.start + i);
          surface.setIndex(indexes); surface.clearGroups();
          geometries.add(surface);
        }
        const item = new THREE.Mesh(surface, material);
        item.name = mesh.name;
        result.add(item);
      }
    });
    assembly.updateMatrixWorld(true);
    // USDZExporter serializes the root's children, not the root transform itself.
    // An identity wrapper preserves physical scale even without furniture.
    return { scene: assembly, hasSupport: layout.visible, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
