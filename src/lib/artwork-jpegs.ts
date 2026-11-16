import pagesAssets from '../data/pages-cdn-assets.json';
import { withoutBase } from './urls';

const localJpeg = /^\/previews\/renders\/([a-z0-9_-]+(?:\/[a-z0-9_-]+)*)\/thumb\.jpg$/;
const cdn = 'https://models.atrium.earth';

export const artworkJpegHashes = Object.fromEntries(Object.entries(pagesAssets).flatMap(([pathname, asset]) => {
  const slug = pathname.match(localJpeg)?.[1];
  if (!slug) return [];
  const hash = asset.sha256.slice(0, 12);
  if (!/^[a-f0-9]{12}$/.test(hash) || asset.key !== `previews/renders/${slug}/thumb-${hash}.jpg`) {
    throw new Error(`Invalid verified JPEG address for ${slug}`);
  }
  return [[slug, hash]];
}));

export function socialArtworkImage(image: string): string {
  const jpeg = image.replace(/(\/previews\/renders\/.+\/thumb)\.webp(?:\?preview=alpha1)?$/, '$1.jpg');
  const slug = withoutBase(jpeg).match(localJpeg)?.[1];
  if (!slug || !Object.hasOwn(artworkJpegHashes, slug)) return jpeg;
  return `${cdn}/previews/renders/${slug}/thumb-${artworkJpegHashes[slug]}.jpg`;
}
