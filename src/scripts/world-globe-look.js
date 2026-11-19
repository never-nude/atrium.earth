// The sculpted look of the signature globe.
//
// The earth is treated as an object in a vitrine: land cast in low relief,
// a dark lacquered sea, one warm key light at two
// o'clock and a violet rim, matching the way Atrium lights its sculpture.
// Each documented origin is a real point of light with a hairline beam.
//
// Everything is derived at run time from the bundled Natural Earth land mask.
// The relief is a stylised emboss of the coastline; they are
// not terrain or bathymetry.
import * as THREE from 'three';
import { RELIEF_SLOPE_RANGE, approach, bakeRelief, lightMetrics, softenMask } from '../lib/world-globe-relief.mjs';

// Coast resolution: 2,048 texels around the equator on large high-density stages, half that elsewhere.
const COAST_FINE = 2048;
const COAST_PLAIN = 1024;
const STAR_COUNT = 1300;
// The atmosphere is a ring just outside the silhouette, in units of the silhouette radius.
const HALO_INNER = 0.955;
const HALO_OUTER = 1.56;
// Unit vectors toward each light, in view space (+x right, +y up, +z to the viewer).
const KEY_DIRECTION = new THREE.Vector3(0.60, 0.56, 0.57).normalize();
const RIM_DIRECTION = new THREE.Vector3(-0.78, -0.34, -0.52).normalize();
// The selection ring is a plane; this is the way it faces before it is laid on the surface.
const RING_FACING = new THREE.Vector3(0, 0, 1);
// Surface colours are linear (lit, then encoded). Glow colours are display-referred:
// they are added straight onto the page, so they skip the output transform.
const colour = hex => new THREE.Color(hex);
const glowColour = hex => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);

const SURFACE_VERTEX = /* glsl */`
  varying vec3 vObject;
  varying vec3 vView;
  varying vec2 vUv;
  void main() {
    vObject = position;
    vUv = uv;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vView = view.xyz;
    gl_Position = projectionMatrix * view;
  }
`;

