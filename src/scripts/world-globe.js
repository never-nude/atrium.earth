import * as THREE from 'three';

const RAD = Math.PI / 180;
const OPENING = { x: 0.16, y: -0.32 };
const MARKER_SIZE = 32;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const safeColor = value => /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(value || '') ? value : '#39e4ff';

// Longitude zero faces +Z, east is +X, north is +Y. GeoJSON is [lon, lat].
export function worldPosition(lat, lon, radius = 1) {
  return new THREE.Vector3(
    radius * Math.cos(lat * RAD) * Math.sin(lon * RAD),
    radius * Math.sin(lat * RAD),
    radius * Math.cos(lat * RAD) * Math.cos(lon * RAD),
  );
}

function landRings(data) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid land geometry.');
  const polygons = [];
  let points = 0;
  for (const feature of data.features) {
    const geometry = feature.geometry;
    const collection = geometry?.type === 'Polygon' ? [geometry.coordinates]
      : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
    for (const polygon of collection) {
      if (!Array.isArray(polygon)) throw new Error('Invalid land polygon.');
      for (const ring of polygon) for (const coordinate of ring) {
        if (!Array.isArray(coordinate) || !Number.isFinite(coordinate[0]) || !Number.isFinite(coordinate[1])
          || Math.abs(coordinate[0]) > 180 || Math.abs(coordinate[1]) > 90 || ++points > 50_000) throw new Error('Invalid land coordinates.');
      }
      polygons.push(polygon);
    }
  }
  if (!points) throw new Error('Land geometry is empty.');
  return polygons;
}

