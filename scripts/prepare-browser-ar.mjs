import { cp, mkdir } from 'node:fs/promises';

// Ship the pinned runtime unchanged, with its copyright and licence. Camera
// frames and tracking stay on the device; no CDN request is needed during AR.
const root = new URL('../', import.meta.url);
await mkdir(new URL('public/external/xr/', root), { recursive: true });
await cp(new URL('node_modules/@8thwall/engine-binary/dist/', root), new URL('public/external/xr/', root), { recursive: true });
await cp(new URL('node_modules/@8thwall/engine-binary/LICENSE', root), new URL('public/external/xr/LICENSE', root));
