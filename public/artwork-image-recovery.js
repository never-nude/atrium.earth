(() => {
  const thumbnailPath = /\/previews\/renders\/((?:[^/]+\/)*[^/]+)\/thumb\.(webp|jpg)$/;
  const jpegMap = document.currentScript?.dataset.jpegMap;
  const pending = new WeakSet();
  const backups = new WeakMap();
  let hashes;
  const placeholder = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" viewBox="0 0 720 900"><rect width="720" height="900" fill="#17263a"/><text x="360" y="450" fill="#c7d4e4" font-family="system-ui,sans-serif" font-size="24" text-anchor="middle" dominant-baseline="middle">Image temporarily unavailable</text></svg>'
  );

  function jpegHashes() {
    return hashes ??= fetch(jpegMap)
      .then(response => response.ok ? response.json() : {})
      .catch(() => ({}));
  }

  async function recoverArtworkImage(image) {
    if (!(image instanceof HTMLImageElement) || !image.src) return;

    const url = new URL(image.src, document.baseURI);
    const backup = backups.get(image);
    if (backup) {
      backups.delete(image);
      if (url.href === backup.cdn) {
        image.src = backup.local;
        return;
      }
    }
    const match = thumbnailPath.exec(url.pathname);
    if (url.origin !== location.origin || !match) return;

    if (match[2] === 'webp') {
      if (pending.has(image)) return;
      const source = image.src;
      const slug = match[1];
      url.pathname = url.pathname.replace(/\.webp$/, '.jpg');
      url.searchParams.set('artwork-recovery', '1');
      let cdn;
      if (jpegMap) {
        pending.add(image);
        const hash = (await jpegHashes())?.[slug];
        pending.delete(image);
        if (image.src !== source) return;
        if (/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/.test(slug) && typeof hash === 'string' && /^[a-f0-9]{12}$/.test(hash)) {
          cdn = `https://models.atrium.earth/previews/renders/${slug}/thumb-${hash}.jpg`;
          backups.set(image, { cdn, local: url.href });
        }
      }
      image.removeAttribute('srcset');
      image.src = cdn ?? url.href;
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