function paintLand(ctx, polygons, box, glow = true, vivid = false) {
  ctx.save();
  ctx.translate(box.x, box.y);
  ctx.lineWidth = 0.8;
  ctx.fillStyle = '#123a51';
  if (vivid && ctx.createLinearGradient) {
    const gradient = ctx.createLinearGradient(0, 0, box.width, box.height);
    gradient.addColorStop(0, '#248b9d'); gradient.addColorStop(0.4, '#155a83');
    gradient.addColorStop(0.7, '#176f78'); gradient.addColorStop(1, '#34396c');
    ctx.fillStyle = gradient;
  }
  ctx.strokeStyle = '#43e7ed';
  ctx.shadowColor = '#13bfe8';
  ctx.shadowBlur = glow ? 5 : 0;
  for (const polygon of polygons) {
    ctx.beginPath();
    for (const ring of polygon) {
      ring.forEach(([lon, lat], index) => {
        const x = (lon + 180) / 360 * box.width;
        const y = (90 - lat) / 180 * box.height;
        if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.closePath();
    }
    ctx.fill('evenodd');
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Demand-rendered world view. Counts/selections remain owned by the page.
 * onError(error, { mode, webgl, landLoaded }) reports the actual fallback mode.
 * Persisted pagehide pauses this instance; pageshow resumes it. Callers should
 * not destroy a bfcache-preserved instance unless they recreate it on pageshow.
 */
export function createWorldGlobe({ host, places = [], onSelect, onReady, onError, landUrl, presentation = 'explorer', autoRotate = false, onZoomChange, onAutoRotateChange } = {}) {
  if (!(host instanceof HTMLElement)) throw new TypeError('World globe requires a host element.');
  const events = new AbortController();
  const signal = events.signal;
  const invitation = presentation === 'invitation';
  const original = { position: host.style.position, minHeight: host.style.minHeight };
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  if (!host.clientHeight) host.style.minHeight = '360px';
  const mount = document.createElement('div');
  mount.dataset.worldView = '';
  mount.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:radial-gradient(ellipse at 50% 48%,#0b2042 0%,#050b1a 58%,#030712 100%);isolation:isolate';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;outline-offset:-4px;position:absolute;inset:0';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', invitation
    ? 'Interactive Earth. Drag or use arrow keys to turn, plus and minus to zoom, and Home to reset.'
    : 'Rotatable world map. Use arrow keys to turn, plus and minus to zoom, and Home to reset. Select a visible place marker or use the place selector.');
  const flat = document.createElement('canvas');
  flat.style.cssText = 'display:none;width:100%;height:100%;position:absolute;inset:0';
  flat.setAttribute('aria-hidden', 'true');
  const markers = document.createElement('div');
  markers.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  markers.setAttribute('role', 'group');
  markers.setAttribute('aria-label', 'Places visible on the map');
  if (invitation) markers.setAttribute('aria-hidden', 'true');
  const fallback = document.createElement('p');
  fallback.style.cssText = 'position:absolute;left:24px;right:24px;bottom:18px;margin:0;color:#bed5ec;font:12px/1.6 system-ui;pointer-events:none';
  fallback.setAttribute('role', 'status');
  mount.append(canvas, flat, markers, fallback);
  host.append(mount);

  const unique = new Map();
  for (const place of places) {
    if (!place || typeof place.id !== 'string' || unique.has(place.id)
      || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)
      || Math.abs(place.lat) > 90 || Math.abs(place.lon) > 180
      || !['country', 'region'].includes(place.precision)) continue;
    unique.set(place.id, { ...place, color: safeColor(place.color), vector: worldPosition(place.lat, place.lon, 1.025) });
  }
  const entries = [...unique.values()];
  let counts = Object.create(null);
  let selectedId = null;
  let mode = 'globe';
  let destroyed = false;
  let pageSuspended = false;
  let visible = true;
  let raf = 0;
  let width = 0, height = 0, pixelRatio = 1;
  let polygons = [];
  let landLoaded = false;
  let landFailed = false;
  let flatFailed = false;
  let renderer, scene, camera, earth, texture;
  let tween;
  let drag;
  let pinch;
  let zoom = 1;
  let autoRotateRequested = Boolean(autoRotate);
  let previousFrameTime;
  let originPoints;
  const rotation = { ...OPENING };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const owned = new Set();
  const positions = new Map();
  const reportError = error => {
    queueMicrotask(() => {
      if (destroyed) return;
      const state = { mode, webgl: Boolean(renderer), landLoaded };
      try { onError?.(Object.assign(error, state), state); } catch {}
    });
  };
  const countFor = id => Number.isFinite(counts[id]) ? Math.max(0, Math.floor(counts[id])) : 0;
  const isAutoRotating = () => autoRotateRequested && !reducedMotion.matches && mode === 'globe' && Boolean(renderer);
  function notifyMotion() { queueMicrotask(() => { if (!destroyed) { try { onAutoRotateChange?.(isAutoRotating()); } catch {} } }); }
  function updateCamera() {
    if (!camera || !width || !height) return;
    camera.aspect = width / height;
    const fit = invitation ? 1.2 : 1.4;
    const distance = fit / (Math.tan(camera.fov * RAD / 2) * Math.min(camera.aspect, 1)) * zoom;
    camera.position.set(0, 0, Math.max(1.35, distance));
    camera.far = Math.max(20, distance + 4); camera.updateProjectionMatrix();
  }
  function setZoom(value) {
    zoom = clamp(value, 0.65, 1.35); updateCamera(); schedule();
    queueMicrotask(() => { if (!destroyed) { try { onZoomChange?.({ canZoomIn: zoom > 0.6501, canZoomOut: zoom < 1.3499, zoom }); } catch {} } });
  }
  function setAutoRotate(value) { autoRotateRequested = Boolean(value); previousFrameTime = undefined; notifyMotion(); schedule(); return isAutoRotating(); }
  function syncMode() {
    canvas.style.display = mode === 'globe' && renderer ? 'block' : 'none';
    canvas.tabIndex = mode === 'globe' && renderer ? 0 : -1;
    flat.style.display = mode === 'map' ? 'block' : 'none';
    markers.style.display = invitation ? 'none' : 'block';
  }
  function useFlatFallback(error) {
    if (destroyed) return;
    mode = 'map';
    const failed = renderer; renderer = null; failed?.dispose();
    finishMotion(); syncMode(); notifyMotion();
    fallback.textContent = landFailed ? 'The map is unavailable. Use the place selector to explore.'
      : '3D is unavailable. The flat map and place selector remain available.';
    reportError(error); schedule();
  }

  for (const place of entries) {
    if (invitation) break;
    const button = document.createElement('button');
    button.type = 'button';
    button.hidden = true;
    button.dataset.worldPlace = place.id;
    button.style.cssText = `position:absolute;left:0;top:0;width:${MARKER_SIZE}px;height:${MARKER_SIZE}px;min-width:${MARKER_SIZE}px;min-height:${MARKER_SIZE}px;box-sizing:border-box;touch-action:manipulation;padding:0;border:1px solid ${place.color};border-radius:50%;background:#081326e8;color:${place.color};box-shadow:0 0 15px ${place.color}70;font:600 10px/1 system-ui;cursor:pointer;pointer-events:auto;transform:translate(-50%,-50%);z-index:2;outline-offset:4px`;
    const label = document.createElement('span');
    label.style.cssText = 'position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);padding:5px 8px;max-width:180px;width:max-content;border:1px solid #50728d80;border-radius:3px;background:#050b1af2;color:#e9f7ff;font:11px/1.4 system-ui;text-align:center;opacity:0;pointer-events:none';
    label.textContent = `${place.label || place.id} `;
    label.setAttribute('aria-hidden', 'true');
    const number = document.createElement('span');
    number.setAttribute('aria-hidden', 'true');
    button.append(label, number);
    const showLabel = () => { label.style.opacity = '1'; button.style.zIndex = '5'; };
    const hideLabel = () => { label.style.opacity = selectedId === place.id ? '1' : '0'; button.style.zIndex = selectedId === place.id ? '4' : '2'; };
    button.addEventListener('pointerenter', showLabel, { signal });
    button.addEventListener('pointerleave', hideLabel, { signal });
    button.addEventListener('focus', showLabel, { signal });
    button.addEventListener('blur', hideLabel, { signal });
    button.addEventListener('click', () => { if (countFor(place.id)) onSelect?.(place.id); }, { signal });
    markers.append(button);
    place.button = button; place.number = number; place.labelNode = label;
  }

  function own(resource) { owned.add(resource); return resource; }
  function makeLine(segments, color, opacity, parent = earth) {
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
    const material = own(new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    const line = new THREE.LineSegments(geometry, material);
    parent.add(line);
    return line;
  }
  function initializeWebGL() {
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setClearColor(0x030712, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20);
      earth = new THREE.Group(); scene.add(earth);
      const surface = own(new THREE.MeshPhongMaterial(invitation
        ? { color: 0xc9e8ff, emissive: 0x06223b, emissiveIntensity: 0.45, specular: 0x225c79, shininess: 24 }
        : { color: 0x0a1a34, emissive: 0x031027, shininess: 14 }));
      earth.add(new THREE.Mesh(own(new THREE.SphereGeometry(1, 64, 40)), surface));
      scene.add(new THREE.AmbientLight(0x689de0, invitation ? 0.8 : 1.7));
      const key = new THREE.DirectionalLight(0x9deeff, invitation ? 1.7 : 2.2); key.position.set(-3, 3, 4); scene.add(key);
      const fill = new THREE.DirectionalLight(0xca54ff, 0.65); fill.position.set(3, -1, -2); scene.add(fill);
      const grid = [];
      for (const lat of [-60, -30, 0, 30, 60]) for (let lon = -180; lon < 180; lon += 4) {
        grid.push(...worldPosition(lat, lon, 1.003).toArray(), ...worldPosition(lat, lon + 4, 1.003).toArray());
      }
      for (let lon = -180; lon < 180; lon += 30) for (let lat = -88; lat < 88; lat += 4) {
        grid.push(...worldPosition(lat, lon, 1.003).toArray(), ...worldPosition(lat + 4, lon, 1.003).toArray());
      }
      if (!invitation) makeLine(grid, 0x3481bd, 0.22);
      const atmosphereMaterial = own(new THREE.ShaderMaterial({
        transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
        fragmentShader: 'varying vec3 n; varying vec3 v; void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(.08,.65,1.,rim*.34);}',
      }));
      scene.add(new THREE.Mesh(own(new THREE.SphereGeometry(1.075, 48, 32)), atmosphereMaterial));
      for (const [radius, color, tilt] of invitation ? [] : [[1.2, 0x447cff, 1.18], [1.26, 0xbe55ff, -0.72]]) {
        const ring = new THREE.LineLoop(own(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, i) => new THREE.Vector3(Math.cos(i / 128 * Math.PI * 2) * radius, Math.sin(i / 128 * Math.PI * 2) * radius, 0)))), own(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false })));
        ring.rotation.x = tilt; ring.rotation.z = 0.24; scene.add(ring);
      }
      canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); useFlatFallback(new Error('World WebGL context was lost.')); }, { signal });
    } catch (error) {
      useFlatFallback(error);
    }
  }

  function addLand() {
    if (!earth) return;
    const atlas = document.createElement('canvas'); atlas.width = 1024; atlas.height = 512;
    let ctx;
    try { ctx = atlas.getContext('2d'); } catch {}
    if (ctx) {
      ctx.fillStyle = '#07152b'; ctx.fillRect(0, 0, 1024, 512);
      paintLand(ctx, polygons, { x: 0, y: 0, width: 1024, height: 512 }, true, invitation);
      texture = own(new THREE.CanvasTexture(atlas)); texture.colorSpace = THREE.SRGBColorSpace;
      // This matches SphereGeometry's seam with the documented +Z/Greenwich convention.
      texture.offset.x = 0.25; texture.wrapS = THREE.RepeatWrapping;
      const sphere = earth.children.find(child => child.isMesh);
      sphere.material.map = texture; sphere.material.needsUpdate = true;
    }
    const coast = [];
    for (const polygon of polygons) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
      const a = worldPosition(ring[i - 1][1], ring[i - 1][0], 1.006);
      const b = worldPosition(ring[i][1], ring[i][0], 1.006);
      coast.push(...a.toArray(), ...b.toArray());
    }
    makeLine(coast, 0x61f8e4, 0.88);
    const pointsGeometry = own(new THREE.BufferGeometry());
    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(coast.filter((_, index) => Math.floor(index / 3) % 4 === 0), 3));
    earth.add(new THREE.Points(pointsGeometry, own(new THREE.PointsMaterial({ color: 0x8efbff, size: 0.009, transparent: true, opacity: 0.65, depthWrite: false }))));
    syncOriginPoints();
  }

  function syncOriginPoints() {
    if (!invitation || !earth || !renderer) return;
    if (!originPoints) {
      const geometry = own(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(entries.length * 3), 3));
      geometry.setAttribute('originColor', new THREE.BufferAttribute(new Float32Array(entries.length * 3), 3));
      const material = own(new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { pointScale: { value: 24 * pixelRatio } },
        vertexShader: 'attribute vec3 originColor;varying vec3 c;uniform float pointScale;void main(){c=originColor;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(pointScale/-p.z,3.,12.);gl_Position=projectionMatrix*p;}',
        fragmentShader: 'varying vec3 c;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,.04,d);gl_FragColor=vec4(c,a*.9);}',
      }));
      originPoints = new THREE.Points(geometry, material); originPoints.frustumCulled = false; earth.add(originPoints);
    }
    let index = 0;
    const positions = originPoints.geometry.getAttribute('position');
    const colors = originPoints.geometry.getAttribute('originColor');
    for (const place of entries) {
      if (!countFor(place.id)) continue;
      positions.setXYZ(index, place.vector.x, place.vector.y, place.vector.z);
      const color = new THREE.Color(place.color); colors.setXYZ(index, color.r, color.g, color.b); index += 1;
    }
    positions.needsUpdate = true; colors.needsUpdate = true;
    originPoints.geometry.setDrawRange(0, index);
  }

  function mapBox() {
    const mapWidth = Math.min(width * 0.92, height * 1.66) / zoom;
    const focus = selectedId ? unique.get(selectedId) : null;
    const center = zoom < 1 && focus ? { lon: focus.lon, lat: focus.lat } : { lon: 0, lat: 0 };
    return { x: width / 2 - (center.lon + 180) / 360 * mapWidth, y: height / 2 - (90 - center.lat) / 180 * mapWidth / 2, width: mapWidth, height: mapWidth / 2 };
  }
  function drawFlat() {
    let ctx;
    try { ctx = flat.getContext('2d'); } catch {}
    if (!ctx) {
      fallback.textContent = 'The map is unavailable. Use the place selector to explore.';
      if (!flatFailed) { flatFailed = true; reportError(new Error('The flat map canvas is unavailable.')); }
      return;
    }
    flatFailed = false;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const box = mapBox();
    ctx.fillStyle = '#061329'; ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.strokeStyle = '#29517466'; ctx.lineWidth = 0.6;
    for (let lon = -180; lon <= 180; lon += 30) { const x = box.x + (lon + 180) / 360 * box.width; ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.height); ctx.stroke(); }
    for (let lat = -90; lat <= 90; lat += 30) { const y = box.y + (90 - lat) / 180 * box.height; ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.width, y); ctx.stroke(); }
    paintLand(ctx, polygons, box, true, invitation);
    if (invitation) for (const place of entries) {
      if (!countFor(place.id)) continue;
      const x = box.x + (place.lon + 180) / 360 * box.width;
      const y = box.y + (90 - place.lat) / 180 * box.height;
      ctx.fillStyle = place.color; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  function projectMarkers() {
    positions.clear();
    if (invitation) return;
    if (!landLoaded || landFailed || (mode === 'map' && flatFailed)) { entries.forEach(place => { place.button.hidden = true; }); return; }
    const occupied = [];
    const focusedId = document.activeElement?.dataset?.worldPlace;
    const ordered = [...entries].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId) || Number(b.id === focusedId) - Number(a.id === focusedId) || countFor(b.id) - countFor(a.id));
    for (const place of ordered) {
      const count = countFor(place.id);
      let x = 0, y = 0, shown = count > 0;
      if (mode === 'map') {
        const box = mapBox(); x = box.x + (place.lon + 180) / 360 * box.width; y = box.y + (90 - place.lat) / 180 * box.height;
      } else if (camera && earth) {
        const world = place.vector.clone().applyMatrix4(earth.matrixWorld);
        const front = world.clone().normalize().dot(camera.position.clone().sub(world).normalize());
        const projected = world.project(camera);
        shown = shown && front > 0.12 && projected.z > -1 && projected.z < 1;
        x = (projected.x + 1) * width / 2; y = (1 - projected.y) * height / 2;
      } else shown = false;
      const inset = MARKER_SIZE / 2 + 4;
      shown = shown && x >= inset && x <= width - inset && y >= inset && y <= height - inset;
      if (shown && place.id !== selectedId && place.id !== focusedId && occupied.some(point => Math.hypot(point.x - x, point.y - y) < MARKER_SIZE + 4)) shown = false;
      place.button.hidden = !shown;
      if (!shown) continue;
      occupied.push({ x, y }); positions.set(place.id, { x, y });
      place.button.style.left = `${x}px`; place.button.style.top = `${y}px`;
      place.labelNode.style.left = x < 100 ? '0' : x > width - 100 ? '100%' : '50%';
      place.labelNode.style.transform = x < 100 ? 'none' : x > width - 100 ? 'translateX(-100%)' : 'translateX(-50%)';
      place.labelNode.style.bottom = y < 70 ? 'auto' : 'calc(100% + 8px)';
      place.labelNode.style.top = y < 70 ? 'calc(100% + 8px)' : 'auto';
    }
  }
  function render(now) {
    raf = 0;
    if (destroyed || pageSuspended || !visible || document.hidden || !width || !height) return;
    const elapsed = previousFrameTime === undefined ? 0 : Math.max(0, (now - previousFrameTime) / 1000);
    if (isAutoRotating() && !tween && previousFrameTime !== undefined && elapsed < 1 / 30) { schedule(); return; }
    previousFrameTime = now;
    if (tween) {
      const p = clamp((now - tween.start) / tween.duration, 0, 1);
      const eased = p * p * (3 - 2 * p);
      rotation.x = tween.from.x + (tween.to.x - tween.from.x) * eased;
      rotation.y = tween.from.y + (tween.to.y - tween.from.y) * eased;
      if (p === 1) tween = null;
    } else if (isAutoRotating() && !drag && !pinch) rotation.y += Math.min(elapsed, 0.08) * 0.045;
    syncMode();
    if (mode === 'globe' && renderer) {
      earth.rotation.set(rotation.x, rotation.y, 0, 'XYZ');
      scene.updateMatrixWorld(); camera.updateMatrixWorld();
      try { renderer.render(scene, camera); }
      catch (error) { useFlatFallback(error); drawFlat(); }
    } else drawFlat();
    projectMarkers();
    if (tween || isAutoRotating()) schedule();
  }
  function schedule() { if (!destroyed && !pageSuspended && visible && !document.hidden && !raf) raf = requestAnimationFrame(render); }
  function finishMotion() { previousFrameTime = undefined; if (tween) { Object.assign(rotation, tween.to); tween = null; } }
  function orient(target, duration = 620) {
    const shortest = ((target.y - rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    const to = { x: clamp(target.x, -1.48, 1.48), y: rotation.y + shortest };
    if (reducedMotion.matches || mode === 'map') { Object.assign(rotation, to); tween = null; }
    else tween = { from: { ...rotation }, to, start: performance.now(), duration };
    schedule();
  }
  function resize() {
    if (destroyed) return;
    width = Math.round(host.clientWidth); height = Math.round(host.clientHeight);
    if (!width || !height) return;
    pixelRatio = Math.min(devicePixelRatio || 1, 1.5);
    flat.width = Math.round(width * pixelRatio); flat.height = Math.round(height * pixelRatio);
    if (renderer) {
      renderer.setPixelRatio(pixelRatio); renderer.setSize(width, height, false);
      updateCamera();
      if (originPoints) originPoints.material.uniforms.pointScale.value = 24 * pixelRatio;
    }
    schedule();
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || mode !== 'globe') return;
    tween = null;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, rotation: { ...rotation }, touch: event.pointerType === 'touch' };
    canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing';
  }, { signal });
  canvas.addEventListener('pointermove', event => {
    if (!drag || pinch || drag.id !== event.pointerId) return;
    if (autoRotateRequested && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) setAutoRotate(false);
    rotation.y = drag.rotation.y + (event.clientX - drag.x) * 0.006;
    if (!drag.touch) rotation.x = clamp(drag.rotation.x + (event.clientY - drag.y) * 0.004, -1.48, 1.48);
    schedule();
  }, { signal });
  const endDrag = () => { drag = null; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', endDrag, { signal });
  canvas.addEventListener('pointercancel', endDrag, { signal });
  canvas.addEventListener('lostpointercapture', endDrag, { signal });
  const touchDistance = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  canvas.addEventListener('touchstart', event => {
    if (mode !== 'globe' || event.touches.length !== 2) return;
    if (event.cancelable) event.preventDefault();
    pinch = { distance: Math.max(1, touchDistance(event.touches)), zoom };
    drag = null; tween = null; setAutoRotate(false);
  }, { signal, passive: false });
  canvas.addEventListener('touchmove', event => {
    if (!pinch || event.touches.length !== 2) return;
    if (event.cancelable) event.preventDefault();
    setZoom(pinch.zoom * pinch.distance / Math.max(1, touchDistance(event.touches)));
  }, { signal, passive: false });
  const endPinch = event => { if (event.touches.length < 2) pinch = null; };
  canvas.addEventListener('touchend', endPinch, { signal });
  canvas.addEventListener('touchcancel', endPinch, { signal });
  canvas.style.cursor = 'grab';
  canvas.addEventListener('keydown', event => {
    if (mode !== 'globe') return;
    const delta = { ArrowLeft: [-0.14, 0], ArrowRight: [0.14, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[event.key];
    if (event.key === 'Home') { event.preventDefault(); setZoom(1); orient(OPENING); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(zoom * 0.85); }
    else if (event.key === '-' || event.key === '_') { event.preventDefault(); setZoom(zoom / 0.85); }
    else if (delta) { event.preventDefault(); setAutoRotate(false); tween = null; rotation.y += delta[0]; rotation.x = clamp(rotation.x + delta[1], -1.48, 1.48); schedule(); }
  }, { signal });
  // No wheel listener: the globe never consumes page scrolling.
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; finishMotion(); } else schedule(); }, { signal });
  window.addEventListener('pagehide', event => {
    pageSuspended = true; cancelAnimationFrame(raf); raf = 0; finishMotion(); endDrag(); pinch = null;
    if (!event.persisted) api.destroy();
  }, { signal });
  window.addEventListener('pageshow', () => { pageSuspended = false; resize(); schedule(); }, { signal });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) finishMotion(); notifyMotion(); schedule(); }, { signal });
  const observer = 'ResizeObserver' in window ? new ResizeObserver(resize) : null;
  observer?.observe(host);
  window.addEventListener('resize', resize, { signal, passive: true });
  const visibilityObserver = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) schedule(); else { cancelAnimationFrame(raf); raf = 0; finishMotion(); }
  }) : null;
  visibilityObserver?.observe(host);
  initializeWebGL(); resize(); setZoom(1); notifyMotion();

  const api = {
    update(next = {}) {
      if (destroyed) return;
      if (next.counts && typeof next.counts === 'object') counts = Object.fromEntries(entries.map(place => [place.id, next.counts[place.id]]));
      const before = selectedId;
      if (Object.hasOwn(next, 'selectedId')) selectedId = unique.has(next.selectedId) ? next.selectedId : null;
      if (invitation) syncOriginPoints();
      for (const place of invitation ? [] : entries) {
        const count = countFor(place.id), selected = place.id === selectedId;
        if (!count) place.button.hidden = true;
        const markerCount = count > 99 ? '99+' : String(count);
        const total = count > 99 ? ` (${count} in total)` : '';
        place.number.textContent = markerCount;
        place.button.setAttribute('aria-label', `${place.label}: ${markerCount} ${count === 1 ? 'work' : 'works'}${total}. ${place.precision === 'country' ? 'Country' : 'Regional'} location, not an exact artwork site.`);
        place.button.setAttribute('aria-pressed', String(selected));
        place.button.style.background = selected ? place.color : '#081326e8';
        place.button.style.color = selected ? '#04111c' : place.color;
        place.button.style.boxShadow = selected ? `0 0 0 4px ${place.color}33,0 0 24px ${place.color}99` : `0 0 15px ${place.color}70`;
        place.labelNode.style.opacity = selected ? '1' : '0'; place.button.style.zIndex = selected ? '4' : '2';
      }
      if (selectedId && selectedId !== before && countFor(selectedId)) { const place = unique.get(selectedId); orient({ x: place.lat * RAD, y: -place.lon * RAD }); }
      schedule();
    },
    reset() { if (!destroyed) { setZoom(1); orient(OPENING); } },
    zoomIn() { if (!destroyed) setZoom(zoom * 0.85); },
    zoomOut() { if (!destroyed) setZoom(zoom / 0.85); },
    setAutoRotate(value) { return destroyed ? false : setAutoRotate(value); },
    isAutoRotating() { return !destroyed && isAutoRotating(); },
    pause() { return destroyed ? false : setAutoRotate(false); },
    play() { return destroyed ? false : setAutoRotate(true); },
    setMode(next) {
      if (destroyed || !['globe', 'map'].includes(next)) return false;
      mode = next === 'globe' && renderer ? 'globe' : 'map'; finishMotion();
      syncMode(); notifyMotion(); entries.forEach(place => { if (place.button) place.button.hidden = true; }); schedule();
      return mode === next;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; events.abort(); cancelAnimationFrame(raf); tween = null; drag = null; pinch = null;
      observer?.disconnect(); visibilityObserver?.disconnect();
      for (const resource of owned) resource.dispose(); owned.clear();
      renderer?.dispose(); renderer?.forceContextLoss(); renderer = null;
      mount.remove(); flat.width = 1; flat.height = 1;
      host.style.position = original.position; host.style.minHeight = original.minHeight;
    },
  };

  void (async () => {
    try {
      const url = new URL(landUrl || host.dataset.landUrl || `${import.meta.env.BASE_URL}world/land.geo.json`, location.href);
      if (url.origin !== location.origin) throw new Error('Land geometry must use the local bundled source.');
      const response = await fetch(url, { signal, credentials: 'same-origin' });
      if (!response.ok || Number(response.headers.get('content-length')) > 500_000) throw new Error('Land geometry is unavailable.');
      const text = await response.text();
      if (text.length > 500_000) throw new Error('Land geometry exceeds the preview budget.');
      const data = landRings(JSON.parse(text));
      if (destroyed) return;
      polygons = data; landLoaded = true; addLand(); schedule();
      try { onReady?.({ mode, webgl: Boolean(renderer), landLoaded, presentation, playing: isAutoRotating() }); } catch (error) { reportError(error); }
    } catch (error) {
      if (destroyed || signal.aborted) return;
      landFailed = true; fallback.textContent = 'The map is unavailable. Use the place selector to explore.';
      reportError(error); schedule();
    }
  })();
  return api;
}
