import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const catalog = JSON.parse(await readFile(path.join(repoRoot, 'src/data/catalog.json'), 'utf8'));
const outRoot = path.join(repoRoot, 'public/previews/posters');

// Night Atrium palette: deep navy base + a single warm raking light + a cool-chalk
// figure. Subtle variation in navy depth and light hue (brass / gold / bronze) keeps
// the grid alive without breaking the "one light, one stone" concept.
// [base (page), field (wash), glow (the light), marble (the figure)]
const palettes = [
  ['#0B1220', '#1B2942', '#E0A95B', '#EAF0F7'],
  ['#0A101A', '#16233A', '#D9A44C', '#F1ECDE'],
  ['#0C1322', '#20304E', '#ECBE78', '#EAF0F7'],
  ['#091019', '#182843', '#C8924A', '#EDE7D8'],
  ['#0B1220', '#1E2E4A', '#E6B36A', '#F2EEE4'],
  ['#0A0F1A', '#1A2740', '#D9A44C', '#E9EEF6'],
];

function seedFor(text) {
  return [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function posterSvg(work) {
  const seed = seedFor(work.slug);
  const [base, field, glow, marble] = palettes[seed % palettes.length];
  const tilt = (seed % 13) - 6;
  const x = 330 + (seed % 92) - 46;
  const y = 130 + (seed % 64);
  const scale = 0.78 + (seed % 18) / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 900" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(work.title)}</title>
  <desc id="desc">Dark gallery poster preview for ${escapeXml(work.title)}.</desc>
  <defs>
    <radialGradient id="halo" cx="50%" cy="28%" r="45%">
      <stop offset="0" stop-color="${glow}" stop-opacity=".82"/>
      <stop offset=".36" stop-color="${glow}" stop-opacity=".22"/>
      <stop offset="1" stop-color="${base}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="figure" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${marble}"/>
      <stop offset=".54" stop-color="${glow}"/>
      <stop offset="1" stop-color="${marble}" stop-opacity=".68"/>
    </linearGradient>
    <filter id="soft">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
  </defs>
  <rect width="720" height="900" fill="${base}"/>
  <rect width="720" height="900" fill="${field}" opacity=".38"/>
  <path d="M${x - 210} 0 L${x + 120} 0 L${x + 250} 900 L${x - 120} 900 Z" fill="${glow}" opacity=".16"/>
  <path d="M${x - 80} 0 L${x + 70} 0 L${x + 170} 900 L${x - 20} 900 Z" fill="${marble}" opacity=".08"/>
  <path d="M0 706 C126 650 246 730 376 686 C504 644 560 598 720 642 L720 900 L0 900 Z" fill="#000" opacity=".24"/>
  <g transform="translate(${x - 120} ${y + 16}) rotate(${tilt} 120 260) scale(${scale})">
    <ellipse cx="118" cy="44" rx="42" ry="48" fill="url(#figure)"/>
    <path d="M80 98 C112 72 150 74 178 100 C170 174 158 234 178 314 C152 342 102 340 76 310 C94 235 88 170 80 98Z" fill="url(#figure)"/>
    <path d="M77 128 C38 166 20 230 34 296 C48 306 65 305 76 292 C68 236 84 194 110 154Z" fill="url(#figure)" opacity=".88"/>
    <path d="M174 124 C216 154 236 212 224 268 C210 278 194 276 184 263 C190 216 175 180 150 150Z" fill="url(#figure)" opacity=".76"/>
    <path d="M96 310 C74 390 70 470 48 558 C66 580 96 580 112 558 C126 474 142 398 132 318Z" fill="url(#figure)" opacity=".9"/>
    <path d="M154 314 C176 386 194 462 212 548 C198 572 166 574 150 550 C142 466 126 390 120 318Z" fill="url(#figure)" opacity=".86"/>
    <ellipse cx="130" cy="574" rx="112" ry="20" fill="${marble}" opacity=".68"/>
  </g>
</svg>
`;
}

for (const work of catalog) {
  const dir = path.join(outRoot, work.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'poster.svg'), posterSvg(work));
}

console.log(`Generated ${catalog.length} poster previews in ${outRoot}`);
