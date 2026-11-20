import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// An image record is an explicit alternative to a model, never a missing-model
// exception. Bind it to the exact local image, source, creator and permission.
export async function verifyCatalogImagePreview(slug, image, { root, model, work }) {
  if (model !== undefined) throw new Error('Both model and image previews are configured');
  const prefix = `/images/artworks/${slug}/`;
  if (!image || !image.url?.startsWith(prefix)
      || !/^image\.(?:jpg|png|webp)$/.test(image.url.slice(prefix.length))
      || !Number.isSafeInteger(image.bytes) || image.bytes <= 0
      || !/^[a-f0-9]{64}$/.test(image.sha256 || '')) throw new Error('Invalid image binding');
  for (const url of [work.source_url, work.source_record_url, work.license_url]) {
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) throw new Error('Missing image source, museum record or permission');
  }
  if (!work.scan_author || !work.license || !work.attribution) throw new Error('Missing image creator, license or credit');
  const body = readFileSync(path.join(root, 'public', image.url));
  if (body.length !== image.bytes || createHash('sha256').update(body).digest('hex') !== image.sha256) throw new Error('Image bytes or SHA-256 differ');
  const jpeg = body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
  const png = body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP';
  if (!({ jpg: jpeg, png, webp })[image.url.split('.').at(-1)]) throw new Error('Invalid image file signature');
  // Decode every pixel, so an HTML error or truncated image with a plausible
  // signature cannot pass merely by declaring matching bytes and a hash.
  await sharp(body, { failOn: 'warning' }).stats();
  return true;
}
