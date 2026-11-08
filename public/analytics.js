(() => {
  // Keep local builds, hosted previews and embedded card miniatures out of reports.
  if (!['atrium.earth', 'www.atrium.earth'].includes(location.hostname)) return;
  if (new URLSearchParams(location.search).get('studio-peek') === '1') return;
  if (document.querySelector('script[data-atrium-analytics]')) return;

  // The active Google tag routes to Atrium's connected Analytics destinations.
  const measurementId = 'G-6M9PZE5M3E';
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);

  const analytics = document.createElement('script');
  analytics.async = true;
  analytics.dataset.atriumAnalytics = '';
  analytics.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(analytics);
})();
