import {connectWorldViewControls,updateWorldZoomControls} from './world-view-controls.js';
const root = document.querySelector('[data-home-world]');
if (root) {
  let started = false, disposed = false, globe, disconnectControls;
  async function start() {
    if (started) return;
    started = true;
    const loading = root.querySelector('[data-home-world-loading]');
    try {
      const {createWorldGlobe} = await import('./world-globe.js');
      if (disposed) return;
      const data = JSON.parse(root.querySelector('[data-home-world-data]').textContent || '{}');
      globe = createWorldGlobe({host:root.querySelector('[data-home-world-globe]'),places:data.places,presentation:'invitation',autoRotate:true,
        onReady:info => {loading.hidden=true;root.querySelector('[data-world-view-controls]').hidden=info.mode==='map';},
        onError:() => {loading.hidden=true;root.querySelector('[data-world-view-controls]').hidden=true;},
        onZoomChange:state => updateWorldZoomControls(root,state),
        onAutoRotateChange:() => root.dispatchEvent(new Event('world-rotation-change')),
      });
      globe.update({counts:data.counts});
      disconnectControls = connectWorldViewControls(root,globe,root.querySelector('[data-world-viewport]'));
    } catch {loading.textContent='Explore the globe to discover the collection by place and time.';}
  }
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {observer.disconnect();void start();}
  },{rootMargin:'160px'}) : null;
  if (observer) observer.observe(root); else void start();
  window.addEventListener('pagehide',event => {
    if (!event.persisted) {disposed=true;observer?.disconnect();disconnectControls?.();globe?.destroy();}
  });
}
