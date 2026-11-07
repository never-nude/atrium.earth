// Check the complete post-pruning package before GitHub accepts an upload.
// Model sources stay in Git; verified CDN copies are excluded by the build.
import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const limit = 1_000_000_000;
let bytes = 0;
let files = 0;
async function visit(directory) {
  for (const name of await readdir(directory)) {
    const file = path.join(directory, name);
    const stat = await lstat(file);
    if (stat.isSymbolicLink()) throw new Error(`Pages package contains a symbolic link: ${path.relative(root, file)}`);
    if (stat.isDirectory()) await visit(file);
    else if (stat.isFile()) { bytes += stat.size; files += 1; }
    else throw new Error(`Unsupported Pages package entry: ${path.relative(root, file)}`);
  }
}
await visit(root);
console.log(`Pages package: ${files} files, ${bytes.toLocaleString('en')} bytes; limit ${limit.toLocaleString('en')} bytes.`);
if (bytes > limit) throw new Error('Pages package exceeds the published-site budget. Transfer verified serving copies to the sculpture CDN before deploying.');