const SURFACE_FRAGMENT = /* glsl */`
  uniform sampler2D uCoast;
  uniform sampler2D uRelief;
  uniform mat3 normalMatrix;
  uniform vec3 uKey;
  uniform vec3 uRim;
  uniform vec3 uSea;
  uniform vec3 uSeaLit;
  uniform vec3 uLand;
  uniform vec3 uGild;
  uniform vec3 uKeyColor;
  uniform vec3 uRimColor;
  uniform vec3 uAmbient;
  uniform vec3 uInk;
  uniform float uHasLand;
  uniform float uExposure;
  uniform float uDetail;
  varying vec3 vObject;
  varying vec3 vView;
  varying vec2 vUv;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  // Value noise with its analytic gradient: one lookup gives the tone and the tilt of the grain.
  vec4 grain(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    vec3 u = f * f * (3.0 - 2.0 * f);
    vec3 du = 6.0 * f * (1.0 - f);
    float a = hash(i);
    float b = hash(i + vec3(1.0, 0.0, 0.0));
    float c = hash(i + vec3(0.0, 1.0, 0.0));
    float d = hash(i + vec3(1.0, 1.0, 0.0));
    float e = hash(i + vec3(0.0, 0.0, 1.0));
    float g = hash(i + vec3(1.0, 0.0, 1.0));
    float h = hash(i + vec3(0.0, 1.0, 1.0));
    float k = hash(i + vec3(1.0, 1.0, 1.0));
    float k1 = b - a, k2 = c - a, k3 = e - a;
    float k4 = a - b - c + d, k5 = a - c - e + h, k6 = a - b - e + g;
    float k7 = -a + b + c - d + e - g - h + k;
    return vec4(
      a + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z,
      du * vec3(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z, k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x, k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y));
  }
  // An antialiased hairline wherever the coordinate crosses an integer. The footprint is
  // how far the coordinate moves across one pixel.
  float hairline(float coordinate, float footprint, float width) {
    float distance = abs(fract(coordinate - 0.5) - 0.5) / max(footprint, 1e-5);
    return 1.0 - smoothstep(width - 0.5, width + 0.5, distance);
  }

  void main() {
    vec3 n = normalize(vObject);
    // The bake keeps canvas order: row zero is the north pole.
    vec2 uv = vec2(vUv.x + 0.25, 1.0 - vUv.y);
    float cover = texture2D(uCoast, uv).r * uHasLand;
    vec4 relief = texture2D(uRelief, uv);
    vec2 slope = (relief.ba - 0.5) * ${RELIEF_SLOPE_RANGE.toFixed(4)} * uHasLand;

    // The shoreline is the half-way contour of a softened mask: a clean curve at any size.
    float edge = fwidth(cover) * 0.75 + 0.01;
    float land = smoothstep(0.5 - edge, 0.5 + edge, cover);

    vec3 tangentEast = vec3(n.z, 0.0, -n.x) / max(1e-4, length(n.xz));
    vec3 tangentNorth = cross(n, tangentEast);

    // Hand-worked metal: a little grain in the surface of the land only.
    float tone = 0.99;
    if (land * uDetail > 0.002) {
      vec4 worked = grain(n * 86.0);
      tone = 0.84 + 0.30 * worked.x;
      slope += vec2(dot(worked.yzw, tangentEast), dot(worked.yzw, tangentNorth)) * (0.10 * land * uDetail);
    }

    vec3 N = normalize(normalMatrix * normalize(n - tangentEast * slope.x - tangentNorth * slope.y));
    vec3 G = normalize(normalMatrix * n);
    vec3 V = normalize(-vView);
    vec3 H = normalize(uKey + V);

    float keyG = clamp((dot(G, uKey) + 0.26) / 1.26, 0.0, 1.0);
    float key = clamp((dot(N, uKey) + 0.20) / 1.20, 0.0, 1.0);
    float rim = clamp(dot(N, uRim), 0.0, 1.0);
    float rimG = clamp(dot(G, uRim), 0.0, 1.0);

    // Sea: dark lacquer with one small, moving glint.
    float gloss = max(dot(G, H), 0.0);
    float gloss4 = gloss * gloss * gloss * gloss;
    float gloss16 = gloss4 * gloss4 * gloss4 * gloss4;
    float gloss64 = gloss16 * gloss16 * gloss16 * gloss16;
    vec3 sea = mix(uSea, uSeaLit, keyG * keyG);
    sea += uKeyColor * (gloss64 * gloss64 * 0.22 + gloss16 * 0.030);
    sea += uRimColor * rimG * sqrt(rimG) * 0.10;

    // Engraved graticule, every thirty degrees. Longitude jumps by a whole turn at the
    // antimeridian, so its footprint comes from the direction itself, which has no seam.
    float turn = (abs(n.z * dFdx(n.x) - n.x * dFdx(n.z)) + abs(n.z * dFdy(n.x) - n.x * dFdy(n.z))) / max(dot(n.xz, n.xz), 1e-6);
    float meridian = hairline(atan(n.x, n.z) * 1.9098593, turn * 1.9098593, 0.5) * (1.0 - smoothstep(0.90, 0.985, abs(n.y)));
    float latitude = asin(clamp(n.y, -1.0, 1.0)) * 1.9098593;
    float parallel = hairline(latitude, fwidth(latitude), 0.5);
    float graticule = max(meridian, parallel);
    sea += uInk * graticule * (0.028 + 0.050 * keyG);

    // Land: patinated metal in low relief.
    vec3 metal = uLand * tone;
    float sheen = max(dot(N, H), 0.0);
    float sheen4 = sheen * sheen * sheen * sheen;
    float sheen16 = sheen4 * sheen4 * sheen4 * sheen4;
    vec3 raised = metal * (uAmbient + uKeyColor * key * 1.10);
    raised += uRimColor * rim * (0.05 + 0.34 * metal);
    raised += uGild * (sheen16 * 0.10 + sheen16 * sheen16 * sheen16 * sheen16 * sheen16 * 0.16) * (0.4 + 0.75 * tone);
    raised += uInk * graticule * 0.012;

    vec3 colour = mix(sea, raised, land);

    // The coast itself: a gilded edge in the light, violet in the shadow.
    float coast = (1.0 - smoothstep(0.0, 1.0, abs(cover - 0.5) / (edge * 1.8))) * uHasLand;
    colour += mix(uRimColor * 0.30, uGild, smoothstep(0.08, 0.7, key)) * coast * 0.16;

    // Atmosphere on the limb, warm toward the key light.
    // Clamped at both ends: straight on, rounding can put the dot product a hair above one.
    float graze = clamp(1.0 - dot(G, V), 0.0, 1.0);
    float fresnel = graze * graze * graze * sqrt(graze);
    float lit = smoothstep(-0.30, 0.70, dot(G, uKey));
    colour += mix(uRimColor * 0.20, uKeyColor * 0.15, lit) * fresnel;

    colour *= uExposure;
    colour = colour / (1.0 + 0.16 * max(colour.r, max(colour.g, colour.b)));
    gl_FragColor = vec4(colour, 1.0);
    #include <colorspace_fragment>
  }
`;

