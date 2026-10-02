// Quick Look is also available in several iOS browsers whose rel=ar probe
// returns false. Keep this exception narrow; embedded social browsers may
// advertise the feature without being able to launch it.
export function spatialDevice({ userAgent = '', platform = '', maxTouchPoints = 0, relAR = false, webView = false } = {}) {
  const apple = /iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
  const android = /Android/i.test(userAgent);
  const appleBrowser = apple && /(?:CriOS|FxiOS|EdgiOS|GSA|DuckDuckGo)\//.test(userAgent);
  const embedded = /FBAN|FBAV|Instagram|MicroMessenger|\bLine\/|; wv\)/i.test(userAgent)
    || (apple && webView && !appleBrowser);
  return { apple, android, embedded, quickLook: !embedded && (relAR || appleBrowser) };
}

// Some browsers expose an incomplete XR API or never settle the support
// request. Each mode has its own deadline so neither can block the other.
export async function probeSpatialSupport(xr, mode, timeoutMs = 2500) {
  if (typeof xr?.isSessionSupported !== 'function' || typeof xr?.requestSession !== 'function') return false;
  let timer;
  try {
    return Boolean(await Promise.race([
      Promise.resolve().then(() => xr.isSessionSupported(mode)),
      new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); }),
    ]));
  } catch { return false; }
  finally { clearTimeout(timer); }
}
