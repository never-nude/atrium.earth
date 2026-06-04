import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const migrationPath = path.join(repoRoot, 'dist', 'migration-map.json');
const redirectsPath = path.join(repoRoot, 'dist', '_redirects');

const redirects = JSON.parse(await readFile(migrationPath, 'utf8'));
const lines = redirects.map((redirect) => `${redirect.from} ${redirect.to} ${redirect.status}!`);

await writeFile(redirectsPath, `${lines.join('\n')}\n`);
console.log(`Wrote ${redirects.length} redirects to ${redirectsPath}`);