const HALO_VERTEX = /* glsl */`
  varying vec2 vPlane;
  void main() {
    vPlane = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HALO_FRAGMENT = /* glsl */`
  uniform vec2 uKey;
  uniform vec2 uStage;
  uniform vec3 uWarm;
  uniform vec3 uCool;
  uniform float uStrength;
  varying vec2 vPlane;
  void main() {
    float radius = length(vPlane);
    float beyond = max(radius - 1.0, 0.0);
    float side = dot(vPlane / max(radius, 1e-4), uKey) * 0.5 + 0.5;
    float tight = max(1.0 - beyond * 14.0, 0.0);
    float mid = max(1.0 - beyond * 3.6, 0.0);
    float wide = max(1.0 - beyond * 1.8, 0.0);
    float glow = tight * tight * 0.20 + mid * mid * mid * 0.062 + wide * wide * wide * 0.030;
    glow *= smoothstep(${HALO_INNER.toFixed(3)}, 1.0, radius) * mix(0.42, 1.0, side) * uStrength;
    // The light dies away before the edge of the stage, so the canvas never shows its frame.
    vec2 margin = uStage - abs(vPlane);
    glow *= smoothstep(0.0, uStage.y * 0.22, margin.y) * smoothstep(0.0, uStage.y * 0.22, margin.x);
    vec3 tint = mix(uCool, uWarm, smoothstep(0.30, 0.90, side));
    gl_FragColor = vec4(tint * glow, 0.0);
  }
`;

const LIGHT_VERTEX = /* glsl */`
  attribute float aSize;
  attribute float aGlow;
  attribute float aTint;
  attribute float aSeed;
  uniform float uPixelRatio;
  uniform float uScale;
  uniform float uTime;
  uniform float uCores;
  varying float vGlow;
  varying float vTint;
  varying float vCore;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vec3 normal = normalize(normalMatrix * position);
    float facing = dot(normal, normalize(-view.xyz));
    float shimmer = 1.0 + 0.09 * sin(uTime * (1.1 + aSeed * 1.9) + aSeed * 41.0);
    vGlow = aGlow * smoothstep(0.02, 0.26, facing) * shimmer;
    vTint = aTint;
    float core = aSize * uScale;
    // The core pass only needs to cover the point itself; the glow pass covers its halo.
    float sprite = uCores > 0.5 ? core * 1.25 + 1.5 : core * 4.2 + 6.0;
    vCore = core / sprite;
    gl_PointSize = sprite * 2.0 * uPixelRatio;
    gl_Position = vGlow > 0.002 ? projectionMatrix * view : vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

const LIGHT_FRAGMENT = /* glsl */`
  uniform vec3 uGold;
  uniform vec3 uHot;
  uniform vec3 uChosen;
  uniform float uCores;
  varying float vGlow;
  varying float vTint;
  varying float vCore;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d >= 1.0) discard;
    vec3 tint = mix(uGold, uChosen, vTint);
    if (uCores > 0.5) {
      // A solid point with a warm edge, premultiplied over whatever glows beneath it.
      float core = 1.0 - smoothstep(vCore * 0.70, vCore * 1.18, d);
      float heart = 1.0 - smoothstep(0.0, vCore * 0.95, d);
      vec3 hot = mix(tint, mix(uHot, vec3(1.0), vTint * 0.45), 0.35 + 0.65 * heart);
      float alpha = core * min(vGlow, 1.0);
      gl_FragColor = vec4(hot * alpha, alpha);
    } else {
      float near = d / (vCore * 2.1);
      float bloom = 1.0 / (1.0 + near * near * near * near);
      float halo = (1.0 - d) * (1.0 - d);
      gl_FragColor = vec4(tint * (bloom * 0.34 * halo + halo * 0.105) * vGlow, 0.0);
    }
  }
`;

