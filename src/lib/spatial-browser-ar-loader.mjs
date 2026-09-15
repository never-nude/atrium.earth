let loading;

export function loadBrowserAREngine() {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const timeout = setTimeout(() => finish(new Error('AR engine download timed out.')), 45000);
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      window.removeEventListener('xrloaded', ready);
      if (error) { script.remove(); loading = undefined; reject(error); }
      else resolve(window.XR8);
    };
    const ready = () => {
      if (!window.XR8) return;
      try { Promise.resolve(window.XR8.initialize()).then(() => finish(), finish); }
      catch (error) { finish(error); }
    };
    if (window.XR8) { ready(); return; }
    window.addEventListener('xrloaded', ready, { once: true });
    script.src = `${import.meta.env.BASE_URL}external/xr/xr.js`;
    script.async = true;
    script.dataset.preloadChunks = 'slam';
    script.onerror = () => finish(new Error('AR engine could not load.'));
    document.head.append(script);
  });
  return loading;
}

// Safari requires these calls inside the tap, before awaiting the engine/model.
export function requestBrowserARMotion() {
  const requests = [];
  for (const api of [window.DeviceMotionEvent, window.DeviceOrientationEvent]) {
    if (typeof api?.requestPermission === 'function') requests.push(api.requestPermission());
  }
  return Promise.all(requests).then((results) => {
    if (results.some(result => result !== 'granted')) throw new DOMException('Motion permission is needed for AR.', 'NotAllowedError');
  });
}
