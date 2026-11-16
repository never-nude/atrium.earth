import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { applyModelTransform, frameCameraToBox, normalizeModel, parseModelTransform } from '/model-render-utils.js';

function removeHelpers(model) {
  const helpers = [];
  model.traverse(object => {
    const count = object.geometry?.index?.count ?? object.geometry?.getAttribute('position')?.count ?? 0;
    const helper = /^(?:cubo|disco)(?:_|\.|$)/i;
    if (helper.test(object.name) || helper.test(object.material?.name ?? '') ||
        (/^cube(?:_|\.|$)/i.test(object.name) && count <= 36)) helpers.push(object);
  });
  for (const helper of helpers) helper.removeFromParent();
  return helpers;
}

function capturePlacement(model, rawOrientation, camera) {
  const orientation = parseModelTransform(rawOrientation);
  if (orientation.upAxis === 'auto') {
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    orientation.upAxis = size.z > size.y * 1.15 && size.z > Math.min(size.x, size.y) * 1.15 ? 'z' : 'y';
  }
  applyModelTransform(THREE, model, orientation);
  const { box, center, size, scale } = normalizeModel(THREE, model);
  const wide = Math.max(size.x, size.z) > Math.max(size.y * 1.8, .65);
  const { target } = frameCameraToBox(THREE, camera, box, {
    padding: orientation.fit || (wide ? 1.38 : 1.18),
    direction: orientation.viewDirection || [.55, .34, .9],
  });
  return { orientation, center: center.toArray(), scale, position: camera.position.toArray(),
    target: target.toArray(), near: camera.near, far: camera.far };
}

function positionCamera(camera, placement, view) {
  const target = new THREE.Vector3().fromArray(placement.target);
  const offset = new THREE.Vector3().fromArray(placement.position).sub(target);
  const orbit = new THREE.Spherical().setFromVector3(offset);
  orbit.theta += THREE.MathUtils.degToRad(view.azimuth);
  orbit.phi -= THREE.MathUtils.degToRad(view.elevation);
  orbit.makeSafe();
  const zoomOut = view.crop ? 1 : 1.08;
  orbit.radius *= zoomOut;
  camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(orbit));
  camera.lookAt(target);
  camera.near = placement.near;
  camera.far = placement.far;
  if (view.crop) {
    const { x, y, size } = view.crop;
    camera.setViewOffset(1, 1, x, y, size, size);
  } else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

function disposeModel(models) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  for (const model of models) model.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [object.material].flat().filter(Boolean)) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  for (const texture of textures) {
    texture.dispose();
    texture.source?.data?.close?.();
  }
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

window.captureFirstView = async ({ url, orientation, placement, views, width, exposure }) => {
  const renderer = new THREE.WebGLRenderer({
    alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true,
  });
  renderer.setSize(width, width, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .01, 20);
  const failedResources = [];
  const manager = new THREE.LoadingManager();
  manager.onError = path => failedResources.push(path);
  const draco = new DRACOLoader(manager).setDecoderPath('/draco/').setWorkerLimit(2);
  const ktx = new KTX2Loader(manager).setTranscoderPath('/three/examples/jsm/libs/basis/').setWorkerLimit(2).detectSupport(renderer);
  const loader = new GLTFLoader(manager).setDRACOLoader(draco).setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
  let model;
  let helpers = [];
  let environment;
  try {
    ({ scene: model } = await loader.loadAsync(url));
    if (failedResources.length) throw new Error('Could not load all resources in the packaged model');
    helpers = removeHelpers(model);
    model.traverse(object => {
      if (object.isMesh && !object.geometry.getAttribute('normal')) object.geometry.computeVertexNormals();
    });
    if (placement) {
      applyModelTransform(THREE, model, placement.orientation);
      model.scale.multiplyScalar(placement.scale);
      model.position.sub(new THREE.Vector3().fromArray(placement.center));
    } else placement = capturePlacement(model, orientation, camera);
    scene.add(model);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    environment = pmrem.fromScene(room, .04);
    scene.environment = environment.texture;
    scene.environmentIntensity = .65;
    room.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x606060, .65));
    for (const [x, y, z, intensity] of [[3, 4, 4, 2], [-3, 2, -2, .45], [3, 1, -3, .35]]) {
      const light = new THREE.DirectionalLight(0xffffff, intensity);
      light.position.set(x, y, z);
      scene.add(light);
    }
    const viewsRendered = views.map(view => {
      positionCamera(camera, placement, view);
      renderer.render(scene, camera);
      if (renderer.getContext().isContextLost()) throw new Error('WebGL context lost');
      const triangles = renderer.info.render.triangles;
      if (!triangles) throw new Error('No triangles rendered');
      const png = renderer.domElement.toDataURL('image/png');
      return { id: view.id, triangles, png: png.slice('data:image/png;base64,'.length) };
    });
    return { placement, views: viewsRendered };
  } finally {
    if (model) disposeModel([model, ...helpers]);
    environment?.dispose();
    draco.dispose();
    ktx.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
};