// Each beam is a camera-facing sliver so its width is the same on every display.
const BEAM_VERTEX = /* glsl */`
  attribute float aEnd;
  attribute float aSide;
  attribute float aHeight;
  attribute float aGlow;
  attribute float aTint;
  uniform vec2 uResolution;
  uniform float uWidth;
  varying float vFade;
  varying float vSide;
  varying float vTint;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vec4 foot = projectionMatrix * view;
    vec4 tip = projectionMatrix * modelViewMatrix * vec4(position * (1.0 + aHeight), 1.0);
    vec2 along = (tip.xy / tip.w - foot.xy / foot.w) * uResolution;
    float reach = length(along);
    vec2 across = reach > 1e-4 ? vec2(-along.y, along.x) / reach : vec2(1.0, 0.0);
    vec4 clip = mix(foot, tip, aEnd);
    clip.xy += across * aSide * uWidth / uResolution * clip.w;
    float facing = dot(normalize(normalMatrix * position), normalize(-view.xyz));
    // A beam seen end-on would only thicken its own light; one far round the back is not there.
    vFade = (1.0 - aEnd) * aGlow * smoothstep(1.5, 9.0, reach) * smoothstep(-0.16, 0.04, facing);
    vSide = aSide;
    vTint = aTint;
    gl_Position = aGlow > 0.002 ? clip : vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

const BEAM_FRAGMENT = /* glsl */`
  uniform vec3 uGold;
  uniform vec3 uChosen;
  varying float vFade;
  varying float vSide;
  varying float vTint;
  void main() {
    float body = 1.0 - vSide * vSide;
    gl_FragColor = vec4(mix(uGold, uChosen, vTint) * vFade * body * 0.46, 0.0);
  }
`;

const RING_VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAGMENT = /* glsl */`
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uPulse;
  uniform float uPresence;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float thin = fwidth(r) * 1.4;
    float alpha = (1.0 - smoothstep(0.0, thin, abs(r - 0.34))) * 0.80;
    for (int i = 0; i < 2; i++) {
      float phase = fract(uTime * 0.46 + float(i) * 0.5);
      float wave = 1.0 - smoothstep(0.0, thin * 1.6, abs(r - mix(0.34, 0.97, phase)));
      alpha += wave * (1.0 - phase) * (1.0 - phase) * 0.62 * uPulse;
    }
    gl_FragColor = vec4(uColor * alpha * uPresence, 0.0);
  }
`;

const STAR_VERTEX = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    gl_PointSize = aSize * uPixelRatio;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STAR_FRAGMENT = /* glsl */`
  uniform vec3 uColor;
  uniform float uStrength;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    gl_FragColor = vec4(uColor * (1.0 - smoothstep(0.25, 1.0, d)) * vAlpha * uStrength, 0.0);
  }
