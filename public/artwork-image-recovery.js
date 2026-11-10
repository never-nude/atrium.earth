(() => {
  const thumbnailPath = /\/previews\/renders\/(?:[^/]+\/)+thumb\.(webp|jpg)$/;
  const placeholder = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" viewBox="0 0 720 900"><rect width="720" height="900" fill="#17263a"/><text x="360" y="450" fill="#c7d4e4" font-family="system-ui,sans-serif" font-size="24" text-anchor="middle" dominant-baseline="middle">Image temporarily unavailable</text></svg>'
  );

  function recoverArtworkImage(image) {
    if (!(image instanceof HTMLImageElement) || !image.src) return;

    const url = new URL(image.src, document.baseURI);
    const match = thumbnailPath.exec(url.pathname);
    if (url.origin !== location.origin || !match) return;

    if (match[1] === 'webp') {
      url.pathname = url.pathname.replace(/\.webp$/, '.jpg');
      url.searchParams.set('artwork-recovery', '1');
      image.removeAttribute('srcset');
      image.src = url.href;
      return;
    }

    image.removeAttribute('srcset');
    if (image.alt) image.alt = `Image temporarily unavailable. ${image.alt}`;
    image.src = placeholder;
  }

  // Image errors do not bubble. Capture them for lazy and dynamically added images.
  document.addEventListener('error', (event) => recoverArtworkImage(event.target), true);

  // Catch eager thumbnails that failed before this deferred script ran.
  for (const image of document.images) {
    if (image.complete && image.naturalWidth === 0) recoverArtworkImage(image);
  }
})();
