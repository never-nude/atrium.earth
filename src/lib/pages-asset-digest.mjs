import { createHash } from 'node:crypto';

export function matchesPagesAsset(bytes, asset) {
  return bytes.length === asset.bytes && createHash('sha256').update(bytes).digest('hex') === asset.sha256;
}