`;

// Pure additive light: it adds to whatever is behind the canvas and never dims it.
const additive = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };
// Premultiplied: a solid point laid over the glow beneath it.
const premultiplied = { ...additive, blendDst: THREE.OneMinusSrcAlphaFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };

/** A deterministic 0–1 sequence, so the sky and the opening order never change between visits. */
function sequence(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rasteriseLand(polygons, width) {
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  let ctx;
  try { ctx = canvas.getContext('2d', { willReadFrequently: true }); } catch {}
  if (!ctx) return null;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
  // A hair of rounded stroke eases the coarse source polygons and keeps small islands.
  ctx.lineWidth = width / 1400; ctx.lineJoin = 'round';
  for (const polygon of polygons) {
    ctx.beginPath();
    for (const ring of polygon) {
      for (let i = 0; i < ring.length; i++) {
        const x = (ring[i][0] + 180) / 360 * width;
        const y = (90 - ring[i][1]) / 180 * height;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fill('evenodd');
    ctx.stroke();
  }
  let pixels;
  try { pixels = ctx.getImageData(0, 0, width, height).data; } catch { return null; }
  const mask = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < mask.length; i++, j += 4) mask[i] = pixels[j];
  canvas.width = 1; canvas.height = 1;
  return mask;
}

/**
 * Builds the sculpted globe inside an existing scene. The caller keeps the
 * renderer, camera, gestures and DOM; this only owns what is drawn.
 */
export function createGlobeLook({ scene, earth, camera, places }) {
  const owned = new Set();
  const own = resource => { owned.add(resource); return resource; };
  const gold = glowColour('#e9d17e');
  const violet = glowColour('#c9a5ff');

  // Until the land is baked: no cover, no shelf, level ground.
  const blank = own(new THREE.DataTexture(new Uint8Array([0, 0, 128, 128]), 1, 1, THREE.RGBAFormat));
  blank.needsUpdate = true;
  const surfaceUniforms = {
    uCoast: { value: blank }, uRelief: { value: blank },
    uKey: { value: KEY_DIRECTION }, uRim: { value: RIM_DIRECTION },
    uSea: { value: colour('#070c18') }, uSeaLit: { value: colour('#15213a') },
    uLand: { value: colour('#3b465f') }, uGild: { value: colour('#f1dc9a') },
    uKeyColor: { value: colour('#fff2d6') }, uRimColor: { value: colour('#c9a5ff') },
    uAmbient: { value: colour('#3b3a52') }, uInk: { value: colour('#f5f2e9') },
    uHasLand: { value: 0 }, uExposure: { value: 1 }, uDetail: { value: 1 },
  };
  const surface = new THREE.Mesh(own(new THREE.SphereGeometry(1, 96, 64)),
    own(new THREE.ShaderMaterial({ uniforms: surfaceUniforms, vertexShader: SURFACE_VERTEX, fragmentShader: SURFACE_FRAGMENT })));
  surface.visible = false;
  earth.add(surface);

  const haloUniforms = {
    uStrength: { value: 0 }, uStage: { value: new THREE.Vector2(3, 3) },
    uKey: { value: new THREE.Vector2(KEY_DIRECTION.x, KEY_DIRECTION.y).normalize() },
    uWarm: { value: glowColour('#f4dfae') }, uCool: { value: violet },
  };
  // Only a band around the silhouette is rasterised. It starts a little inside the limb,
  // so the glow meets the sphere without a gap.
  const halo = new THREE.Mesh(own(new THREE.RingGeometry(HALO_INNER, HALO_OUTER, 96, 1)),
    own(new THREE.ShaderMaterial({ uniforms: haloUniforms, vertexShader: HALO_VERTEX, fragmentShader: HALO_FRAGMENT, depthTest: false, ...additive })));
  halo.renderOrder = -2; halo.frustumCulled = false; halo.visible = false;
  scene.add(halo);

  // A sparse field of dust in the light. It turns with the earth, so a drag moves the whole room.
  const random = sequence(0x41747269);
  const starPosition = new Float32Array(STAR_COUNT * 3), starSize = new Float32Array(STAR_COUNT), starAlpha = new Float32Array(STAR_COUNT);
  for (let i = 0; i < STAR_COUNT; i++) {
    const y = random() * 2 - 1, angle = random() * Math.PI * 2, radius = 8.5 + random() * 5, across = Math.sqrt(1 - y * y);
    starPosition.set([Math.cos(angle) * across * radius, y * radius, Math.sin(angle) * across * radius], i * 3);
    const bright = random();
    starSize[i] = 1.1 + bright * bright * 1.9;
    starAlpha[i] = 0.10 + bright * bright * bright * 0.62;
  }
  const starGeometry = own(new THREE.BufferGeometry());
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPosition, 3));
  starGeometry.setAttribute('aSize', new THREE.BufferAttribute(starSize, 1));
  starGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(starAlpha, 1));
  const starUniforms = { uPixelRatio: { value: 1 }, uStrength: { value: 0 }, uColor: { value: glowColour('#f1e6c8') } };
  const stars = new THREE.Points(starGeometry, own(new THREE.ShaderMaterial({ uniforms: starUniforms, vertexShader: STAR_VERTEX, fragmentShader: STAR_FRAGMENT, ...additive })));
  stars.frustumCulled = false; stars.renderOrder = -1; stars.visible = false;
  earth.add(stars);

  // Lights and their beams share one animated state per place.
  const count = places.length;
  const index = new Map(places.map((place, i) => [place.id, i]));
  const fields = ['size', 'glow', 'beam', 'tint'];
  const target = Object.fromEntries(fields.map(key => [key, new Float32Array(count)]));
  const live = Object.fromEntries(fields.map(key => [key, new Float32Array(count)]));
  const delay = new Float32Array(count);
  const position = new Float32Array(count * 3), seed = new Float32Array(count);
  const dawn = new THREE.Vector3(0.7, 0.35, 0.6).normalize();
  places.forEach((place, i) => {
    // Each light is drawn exactly at the caller's vector: the caller projects the same
    // vector for the hit target, focus ring and label, so they cannot drift apart.
    position.set([place.vector.x, place.vector.y, place.vector.z], i * 3);
    const unit = place.vector.clone().normalize();
    seed[i] = random();
    // The lights come on from the key-lit east, like a room being lit.
    delay[i] = 0.15 + (1 - (unit.dot(dawn) * 0.5 + 0.5)) * 0.55 + random() * 0.4;
  });
  const lightGeometry = own(new THREE.BufferGeometry());
  lightGeometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  lightGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const lightSize = new THREE.BufferAttribute(live.size, 1), lightGlow = new THREE.BufferAttribute(live.glow, 1), lightTint = new THREE.BufferAttribute(live.tint, 1);
  for (const attribute of [lightSize, lightGlow, lightTint]) attribute.setUsage(THREE.DynamicDrawUsage);
  lightGeometry.setAttribute('aSize', lightSize);
  lightGeometry.setAttribute('aGlow', lightGlow);
  lightGeometry.setAttribute('aTint', lightTint);
  const shared = { uPixelRatio: { value: 1 }, uScale: { value: 1 }, uTime: { value: 0 } };
  const lightUniforms = cores => ({
    ...shared, uCores: { value: cores }, uGold: { value: gold }, uHot: { value: glowColour('#fff6d8') }, uChosen: { value: violet },
  });
  // Glow first, then every core on top, so crowded regions stay countable.
  const glows = new THREE.Points(lightGeometry, own(new THREE.ShaderMaterial({ uniforms: lightUniforms(0), vertexShader: LIGHT_VERTEX, fragmentShader: LIGHT_FRAGMENT, depthTest: false, ...additive })));
  const lights = new THREE.Points(lightGeometry, own(new THREE.ShaderMaterial({ uniforms: lightUniforms(1), vertexShader: LIGHT_VERTEX, fragmentShader: LIGHT_FRAGMENT, depthTest: false, ...premultiplied })));
  glows.renderOrder = 4; lights.renderOrder = 5;
  for (const points of [glows, lights]) { points.frustumCulled = false; points.visible = false; earth.add(points); }

  const beamPosition = new Float32Array(count * 12), beamEnd = new Float32Array(count * 4), beamSide = new Float32Array(count * 4);
  const beamHeight = new Float32Array(count * 4), beamGlow = new Float32Array(count * 4), beamTint = new Float32Array(count * 4);
  const beamIndex = new Uint16Array(count * 6);
  for (let i = 0; i < count; i++) {
    for (let corner = 0; corner < 4; corner++) {
      beamPosition.set(position.subarray(i * 3, i * 3 + 3), (i * 4 + corner) * 3);
      beamEnd[i * 4 + corner] = corner >> 1;
      beamSide[i * 4 + corner] = corner & 1 ? 1 : -1;
    }
    beamIndex.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
  }
  const beamGeometry = own(new THREE.BufferGeometry());
  beamGeometry.setAttribute('position', new THREE.BufferAttribute(beamPosition, 3));
  beamGeometry.setAttribute('aEnd', new THREE.BufferAttribute(beamEnd, 1));
  beamGeometry.setAttribute('aSide', new THREE.BufferAttribute(beamSide, 1));
  const beamHeights = new THREE.BufferAttribute(beamHeight, 1), beamGlows = new THREE.BufferAttribute(beamGlow, 1), beamTints = new THREE.BufferAttribute(beamTint, 1);
  for (const attribute of [beamHeights, beamGlows, beamTints]) attribute.setUsage(THREE.DynamicDrawUsage);
  beamGeometry.setAttribute('aHeight', beamHeights);
  beamGeometry.setAttribute('aGlow', beamGlows);
  beamGeometry.setAttribute('aTint', beamTints);
  beamGeometry.setIndex(new THREE.BufferAttribute(beamIndex, 1));
  const beamUniforms = { uResolution: { value: new THREE.Vector2(1, 1) }, uWidth: { value: 1.2 }, uGold: { value: gold }, uChosen: { value: violet } };
  const beams = new THREE.Mesh(beamGeometry, own(new THREE.ShaderMaterial({ uniforms: beamUniforms, vertexShader: BEAM_VERTEX, fragmentShader: BEAM_FRAGMENT, side: THREE.DoubleSide, ...additive })));
  beams.frustumCulled = false; beams.renderOrder = 3; beams.visible = false;
  earth.add(beams);

  const ringUniforms = { uColor: { value: violet }, uTime: { value: 0 }, uPulse: { value: 0 }, uPresence: { value: 0 } };
  const ring = new THREE.Mesh(own(new THREE.PlaneGeometry(1, 1)),
    own(new THREE.ShaderMaterial({ uniforms: ringUniforms, vertexShader: RING_VERTEX, fragmentShader: RING_FRAGMENT, side: THREE.DoubleSide, ...additive })));
  ring.renderOrder = 2; ring.visible = false;
  earth.add(ring);

  let landReady = false;
  let revealAt = null;
  let clock = 0;
  let previous;
  let hovered = -1;
  let chosen = -1;
  let ringPresence = 0;
  let pulseUntil = 0;
  let settled = false;
  let sky = true;
  let stageDetail = 1, tierDetail = 1;
  let bare = false;
  const outward = new THREE.Vector3();

  function show() {
    for (const object of [surface, halo]) object.visible = landReady;
    for (const object of [glows, lights, beams]) object.visible = landReady && !bare;
    stars.visible = landReady && sky;
  }

  function writeLights() {
    for (let i = 0; i < count; i++) {
      for (let corner = 0; corner < 4; corner++) {
        const at = i * 4 + corner;
        beamHeight[at] = live.beam[i]; beamGlow[at] = live.glow[i]; beamTint[at] = live.tint[i];
      }
    }
    lightSize.needsUpdate = lightGlow.needsUpdate = lightTint.needsUpdate = true;
    beamHeights.needsUpdate = beamGlows.needsUpdate = beamTints.needsUpdate = true;
  }

  return {
    get ready() { return landReady; },

    /**
     * Bake the coast and relief from the land polygons. `stagePixels` is the stage
     * height in device pixels. Returns the bake time in ms, or null without a 2D canvas.
     */
    setLand(polygons, stagePixels = 0) {
      const started = performance.now();
      const across = stagePixels >= 1000 ? COAST_FINE : COAST_PLAIN;
      const hard = rasteriseLand(polygons, across);
      const mask = hard && softenMask(hard, across, across / 2, across === COAST_FINE ? 2 : 1);
      if (mask) {
        const coast = own(new THREE.DataTexture(mask, across, across / 2, THREE.RedFormat, THREE.UnsignedByteType));
        coast.minFilter = THREE.LinearMipmapLinearFilter; coast.generateMipmaps = true;
        const baked = bakeRelief(mask, across, across / 2);
        const relief = own(new THREE.DataTexture(baked.data, baked.width, baked.height, THREE.RGBAFormat, THREE.UnsignedByteType));
        // The relief is smooth and never minified far: plain bilinear filtering is exact enough.
        relief.minFilter = THREE.LinearFilter; relief.generateMipmaps = false;
        for (const texture of [coast, relief]) {
          texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.magFilter = THREE.LinearFilter; texture.unpackAlignment = 1;
          texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true;
        }
        surfaceUniforms.uCoast.value = coast;
        surfaceUniforms.uRelief.value = relief;
        surfaceUniforms.uHasLand.value = 1;
      }
      landReady = true; bare = false; settled = false;
      show();
      return mask ? performance.now() - started : null;
    },

    /**
     * The coastline could not be loaded. Show the plain sphere under the same light, with
     * no lights on it: the caller offers no place to choose on the globe in that state.
     */
    showBare() {
      if (landReady) return;
      landReady = true; bare = true; settled = false;
      show();
    },

    /** `countFor(id)` is the number of works; the chosen place turns violet and gains a ring. */
    setLights(countFor, selectedId) {
      const next = index.has(selectedId) ? index.get(selectedId) : -1;
      if (next !== chosen) {
        chosen = next;
        if (chosen >= 0) {
          // The ring turns with the earth, so it is laid on the surface in the earth's own
          // space. (lookAt would aim it at a point in the room and tilt it off the surface.)
          ring.position.fromArray(position, chosen * 3);
          outward.copy(ring.position).normalize();
          ring.position.addScaledVector(outward, 0.004);
          ring.quaternion.setFromUnitVectors(RING_FACING, outward);
          pulseUntil = clock + 4.4;
        }
      }
      places.forEach((place, i) => {
        const metrics = lightMetrics(countFor(place.id));
        const selected = i === chosen, lifted = selected || i === hovered;
        // A chosen place with nothing in the current period still marks where it is.
        target.size[i] = metrics.size * (selected ? 1.22 : lifted ? 1.12 : 1) || (selected ? 2.6 : 0);
        target.glow[i] = Math.min(1.25, metrics.glow * (lifted ? 1.25 : 1)) || (selected ? 0.5 : 0);
        target.beam[i] = metrics.beam * (selected ? 1.6 : 1);
        target.tint[i] = selected ? 1 : 0;
      });
      settled = false;
    },

    /** Lift the light under the pointer or the keyboard focus. Returns true when it changed. */
    setHover(id) {
      const next = index.has(id) ? index.get(id) : -1;
      if (next === hovered) return false;
      const lift = (i, factor) => {
        if (i < 0 || i === chosen || !target.size[i]) return;
        target.size[i] *= factor; target.glow[i] = Math.min(1.25, target.glow[i] * factor * factor);
      };
      lift(hovered, 1 / 1.12); hovered = next; lift(hovered, 1.12);
      settled = false;
      return true;
    },

    /** A lighter tier drops the finest engraving and, at the lowest, the sky. */
    setQuality({ detail = 1, sky: showSky = true } = {}) {
      tierDetail = detail; sky = showSky;
      surfaceUniforms.uDetail.value = stageDetail * tierDetail;
      show();
    },

    /** Camera distance and canvas size drive the halo, beam width and light scale. */
    resize({ width, height, pixelRatio }) {
      const distance = camera.position.z;
      if (!(distance > 1) || !width || !height) return;
      const tangent = Math.tan(camera.fov * Math.PI / 360);
      const silhouette = distance / Math.sqrt(distance * distance - 1);
      const radiusPx = height / (2 * tangent * Math.sqrt(distance * distance - 1));
      // The halo is modelled in silhouette radii, so the stage's half-size is too.
      const stageHalf = distance * tangent / silhouette;
      halo.scale.setScalar(silhouette);
      haloUniforms.uStage.value.set(stageHalf * width / height, stageHalf);
      const scale = Math.max(0.62, Math.min(1.3, Math.pow(radiusPx / 235, 0.55)));
      shared.uScale.value = scale;
      shared.uPixelRatio.value = starUniforms.uPixelRatio.value = pixelRatio;
      beamUniforms.uResolution.value.set(width, height);
      beamUniforms.uWidth.value = Math.max(0.8, scale);
      // Small stages keep the relief and drop the finest engraving, which would only shimmer.
      stageDetail = Math.max(0, Math.min(1, (radiusPx - 70) / 90));
      surfaceUniforms.uDetail.value = stageDetail * tierDetail;
      ring.scale.setScalar(Math.max(0.15, Math.min(0.26, 0.2 * 235 / radiusPx)));
    },

    /**
     * Advance the animated state. Returns true while another frame is wanted.
     * With `still` (reduced motion) everything jumps to its resting value.
     */
    frame(now, { still = false, turning = false } = {}) {
      const seconds = previous === undefined ? 0 : Math.min(0.1, Math.max(0, (now - previous) / 1000));
      previous = now;
      if (!landReady) return false;
      if (revealAt === null) revealAt = still ? -Infinity : clock;
      if (!still) clock += seconds;
      const age = still ? Infinity : clock - revealAt;
      const opening = Math.min(1, age / 0.9);
      const eased = 1 - (1 - opening) ** 3;
      surfaceUniforms.uExposure.value = 0.5 + 0.5 * eased;
      haloUniforms.uStrength.value = eased;
      starUniforms.uStrength.value = eased;
      shared.uTime.value = ringUniforms.uTime.value = still ? 0 : clock;

      let moving = opening < 1;
      if (!settled || moving) {
        let pending = false;
        for (let i = 0; i < count; i++) {
          const lit = still || age >= delay[i];
          for (const key of fields) {
            const goal = lit ? target[key][i] : 0;
            const value = still ? goal : approach(live[key][i], goal, key === 'beam' ? 5.5 : 9, seconds);
            if (value !== live[key][i]) { live[key][i] = value; pending = true; }
            if (value !== goal) pending = true;
          }
          if (!lit && target.glow[i]) pending = true;
        }
        writeLights();
        settled = !pending;
        moving ||= pending;
      }

      const wanted = chosen >= 0 ? 1 : 0;
      ringPresence = still ? wanted : approach(ringPresence, wanted, 7, seconds);
      ringUniforms.uPresence.value = ringPresence;
      ring.visible = ringPresence > 0.003 && !bare;
      const pulsing = !still && chosen >= 0 && clock < pulseUntil;
      ringUniforms.uPulse.value = pulsing ? Math.min(1, (pulseUntil - clock) / 0.9) : 0;
      if (ringPresence !== wanted || pulsing) moving = true;
      // The shimmer only advances while the globe is already turning.
      return moving || (turning && !still);
    },

    dispose() {
      for (const object of [surface, halo, stars, glows, lights, beams, ring]) object.removeFromParent();
      for (const resource of owned) resource.dispose();
      owned.clear();
    },
  };
}
