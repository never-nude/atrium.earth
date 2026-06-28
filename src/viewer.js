import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/vendor/draco/');
loader.setDRACOLoader(dracoLoader);

export async function attachViewer(container, options) {
  const {
    modelUrl,
    spin = true,
    interactive = true,
    spinSpeed = 0.003,
    cameraPadding = 3.0,
    verticalBias = 0,
  } = options;
  const width = container.clientWidth || 640;
  const height = container.clientHeight || 520;

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x151c23, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, width / height, 0.01, 10000);
  camera.position.set(0, 0.1, 4);

  scene.add(new THREE.HemisphereLight(0xfff2df, 0x233444, 1.9));

  const key = new THREE.DirectionalLight(0xffd2a8, 3.2);
  key.position.set(2.4, 4.2, 3.2);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9fc7ff, 1.8);
  rim.position.set(-3, 2, -2.5);
  scene.add(rim);

  let controls = null;
  if (interactive) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
  }

  let resizeRaf = 0;
  const resize = new ResizeObserver(() => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      const nextWidth = container.clientWidth;
      const nextHeight = container.clientHeight;
      if (!nextWidth || !nextHeight) return;
      renderer.setSize(nextWidth, nextHeight, false);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
    });
  });
  resize.observe(container);

  const gltf = await loader.loadAsync(modelUrl);
  const model = gltf.scene;
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = false;
    node.receiveShadow = false;
    if (node.material && !node.material.map) {
      node.material.color = new THREE.Color(0xe9ddc7);
      node.material.roughness = 0.72;
      node.material.metalness = 0.02;
    }
  });
  frameObject(model, camera, controls, { cameraPadding, verticalBias });
  scene.add(model);

  let raf = 0;
  let disposed = false;
  function render() {
    if (disposed) return;
    if (spin && !reducedMotion) model.rotation.y += spinSpeed;
    controls?.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(render);
  }
  render();

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      resize.disconnect();
      controls?.dispose();
      scene.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose());
          else node.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function frameObject(object, camera, controls, options) {
  const sourceBox = new THREE.Box3().setFromObject(object);
  const sourceSize = sourceBox.getSize(new THREE.Vector3());
  if (sourceSize.z > sourceSize.y * 1.35 && sourceSize.z > sourceSize.x * 1.35) {
    object.rotation.x = -Math.PI / 2;
    object.updateMatrixWorld(true);
  }

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
  if (size.y > size.x * 1.45) {
    object.position.y -= size.y * 0.24;
  }
  object.position.y += size.y * options.verticalBias;

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fov = camera.fov * (Math.PI / 180);
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const targetY = size.y > size.x * 1.45 ? size.y * 0.08 : 0;
  camera.position.set(0, targetY, distance * options.cameraPadding);
  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.lookAt(0, targetY, 0);
  camera.updateProjectionMatrix();

  if (controls) {
    controls.target.set(0, targetY, 0);
    controls.minDistance = distance * 0.55;
    controls.maxDistance = distance * 3;
    controls.update();
  }
}
