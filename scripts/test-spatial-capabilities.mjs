import assert from 'node:assert/strict';
import { spatialDevice, probeSpatialSupport } from '../src/lib/spatial-capabilities.mjs';

assert.equal(spatialDevice({ userAgent: 'iPhone Safari/604.1', relAR: true }).quickLook, true);
for (const browser of ['CriOS', 'FxiOS', 'EdgiOS', 'GSA', 'DuckDuckGo']) {
  assert.equal(spatialDevice({ userAgent: `iPhone ${browser}/123.0`, webView: true }).quickLook, true, `${browser} offers Quick Look even with a false AR probe`);
}
assert.equal(spatialDevice({ userAgent: 'Macintosh Safari/604.1', platform: 'MacIntel', maxTouchPoints: 5, relAR: true }).apple, true, 'Desktop-mode iPad');
assert.equal(spatialDevice({ userAgent: 'Macintosh Safari/604.1', platform: 'MacIntel' }).quickLook, false, 'Desktop Safari does not pretend to be an AR phone');
assert.equal(spatialDevice({ userAgent: 'iPhone Instagram', relAR: true }).quickLook, false, 'Embedded false positive');
assert.equal(spatialDevice({ userAgent: 'iPhone', relAR: true, webView: true }).quickLook, false, 'Unknown webview');
assert.equal(spatialDevice({ userAgent: 'Android Chrome/128.0' }).quickLook, false);
for (const api of [undefined, {}, { isSessionSupported: () => true }]) assert.equal(await probeSpatialSupport(api, 'immersive-ar'), false);
for (const check of [() => { throw new Error('partial API'); }, async () => { throw new Error('blocked'); }, () => new Promise(() => {})]) {
  assert.equal(await probeSpatialSupport({ isSessionSupported: check, requestSession() {} }, 'immersive-ar', 10), false);
}
assert.equal(await probeSpatialSupport({ isSessionSupported: async mode => mode === 'immersive-vr', requestSession() {} }, 'immersive-vr'), true);
console.log('Device checks passed: iOS browsers, embedded apps, iPad, incomplete/denied/timed-out WebXR.');
