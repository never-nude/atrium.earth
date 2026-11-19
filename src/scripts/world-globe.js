import * as THREE from 'three';
import { shortestLongitudeDelta, globeTurnEase, pointOnGlobe } from '../lib/world-globe-motion.mjs';
import { QUALITY_TIERS, approach, createPacingWatch, easingStep, startingTier } from '../lib/world-globe-relief.mjs';
import { createGlobeLook } from './world-globe-look.js';

const RAD = Math.PI / 180;
const OPENING = { x: 0.16, y: -0.32 };
// The unattended turn, in radians a second, and how long the sculpted globe waits after a
// hand lets go before it turns again.
const AUTO_ROTATE_SPEED = 0.0459;
const AUTO_ROTATE_RESUME_MS = 3000;
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

function paintLand(ctx, polygons, box, glow = true, vivid = false, signature = false, density = 1) {
  ctx.save();
  ctx.translate(box.x, box.y);
  ctx.lineWidth = 0.8;
  ctx.fillStyle = signature ? '#40372a' : '#123a51';
  if (vivid && ctx.createLinearGradient) {
    const gradient = ctx.createLinearGradient(0, 0, box.width, box.height);
    gradient.addColorStop(0, '#248b9d'); gradient.addColorStop(0.4, '#155a83');
    gradient.addColorStop(0.7, '#176f78'); gradient.addColorStop(1, '#34396c');
    ctx.fillStyle = gradient;
  }
  ctx.strokeStyle = signature ? '#e9d17e85' : '#43e7ed';
  ctx.shadowColor = signature ? '#e9d17e' : '#13bfe8';
  ctx.shadowBlur = glow ? 5 : 0;
  if (signature) {
    // The flat map is the same cast relief laid out: bronze under the two o'clock light,
    // with each landmass throwing a soft shadow onto the sea below and to its left.
    if (ctx.createLinearGradient) {
      const gradient = ctx.createLinearGradient(box.width, 0, 0, box.height);
      gradient.addColorStop(0, '#5b4e37'); gradient.addColorStop(0.55, '#43392a'); gradient.addColorStop(1, '#2e2720');
      ctx.fillStyle = gradient;
    }
    ctx.shadowColor = '#03060cb3'; ctx.shadowBlur = 5 * density;
    ctx.shadowOffsetX = -1.5 * density; ctx.shadowOffsetY = 2.5 * density;
    for (const polygon of polygons) {
      ctx.beginPath();
      for (const ring of polygon) {
        ring.forEach(([lon, lat], index) => {
          const x = (lon + 180) / 360 * box.width, y = (90 - lat) / 180 * box.height;
          if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fill('evenodd');
    }
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = 'transparent';
  }
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
export function createWorldGlobe({ host, places = [], onSelect, onReady, onError, landUrl, presentation = 'explorer', autoRotate, onZoomChange, onAutoRotateChange } = {}) {
  if (!(host instanceof HTMLElement)) throw new TypeError('World globe requires a host element.');
  const events = new AbortController();
  const signal = events.signal;
  const invitation = presentation === 'invitation';
  const signature = presentation === 'signature';
  const createdAt = performance.now();
  const metrics = { createdAtMs: createdAt, firstFrameAtMs: null, firstFrameMs: null, lastTurnFps: null, lastTurnDurationMs: null };
  let readyNotified = false;
  let turnSample;
  let resumeTimer;
  let resumeAt = 0;
  let handActive = false;
  let hoverHeld = false;
  let keyboardHeld = false;
  let lastScrollAt = -Infinity;
  let touchGesture;
  let suppressClickUntil = 0;
  const original = { position: host.style.position, minHeight: host.style.minHeight };
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  if (!host.clientHeight) host.style.minHeight = '360px';
  const mount = document.createElement('div');
  mount.dataset.worldView = '';
  mount.style.cssText = 'position:absolute;inset:0;overflow:hidden;isolation:isolate;background:' + (signature ? 'transparent' : 'radial-gradient(ellipse at 50% 48%,#0b2042 0%,#050b1a 58%,#030712 100%)');
  if (signature) mount.dataset.worldSignatureView = '';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;outline-offset:-4px;position:absolute;inset:0';
  if (signature) canvas.style.touchAction = 'auto';
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
  if (signature) fallback.style.cssText = 'position:absolute;left:24px;right:24px;bottom:18px;margin:0;color:var(--v3-muted,#b3bbc7);font:12px/1.6 var(--v3-sans,system-ui);pointer-events:none';
  fallback.setAttribute('role', 'status');
  mount.append(canvas, flat, markers, fallback);
  host.append(mount);

  const unique = new Map();
  for (const place of places) {
    if (!place || typeof place.id !== 'string' || unique.has(place.id)
      || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)
      || Math.abs(place.lat) > 90 || Math.abs(place.lon) > 180
      || !['country', 'region'].includes(place.precision)) continue;
    // The sculpted globe draws each light on the surface at this vector and projects the same
    // vector for its hit target, so a pointer on a light is on that light's target. The legacy
    // views float their DOM markers a little above the sphere.
    unique.set(place.id, { ...place, color: signature ? '#e9d17e' : safeColor(place.color), vector: worldPosition(place.lat, place.lon, signature ? 1 : 1.025) });
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
  let zoomGoal = 1;
  let spin = null;
  let look = null;
  let tier = 0;
  const pacing = signature ? createPacingWatch() : null;
  let dotsHidden = null;
  let hoveredId = null;
  // True when the previous frame asked for this one, so the gap between them is the renderer's own pace.
  let chained = false;
  let flatPixelRatio = 1;
  let autoRotateRequested = Boolean(autoRotate ?? signature);
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
  const shouldRotate = () => isAutoRotating() && (!signature || (!handActive && !hoverHeld && !keyboardHeld && performance.now() >= resumeAt));
  function notifyMotion() { queueMicrotask(() => { if (!destroyed) { try { onAutoRotateChange?.(isAutoRotating()); } catch {} } }); }
  function updateCamera() {
    if (!camera || !width || !height) return;
    camera.aspect = width / height;
    const fit = invitation ? 1.2 : 1.4, tangent = Math.tan(camera.fov * RAD / 2);
    // The sculpted globe leaves a margin above and below for its floating tools. On a narrow
    // stage it also keeps a lane at each side: a touch on the globe turns it, so a thumb
    // needs somewhere beside it to scroll the page.
    const distance = (signature ? Math.max(1.26 / tangent, 1.24 / (tangent * camera.aspect))
      : fit / (tangent * Math.min(camera.aspect, 1))) * zoom;
    camera.position.set(0, 0, Math.max(1.35, distance));
    camera.far = Math.max(signature ? 40 : 20, distance + 4); camera.updateProjectionMatrix();
    look?.resize({ width, height, pixelRatio });
  }
  // Buttons, keys and the wheel ease toward their goal; fingers on the glass are followed exactly.
  function setZoom(value, immediate = !signature) {
    zoomGoal = clamp(value, 0.65, 1.35);
    if (immediate || reducedMotion.matches || !renderer) zoom = zoomGoal;
    updateCamera(); schedule();
    queueMicrotask(() => { if (!destroyed) { try { onZoomChange?.({ canZoomIn: zoomGoal > 0.6501, canZoomOut: zoomGoal < 1.3499, zoom: zoomGoal }); } catch {} } });
  }
  function setAutoRotate(value) { autoRotateRequested = Boolean(value); if (signature && value) resumeAt = 0; previousFrameTime = undefined; notifyMotion(); schedule(); return isAutoRotating(); }
  // On the sculpted globe the lights are drawn in WebGL; the buttons remain as
  // the touch targets, focus rings and labels. The flat map keeps its DOM points.
  const drawnLights = () => Boolean(look && renderer && mode === 'globe');
  function syncDots() {
    const hide = drawnLights();
    if (hide === dotsHidden) return;
    dotsHidden = hide;
    for (const place of entries) if (place.number) place.number.style.opacity = hide ? '0' : place.dotOpacity ?? '1';
  }
  function syncMode() {
    canvas.style.display = mode === 'globe' && renderer ? 'block' : 'none';
    canvas.tabIndex = mode === 'globe' && renderer ? 0 : -1;
    flat.style.display = mode === 'map' ? 'block' : 'none';
    markers.style.display = invitation ? 'none' : 'block';
    if (signature) syncDots();
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
    if (signature) {
      button.style.cssText = 'position:absolute;left:0;top:0;width:44px;height:44px;min-width:44px;min-height:44px;box-sizing:border-box;touch-action:auto;padding:0;border:0;border-radius:50%;background:transparent;color:#e9d17e;cursor:pointer;pointer-events:auto;transform:translate(-100px,-100px);z-index:2;outline-offset:-9px';
      button.dataset.worldLight = '';
    }
    const label = document.createElement('span');
    label.style.cssText = 'position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);padding:5px 8px;max-width:180px;width:max-content;border:1px solid #50728d80;border-radius:3px;background:#050b1af2;color:#e9f7ff;font:11px/1.4 system-ui;text-align:center;opacity:0;pointer-events:none';
    if (signature) label.style.cssText = 'position:absolute;left:50%;bottom:calc(50% + 15px);transform:translateX(-50%);padding:6px 11px;max-width:240px;width:max-content;border:1px solid #e9d17e47;border-radius:14px;background:#0c1524eb;color:#f5f2e9;font:500 12px/1.45 var(--v3-sans,system-ui);letter-spacing:.01em;text-align:center;opacity:0;pointer-events:none;box-shadow:0 6px 22px #05080f8c;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);transition:opacity 140ms ease-out';
    label.textContent = `${place.label || place.id} `;
    label.setAttribute('aria-hidden', 'true');
    const number = document.createElement('span');
    number.setAttribute('aria-hidden', 'true');
    if (signature) number.style.cssText = 'display:block;position:absolute;left:50%;top:50%;width:7px;height:7px;border-radius:50%;transform:translate(-50%,-50%);background:currentColor;box-shadow:0 0 8px currentColor,0 0 18px #e9d17e55;pointer-events:none;transition:width 180ms ease-out,height 180ms ease-out,opacity 180ms ease-out';
    button.append(label, number);
    const showLabel = () => { placeLabel(place); label.style.opacity = '1'; button.style.zIndex = '5'; };
    const hideLabel = () => { label.style.opacity = selectedId === place.id ? '1' : '0'; button.style.zIndex = selectedId === place.id ? '4' : '2'; };
    button.addEventListener('pointerenter', showLabel, { signal });
    button.addEventListener('pointerleave', hideLabel, { signal });
    // Keyboard focus lifts its light exactly as a pointer does.
    button.addEventListener('focus', () => { showLabel(); if (signature && hoveredId !== place.id) { hoveredId = place.id; if (look?.setHover(place.id)) schedule(); } }, { signal });
    button.addEventListener('blur', () => { hideLabel(); if (signature && hoveredId === place.id) { hoveredId = null; if (look?.setHover(null)) schedule(); } }, { signal });
    button.addEventListener('click', event => {
      const id = signature && event.detail ? nearestMarker(event.clientX, event.clientY) || place.id : place.id;
      if (countFor(id) && (!signature || !event.detail || performance.now() >= suppressClickUntil)) onSelect?.(id);
    }, { signal });
    markers.append(button);
    place.button = button; place.number = number; place.labelNode = label;
  }

  function own(resource) { owned.add(resource); return resource; }
  // Firefox reports the real renderer directly and warns about the debug extension; others need it.
  function rendererName(gl) {
    try {
      const reported = String(gl.getParameter(gl.RENDERER) || '');
      if (reported && !/^webkit webgl$|^webgl/i.test(reported)) return reported;
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) || '') : reported;
    } catch { return ''; }
  }
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
      renderer.setClearColor(signature ? 0x101b2c : 0x030712, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20);
      earth = new THREE.Group(); scene.add(earth);
      if (signature) {
        look = createGlobeLook({ scene, earth, camera, places: entries });
        tier = startingTier(rendererName(renderer.getContext()));
        if (tier) { look.setQuality(QUALITY_TIERS[tier]); host.dataset.worldQualityTier = String(tier); }
        canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); useFlatFallback(new Error('World WebGL context was lost.')); }, { signal });
        return;
      }
      const surface = own(new THREE.MeshPhongMaterial(invitation
        ? { color: 0xc9e8ff, emissive: 0x06223b, emissiveIntensity: 0.45, specular: 0x225c79, shininess: 24 }
        : signature ? { color: 0xb9b6a6, emissive: 0x101b2c, emissiveIntensity: .5, specular: 0x28283e, shininess: 8 }
        : { color: 0x0a1a34, emissive: 0x031027, shininess: 14 }));
      earth.add(new THREE.Mesh(own(new THREE.SphereGeometry(1, 64, 40)), surface));
      scene.add(new THREE.AmbientLight(signature ? 0xb9b3d1 : 0x689de0, invitation ? 0.8 : signature ? 1.25 : 1.7));
      const key = new THREE.DirectionalLight(signature ? 0xe9d17e : 0x9deeff, invitation ? 1.7 : signature ? 1.5 : 2.2); key.position.set(-3, 3, 4); scene.add(key);
      const fill = new THREE.DirectionalLight(signature ? 0xc9a5ff : 0xca54ff, signature ? .4 : .65); fill.position.set(3, -1, -2); scene.add(fill);
      const grid = [];
      for (const lat of [-60, -30, 0, 30, 60]) for (let lon = -180; lon < 180; lon += 4) {
        grid.push(...worldPosition(lat, lon, 1.003).toArray(), ...worldPosition(lat, lon + 4, 1.003).toArray());
      }
      for (let lon = -180; lon < 180; lon += 30) for (let lat = -88; lat < 88; lat += 4) {
        grid.push(...worldPosition(lat, lon, 1.003).toArray(), ...worldPosition(lat + 4, lon, 1.003).toArray());
      }
      if (!invitation) makeLine(grid, signature ? 0xc9a5ff : 0x3481bd, signature ? .1 : .22);
      const atmosphereMaterial = own(new THREE.ShaderMaterial({
        transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
        fragmentShader: signature
          ? 'varying vec3 n; varying vec3 v; void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(.79,.65,1.,rim*.16);}'
          : 'varying vec3 n; varying vec3 v; void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(.08,.65,1.,rim*.34);}',
      }));
      scene.add(new THREE.Mesh(own(new THREE.SphereGeometry(1.075, 48, 32)), atmosphereMaterial));
      for (const [radius, color, tilt] of invitation || signature ? [] : [[1.2, 0x447cff, 1.18], [1.26, 0xbe55ff, -0.72]]) {
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
    if (look) {
      const bakeMs = look.setLand(polygons, height * pixelRatio);
      if (bakeMs !== null) { metrics.reliefBakeMs = bakeMs; host.dataset.worldReliefBakeMs = bakeMs.toFixed(1); }
      look.setLights(countFor, selectedId); look.resize({ width, height, pixelRatio });
      return;
    }
    const atlas = document.createElement('canvas'); atlas.width = 1024; atlas.height = 512;
    let ctx;
    try { ctx = atlas.getContext('2d'); } catch {}
    if (ctx) {
      ctx.fillStyle = signature ? '#101b2c' : '#07152b'; ctx.fillRect(0, 0, 1024, 512);
      paintLand(ctx, polygons, { x: 0, y: 0, width: 1024, height: 512 }, !signature, invitation, signature);
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
    makeLine(coast, signature ? 0xe9d17e : 0x61f8e4, signature ? .38 : .88);
    const pointsGeometry = own(new THREE.BufferGeometry());
    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(coast.filter((_, index) => Math.floor(index / 3) % 4 === 0), 3));
    earth.add(new THREE.Points(pointsGeometry, own(new THREE.PointsMaterial({ color: signature ? 0xc9a5ff : 0x8efbff, size: signature ? .005 : 0.009, transparent: true, opacity: 0.65, depthWrite: false }))));
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
    ctx.setTransform(flatPixelRatio, 0, 0, flatPixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const box = mapBox();
    ctx.save();
    if (signature) {
      // A sheet of the same dark lacquer as the globe's sea, with the land clipped to it.
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(box.x, box.y, box.width, box.height, 10); else ctx.rect(box.x, box.y, box.width, box.height);
      ctx.fillStyle = '#0a111f'; ctx.fill(); ctx.clip();
    } else { ctx.fillStyle = '#061329'; ctx.fillRect(box.x, box.y, box.width, box.height); }
    ctx.strokeStyle = signature ? '#f5f2e90f' : '#29517466'; ctx.lineWidth = 0.6;
    for (let lon = -180; lon <= 180; lon += 30) { const x = box.x + (lon + 180) / 360 * box.width; ctx.beginPath(); ctx.moveTo(x, box.y); ctx.lineTo(x, box.y + box.height); ctx.stroke(); }
    for (let lat = -90; lat <= 90; lat += 30) { const y = box.y + (90 - lat) / 180 * box.height; ctx.beginPath(); ctx.moveTo(box.x, y); ctx.lineTo(box.x + box.width, y); ctx.stroke(); }
    paintLand(ctx, polygons, box, !signature, invitation, signature, flatPixelRatio);
    ctx.restore();
    if (invitation) for (const place of entries) {
      if (!countFor(place.id)) continue;
      const x = box.x + (place.lon + 180) / 360 * box.width;
      const y = box.y + (90 - place.lat) / 180 * box.height;
      ctx.fillStyle = place.color; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  const projected = new THREE.Vector3(), toCamera = new THREE.Vector3(), outward = new THREE.Vector3();
  function setShown(place, shown) { if (place.button.hidden === shown) place.button.hidden = !shown; }
  // Labels sit just above their light, flipping below or sideways at the stage edge.
  function placeLabel(place) {
    const point = positions.get(place.id);
    if (!point) return;
    const label = place.labelNode, gap = signature ? 'calc(50% + 15px)' : 'calc(100% + 8px)';
    label.style.left = point.x < 100 ? '0' : point.x > width - 100 ? '100%' : '50%';
    label.style.transform = point.x < 100 ? 'none' : point.x > width - 100 ? 'translateX(-100%)' : 'translateX(-50%)';
    label.style.bottom = point.y < 70 ? 'auto' : gap;
    label.style.top = point.y < 70 ? gap : 'auto';
  }
  function projectMarkers() {
    positions.clear();
    if (invitation) return;
    if (!landLoaded || landFailed || (mode === 'map' && flatFailed)) { entries.forEach(place => setShown(place, false)); return; }
    const occupied = [];
    const focusedId = document.activeElement?.dataset?.worldPlace;
    // Only the legacy numbered markers thin each other out, so only they need an order.
    const ordered = signature ? entries : [...entries].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId) || Number(b.id === focusedId) - Number(a.id === focusedId) || countFor(b.id) - countFor(a.id));
    const box = mode === 'map' ? mapBox() : null;
    const inset = signature ? 22 : MARKER_SIZE / 2 + 4;
    for (const place of ordered) {
      const count = countFor(place.id);
      let x = 0, y = 0, shown = count > 0 || (signature && place.id === selectedId);
      if (box) {
        x = box.x + (place.lon + 180) / 360 * box.width; y = box.y + (90 - place.lat) / 180 * box.height;
      } else if (camera && earth) {
        projected.copy(place.vector).applyMatrix4(earth.matrixWorld);
        const front = outward.copy(projected).normalize().dot(toCamera.copy(camera.position).sub(projected).normalize());
        projected.project(camera);
        shown = shown && front > 0.12 && projected.z > -1 && projected.z < 1;
        x = (projected.x + 1) * width / 2; y = (1 - projected.y) * height / 2;
      } else shown = false;
      shown = shown && x >= inset && x <= width - inset && y >= inset && y <= height - inset;
      if (!signature && shown && place.id !== selectedId && place.id !== focusedId && occupied.some(point => Math.hypot(point.x - x, point.y - y) < MARKER_SIZE + 4)) shown = false;
      setShown(place, shown);
      if (!shown) continue;
      const point = place.screen ||= { x: 0, y: 0 };
      point.x = x; point.y = y; positions.set(place.id, point);
      if (signature) {
        // A transform moves the 44 px target without asking the page to lay out again.
        if (Math.abs(x - place.drawnX) > 0.2 || Math.abs(y - place.drawnY) > 0.2 || place.drawnX === undefined) {
          place.button.style.transform = `translate(${(x - 22).toFixed(1)}px,${(y - 22).toFixed(1)}px)`;
          place.drawnX = x; place.drawnY = y;
        }
        if (place.id === selectedId || place.id === focusedId || place.id === hoveredId) placeLabel(place);
        continue;
      }
      occupied.push(point);
      place.button.style.left = `${x}px`; place.button.style.top = `${y}px`;
      placeLabel(place);
    }
  }
  function render(now) {
    raf = 0;
    if (destroyed || pageSuspended || !visible || document.hidden || !width || !height) return;
    const elapsed = previousFrameTime === undefined ? 0 : Math.max(0, (now - previousFrameTime) / 1000);
    if (!signature && isAutoRotating() && !tween && previousFrameTime !== undefined && elapsed < 1 / 30) { schedule(); return; }
    previousFrameTime = now;
    const paced = chained; chained = false;
    if (tween) {
      const p = clamp((now - tween.start) / tween.duration, 0, 1);
      const eased = signature ? globeTurnEase(p) : p * p * (3 - 2 * p);
      rotation.x = tween.from.x + (tween.to.x - tween.from.x) * eased;
      rotation.y = tween.from.y + (tween.to.y - tween.from.y) * eased;
      if (p === 1) tween = null;
    } else if (spin && !drag && !pinch && !handActive) {
      // A released globe keeps turning and settles, like something with weight.
      const step = easingStep(elapsed);
      rotation.y += spin.y * step;
      rotation.x = clamp(rotation.x + spin.x * step, -1.48, 1.48);
      const decay = Math.exp(-step * 3.4);
      spin.x *= decay; spin.y *= decay;
      if (Math.hypot(spin.x, spin.y) < 0.03) spin = null;
    } else if (shouldRotate() && !drag && !pinch) rotation.y += Math.min(elapsed, 0.08) * AUTO_ROTATE_SPEED;
    if (zoom !== zoomGoal) {
      // A wheel or a held key restarts the frame clock with every event. The zoom still
      // takes a step on each frame, or it would stand still until the input stopped.
      zoom = approach(zoom, zoomGoal, 13, easingStep(elapsed));
      updateCamera();
    }
    syncMode();
    let lookMoving = false;
    // Only frames the globe asked for itself say anything about the renderer. A frame drawn
    // because a pointer moved arrives at the pointer's pace, however fast the renderer is.
    if (look && mode === 'globe' && renderer && paced && tier < QUALITY_TIERS.length - 1) {
      const drop = pacing.sample(elapsed);
      if (drop) {
        tier = Math.min(QUALITY_TIERS.length - 1, tier + drop);
        look.setQuality(QUALITY_TIERS[tier]); host.dataset.worldQualityTier = String(tier);
        applySize(false);
      }
    }
    if (mode === 'globe' && renderer) {
      earth.rotation.set(rotation.x, rotation.y, 0, 'XYZ');
      lookMoving = Boolean(look?.frame(now, { still: reducedMotion.matches, turning: shouldRotate() || Boolean(tween) || Boolean(spin) }));
      scene.updateMatrixWorld(); camera.updateMatrixWorld();
      try { renderer.render(scene, camera); }
      catch (error) { useFlatFallback(error); drawFlat(); }
    } else drawFlat();
    projectMarkers();
    if (signature && landLoaded) {
      if (metrics.firstFrameAtMs === null) {
        metrics.firstFrameAtMs = now; metrics.firstFrameMs = now - createdAt;
        host.dataset.worldFirstFrameMs = String(Math.round(now));
      }
      if (turnSample) { turnSample.frames++; turnSample.first ??= now; turnSample.last = now; }
      if (turnSample && !tween && !drag && !pinch && !handActive) finishFrameSample();
      if (!readyNotified) {
        readyNotified = true;
        try { onReady?.({ mode, webgl: Boolean(renderer), landLoaded, presentation, playing: isAutoRotating(), firstFrameAtMs: metrics.firstFrameAtMs, firstFrameMs: metrics.firstFrameMs }); } catch (error) { reportError(error); }
      }
    }
    if (tween || spin || zoom !== zoomGoal || lookMoving || shouldRotate()) { chained = true; schedule(); }
  }
  function schedule() { if (!destroyed && !pageSuspended && visible && !document.hidden && !raf) raf = requestAnimationFrame(render); }
  function finishMotion() {
    previousFrameTime = undefined; spin = null; chained = false;
    if (tween) { Object.assign(rotation, tween.to); tween = null; }
    if (zoom !== zoomGoal) { zoom = zoomGoal; updateCamera(); }
  }
  // Angular velocity over the last moments of a drag, so a flick carries on and a rest does not.
  function trackSpin(gesture) {
    const now = performance.now();
    const trail = gesture.trail ||= [];
    trail.push({ time: now, x: rotation.x, y: rotation.y });
    while (trail.length > 2 && now - trail[0].time > 120) trail.shift();
  }
  function releaseSpin(gesture) {
    const trail = gesture?.trail, now = performance.now();
    spin = null;
    if (!signature || reducedMotion.matches || !trail || trail.length < 2 || now - trail.at(-1).time > 70) return;
    const first = trail[0], last = trail.at(-1), seconds = (last.time - first.time) / 1000;
    if (seconds < 0.016) return;
    const x = clamp((last.x - first.x) / seconds, -5, 5), y = clamp((last.y - first.y) / seconds, -5, 5);
    if (Math.hypot(x, y) > 0.12) spin = { x, y };
  }
  function orient(target, duration = 620) {
    spin = null;
    const shortest = shortestLongitudeDelta(rotation.y, target.y);
    const to = { x: clamp(target.x, -1.48, 1.48), y: rotation.y + shortest };
    if (reducedMotion.matches || mode === 'map') { Object.assign(rotation, to); tween = null; }
    else {
      if (signature) beginFrameSample();
      tween = { from: { ...rotation }, to, start: performance.now(), duration: signature ? 800 : duration };
    }
    schedule();
  }
  // Resizing a canvas clears it, and resize observers run after this frame's animation
  // callbacks but before it is painted. Without drawing again here the globe is blank for
  // as long as its stage is changing size, which is every time a place is chosen or closed.
  function redraw() {
    if (destroyed || pageSuspended || !visible || document.hidden || !width || !height) return;
    if (mode === 'globe' && renderer) {
      earth.rotation.set(rotation.x, rotation.y, 0, 'XYZ');
      scene.updateMatrixWorld(); camera.updateMatrixWorld();
      try { renderer.render(scene, camera); }
      catch (error) { useFlatFallback(error); drawFlat(); }
    } else drawFlat();
    projectMarkers();
  }
  function resize() { applySize(true); }
  function applySize(draw) {
    if (destroyed) return;
    const nextWidth = Math.round(host.clientWidth), nextHeight = Math.round(host.clientHeight);
    if (!nextWidth || !nextHeight) {
      if (!signature) { width = nextWidth; height = nextHeight; }
      return;
    }
    // The sculpted globe draws its lights in WebGL, so fill rate sets the budget. It starts
    // at two device pixels per CSS pixel and gives density back if the renderer cannot keep up.
    const pixelLimit = signature ? QUALITY_TIERS[tier].pixelRatio : 1.5;
    const nextPixelRatio = Math.min(devicePixelRatio || 1, pixelLimit);
    // The flat map is drawn in 2D and has no fill rate to save: it keeps its own density,
    // whichever tier the globe has settled on.
    const nextFlatRatio = Math.min(devicePixelRatio || 1, signature && Math.min(innerWidth, nextWidth) <= 760 ? 1.25 : 1.5);
    if (signature && width === nextWidth && height === nextHeight && pixelRatio === nextPixelRatio && flatPixelRatio === nextFlatRatio) return;
    const pixelRatioChanged = pixelRatio !== nextPixelRatio;
    width = nextWidth; height = nextHeight; pixelRatio = nextPixelRatio; flatPixelRatio = nextFlatRatio;
    flat.width = Math.round(width * flatPixelRatio); flat.height = Math.round(height * flatPixelRatio);
    if (renderer) {
      if (!signature || pixelRatioChanged) renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      updateCamera();
      if (originPoints) originPoints.material.uniforms.pointScale.value = 24 * pixelRatio;
    }
    if (draw && signature) redraw();
    schedule();
  }
  function beginFrameSample() {
    turnSample = { frames: 0, first: null, last: null, started: performance.now() };
  }
  function finishFrameSample() {
    if (!turnSample) return;
    const sample = turnSample; turnSample = null;
    if (sample.frames < 2 || sample.last <= sample.first) return;
    metrics.lastTurnFps = (sample.frames - 1) * 1000 / (sample.last - sample.first);
    metrics.lastTurnDurationMs = sample.last - sample.started;
    host.dataset.worldTurnFps = metrics.lastTurnFps.toFixed(1);
    host.dataset.worldTurnDurationMs = String(Math.round(metrics.lastTurnDurationMs));
  }
  // Radians of turn per pixel of drag, so the surface stays under the hand. Perspective
  // enlarges the near face of the sphere, so its centre moves further on screen per radian
  // than the silhouette radius suggests; the small lead keeps points off-centre from lagging.
  function dragGain() {
    const distance = camera?.position.z || 0;
    if (!(distance > 1) || !height) return 0.006;
    const radius = height / (2 * Math.tan(camera.fov * RAD / 2) * Math.sqrt(distance * distance - 1));
    const nearFace = radius * Math.sqrt((distance + 1) / (distance - 1));
    return 1.06 / clamp(nearFace, 130, 620);
  }
  function pauseForHand() {
    if (!signature) return;
    clearTimeout(resumeTimer);
    resumeAt = performance.now() + AUTO_ROTATE_RESUME_MS;
    previousFrameTime = undefined;
    resumeTimer = setTimeout(() => {
      if (destroyed) return;
      previousFrameTime = undefined; schedule();
    }, AUTO_ROTATE_RESUME_MS);
  }
  function nearestMarker(clientX, clientY) {
    const bounds = host.getBoundingClientRect();
    const x = clientX - bounds.left, y = clientY - bounds.top;
    let distance = 22, nearest = null;
    for (const [id, position] of positions) {
      const next = Math.hypot(position.x - x, position.y - y);
      if (next <= distance) { distance = next; nearest = id; }
    }
    return nearest;
  }
  function globeHit(clientX, clientY, target) {
    if (mode !== 'globe' || !renderer || !camera) return false;
    if (target instanceof Element && target.closest('[data-world-light]:not([hidden])')) return true;
    return pointOnGlobe(clientX, clientY, host.getBoundingClientRect(), camera.position.z, camera.fov);
  }
  function installSignatureHandling() {
    // Chrome may mark programmatic canvas focus as focus-visible after a click.
    // Explicit pointer input wins; before any input the browser's focus ring is useful.
    let keyboardModality = null;
    const isKeyboardTarget = target => target instanceof Element &&
      (target === canvas || Boolean(target.closest('[data-world-light]')));
    const holdsKeyboardFocus = target => isKeyboardTarget(target) &&
      (keyboardModality === true || (keyboardModality === null && target.matches(':focus-visible')));
    const setKeyboardHold = held => {
      if (held === keyboardHeld) return;
      keyboardHeld = held;
      if (held) { clearTimeout(resumeTimer); previousFrameTime = undefined; }
      else pauseForHand();
      schedule();
    };
    const clearKeyboardModality = () => {
      keyboardModality = false;
      setKeyboardHold(false);
    };
    window.addEventListener('keydown', event => {
      if (event.metaKey || event.altKey || event.ctrlKey) return;
      keyboardModality = true;
      if (isKeyboardTarget(document.activeElement)) setKeyboardHold(true);
    }, { signal, capture: true });
    window.addEventListener('pointerdown', clearKeyboardModality, { signal, capture: true, passive: true });
    window.addEventListener('touchstart', clearKeyboardModality, { signal, capture: true, passive: true });
    mount.addEventListener('focusin', event => setKeyboardHold(holdsKeyboardFocus(event.target)), { signal });
    mount.addEventListener('focusout', () => queueMicrotask(() => {
      if (!destroyed) setKeyboardHold(holdsKeyboardFocus(document.activeElement));
    }), { signal });
    const touchDistance = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const midpoint = touches => ({ x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 });
    const noteScroll = () => { lastScrollAt = performance.now(); };
    window.addEventListener('scroll', noteScroll, { capture: true, passive: true, signal });
    canvas.style.cursor = 'auto';
    const hold = () => {
      clearTimeout(resumeTimer); handActive = true; tween = null; spin = null; previousFrameTime = undefined;
    };
    const release = () => {
      handActive = false; drag = null; pinch = null;
      finishFrameSample(); pauseForHand(); schedule();
    };
    function hover(event) {
      if (event.pointerType === 'touch') return;
      const hit = globeHit(event.clientX, event.clientY, event.target);
      if (hoverHeld !== hit) {
        hoverHeld = hit;
        if (hit) { clearTimeout(resumeTimer); previousFrameTime = undefined; }
        else if (!handActive) pauseForHand();
      }
      const nearest = drag ? null : nearestMarker(event.clientX, event.clientY);
      if (!drag) canvas.style.cursor = nearest ? 'pointer' : hit ? 'grab' : 'auto';
      if (nearest !== hoveredId) {
        hoveredId = nearest;
        if (look?.setHover(nearest)) schedule();
      }
      for (const place of entries) {
        const lifted = place.id === nearest || place.id === selectedId;
        if (lifted) placeLabel(place);
        place.labelNode.style.opacity = lifted ? '1' : '0';
        place.button.style.zIndex = place.id === nearest ? '5' : place.id === selectedId ? '4' : '2';
      }
    }
    mount.addEventListener('pointermove', event => {
      hover(event);
      if (event.pointerType === 'touch' || !drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      drag.moved ||= Math.hypot(dx, dy) > 5;
      rotation.y = drag.rotation.y + dx * drag.gain;
      rotation.x = clamp(drag.rotation.x + dy * drag.gain * .7, -1.48, 1.48);
      trackSpin(drag); schedule();
    }, { signal });
    mount.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch' || event.button !== 0 || !globeHit(event.clientX, event.clientY, event.target)) return;
      hold(); beginFrameSample();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, rotation: { ...rotation }, moved: false, gain: dragGain() };
      event.target.setPointerCapture?.(event.pointerId);
      if (event.target === canvas) canvas.focus({ preventScroll: true });
      canvas.style.cursor = 'grabbing';
    }, { signal });
    const endPointer = event => {
      if (event.pointerType === 'touch' || !drag || drag.id !== event.pointerId) return;
      if (drag.moved) suppressClickUntil = performance.now() + 350;
      if (event.type === 'pointerup' && drag.moved) releaseSpin(drag);
      release();
      if (event.type === 'pointerup') hover(event);
      else { hoverHeld = false; canvas.style.cursor = 'auto'; }
    };
    mount.addEventListener('pointerup', endPointer, { signal });
    mount.addEventListener('pointercancel', endPointer, { signal });
    mount.addEventListener('lostpointercapture', endPointer, { signal });
    mount.addEventListener('pointerleave', event => {
      if (event.pointerType === 'touch') return;
      hoverHeld = false;
      if (hoveredId !== null) { hoveredId = null; if (look?.setHover(null)) schedule(); }
      if (!drag) { canvas.style.cursor = 'auto'; pauseForHand(); }
    }, { signal });
    mount.addEventListener('touchstart', event => {
      const now = performance.now();
      if (!touchGesture) {
        const first = event.touches[0];
        const owns = event.cancelable && now - lastScrollAt >= 150 && globeHit(first.clientX, first.clientY, event.target);
        touchGesture = { owner: owns ? 'globe' : 'page', pageLocked: !event.cancelable || now - lastScrollAt < 150, startedAt: now, scrollAtStart: lastScrollAt,
          x: first.clientX, y: first.clientY, rotation: { ...rotation }, moved: false, gain: dragGain(),
          marker: nearestMarker(first.clientX, first.clientY) };
        if (owns) { hold(); beginFrameSample(); }
      }
      if (touchGesture.owner === 'page' && !touchGesture.pageLocked && event.touches.length === 2 && event.cancelable
        && now - lastScrollAt >= 150 && lastScrollAt <= touchGesture.scrollAtStart) {
        const middle = midpoint(event.touches);
        if (globeHit(middle.x, middle.y)) {
          touchGesture.owner = 'globe'; touchGesture.marker = null; hold(); beginFrameSample();
        }
      }
      if (touchGesture.owner !== 'globe') return;
      if (!event.cancelable) { touchGesture.owner = 'page'; touchGesture.pageLocked = true; release(); return; }
      event.preventDefault();
      hoverHeld = false;
      if (event.touches.length === 2) {
        pinch = { distance: Math.max(1, touchDistance(event.touches)), zoom };
        touchGesture.moved = true; touchGesture.marker = null;
      }
    }, { signal, capture: true, passive: false });
    mount.addEventListener('touchmove', event => {
      if (touchGesture?.owner !== 'globe') return;
      if (event.cancelable) event.preventDefault();
      else { touchGesture.owner = 'page'; touchGesture.pageLocked = true; release(); return; }
      if (event.touches.length === 2) {
        pinch ??= { distance: Math.max(1, touchDistance(event.touches)), zoom };
        setZoom(pinch.zoom * pinch.distance / Math.max(1, touchDistance(event.touches)), true);
        touchGesture.moved = true; touchGesture.marker = null; touchGesture.trail = null;
      } else if (event.touches.length === 1) {
        const touch = event.touches[0];
        const dx = touch.clientX - touchGesture.x, dy = touch.clientY - touchGesture.y;
        touchGesture.moved ||= Math.hypot(dx, dy) > 7;
        rotation.y = touchGesture.rotation.y + dx * touchGesture.gain;
        rotation.x = clamp(touchGesture.rotation.x + dy * touchGesture.gain * .7, -1.48, 1.48);
        trackSpin(touchGesture); schedule();
      }
    }, { signal, capture: true, passive: false });
    const endTouch = event => {
      if (!touchGesture) return;
      if (event.touches.length) {
        if (event.touches.length === 1 && touchGesture.owner === 'globe') {
          pinch = null;
          touchGesture.x = event.touches[0].clientX; touchGesture.y = event.touches[0].clientY;
          touchGesture.rotation = { ...rotation }; touchGesture.gain = dragGain(); touchGesture.trail = null;
        }
        return;
      }
      const ended = touchGesture; touchGesture = null;
      // Page-owned touches must not select a light through a later native click.
      // Keyboard activation (detail=0) stays available in the click handler.
      suppressClickUntil = performance.now() + 350;
      if (ended.owner !== 'globe') return;
      if (event.cancelable) event.preventDefault();
      if (event.type !== 'touchcancel' && ended.moved) releaseSpin(ended);
      release();
      if (event.type !== 'touchcancel' && ended.marker && !ended.moved && countFor(ended.marker)) onSelect?.(ended.marker);
    };
    mount.addEventListener('touchend', endTouch, { signal, capture: true, passive: false });
    mount.addEventListener('touchcancel', endTouch, { signal, capture: true, passive: false });
    let magnification;
    mount.addEventListener('wheel', event => {
      if (event.ctrlKey && magnification !== undefined) { if (event.cancelable) event.preventDefault(); return; }
      if (!globeHit(event.clientX, event.clientY, event.target) || !event.cancelable) return;
      clearKeyboardModality(); event.preventDefault(); pauseForHand(); tween = null;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
      setZoom((event.ctrlKey ? zoom : zoomGoal) * Math.exp(clamp(delta, -180, 180) * (event.ctrlKey ? .006 : .002)), event.ctrlKey);
    }, { signal, passive: false });
    // Safari exposes trackpad magnification independently of wheel/ctrl-wheel.
    mount.addEventListener('gesturestart', event => {
      if (touchGesture || !globeHit(event.clientX, event.clientY, event.target) || !event.cancelable) return;
      clearKeyboardModality(); event.preventDefault(); magnification = zoom; pauseForHand();
    }, { signal, passive: false });
    mount.addEventListener('gesturechange', event => {
      if (magnification === undefined || !Number.isFinite(event.scale)) return;
      if (event.cancelable) event.preventDefault();
      setZoom(magnification / Math.max(.1, event.scale), true); pauseForHand();
    }, { signal, passive: false });
    mount.addEventListener('gestureend', event => {
      if (magnification !== undefined && event.cancelable) event.preventDefault();
      magnification = undefined;
    }, { signal, passive: false });
    document.addEventListener('gestureend', () => { magnification = undefined; }, { signal, passive: true });
    canvas.addEventListener('keydown', event => {
      if (mode !== 'globe') return;
      const delta = { ArrowLeft: [-.14, 0], ArrowRight: [.14, 0], ArrowUp: [0, -.12], ArrowDown: [0, .12] }[event.key];
      if (event.key === 'Home') { event.preventDefault(); pauseForHand(); setZoom(1); orient(OPENING, 800); }
      else if (['+', '='].includes(event.key)) { event.preventDefault(); pauseForHand(); setZoom(zoomGoal * .85); }
      else if (['-', '_'].includes(event.key)) { event.preventDefault(); pauseForHand(); setZoom(zoomGoal / .85); }
      else if (delta) {
        clearKeyboardModality(); event.preventDefault(); pauseForHand(); tween = null; spin = null;
        rotation.y += delta[0]; rotation.x = clamp(rotation.x + delta[1], -1.48, 1.48); schedule();
      }
    }, { signal });
    window.addEventListener('blur', () => { hoverHeld = false; keyboardHeld = false; keyboardModality = false; touchGesture = null; magnification = undefined; release(); }, { signal });
    window.addEventListener('pagehide', () => { magnification = undefined; }, { signal });
    return () => { clearTimeout(resumeTimer); };
  }

  if (!signature) {
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
  } else installSignatureHandling();

  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; finishMotion(); } else schedule(); }, { signal });
  window.addEventListener('pagehide', event => {
    pageSuspended = true; cancelAnimationFrame(raf); raf = 0; finishMotion(); drag = null; canvas.style.cursor = signature ? 'auto' : 'grab'; pinch = null; touchGesture = null; handActive = false; hoverHeld = false; keyboardHeld = false;
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
        const markerCount = signature ? count.toLocaleString('en-US') : count > 99 ? '99+' : String(count);
        const total = !signature && count > 99 ? ` (${count} in total)` : '';
        place.number.textContent = signature ? '' : markerCount;
        place.button.setAttribute('aria-label', `${place.label}: ${markerCount} ${count === 1 ? 'work' : 'works'}${total}. ${place.precision === 'country' ? 'Country' : 'Regional'} location, not an exact artwork site.`);
        place.button.setAttribute('aria-pressed', String(selected));
        if (signature) {
          const size = 4.5 + Math.log1p(count) * 1.15;
          place.button.dataset.worldCount = String(count);
          place.number.style.width = `${size}px`; place.number.style.height = `${size}px`;
          place.dotOpacity = String(count ? .45 + Math.min(.55, Math.log1p(count) / 12) : .16);
          place.number.style.opacity = drawnLights() ? '0' : place.dotOpacity;
          place.button.style.color = selected ? '#c9a5ff' : '#e9d17e';
          place.labelNode.textContent = `${place.label} · ${markerCount} ${count === 1 ? 'work' : 'works'}`;
          if (selected) placeLabel(place);
          place.labelNode.style.opacity = selected || place.id === hoveredId ? '1' : '0'; place.button.style.zIndex = selected ? '4' : '2';
          continue;
        }
        place.button.style.background = selected ? place.color : '#081326e8';
        place.button.style.color = selected ? '#04111c' : place.color;
        place.button.style.boxShadow = selected ? `0 0 0 4px ${place.color}33,0 0 24px ${place.color}99` : `0 0 15px ${place.color}70`;
        place.labelNode.style.opacity = selected ? '1' : '0'; place.button.style.zIndex = selected ? '4' : '2';
      }
      look?.setLights(countFor, selectedId);
      if (selectedId && selectedId !== before && (signature || countFor(selectedId))) { const place = unique.get(selectedId); if (signature) pauseForHand(); orient({ x: place.lat * RAD, y: -place.lon * RAD }, signature ? 800 : 620); }
      schedule();
    },
    reset() { if (!destroyed) { setZoom(1); if (signature) pauseForHand(); orient(OPENING); } },
    centerPlace(id) {
      const place = unique.get(id);
      if (destroyed || !place) return false;
      if (signature) pauseForHand();
      orient({ x: place.lat * RAD, y: -place.lon * RAD }, 800);
      return true;
    },
    captureView() { return { rotation: { ...rotation }, zoom: zoomGoal, mode, autoRotateRequested }; },
    restoreView(view) {
      if (destroyed || !view || !Number.isFinite(view.rotation?.x) || !Number.isFinite(view.rotation?.y) || !Number.isFinite(view.zoom)) return false;
      autoRotateRequested = Boolean(view.autoRotateRequested);
      setZoom(view.zoom);
      if (signature) pauseForHand();
      orient(view.rotation, 800); notifyMotion(); return true;
    },
    getMetrics() { return { ...metrics, rotating: shouldRotate(), rotation: { ...rotation }, zoom, mode, qualityTier: tier, pixelRatio }; },
    zoomIn() { if (!destroyed) setZoom(zoomGoal * 0.85); },
    zoomOut() { if (!destroyed) setZoom(zoomGoal / 0.85); },
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
      destroyed = true; events.abort(); clearTimeout(resumeTimer); cancelAnimationFrame(raf); tween = null; drag = null; pinch = null;
      observer?.disconnect(); visibilityObserver?.disconnect();
      look?.dispose(); look = null;
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
      if (!signature) { try { onReady?.({ mode, webgl: Boolean(renderer), landLoaded, presentation, playing: isAutoRotating() }); } catch (error) { reportError(error); } }
    } catch (error) {
      if (destroyed || signal.aborted) return;
      landFailed = true; fallback.textContent = 'The map is unavailable. Use the place selector to explore.';
      // Without its coastline the sculpted globe is still a plain sphere behind the message.
      look?.showBare();
      reportError(error); schedule();
    }
  })();
  return api;
}
