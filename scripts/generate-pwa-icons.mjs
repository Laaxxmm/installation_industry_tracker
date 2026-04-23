// Generates PWA icons from the SAB brand mark.
// Orange (#d97757) background with the white connector motif from
// MobileHeader.tsx. Writes icon-192, icon-512, icon-maskable-512, and
// apple-touch-icon-180 into public/icons.

import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = new URL("../public/icons/", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);

const ACCENT = "#d97757"; // oklch(0.68 0.16 45) roughly in sRGB

// Full-bleed icon (for `purpose: "any"` and apple-touch-icon). The motif
// fills 60% of the canvas so it reads from a distance.
function fullBleedSvg(size) {
  const inner = size * 0.56;
  const offset = (size - inner) / 2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${ACCENT}"/>
  <g transform="translate(${offset} ${offset}) scale(${inner / 40})" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round">
    <path d="M11 25 C 11 21, 14 19, 18 19 C 22 19, 25 17, 25 13" />
    <circle cx="11" cy="15" r="2.6" fill="#fff" stroke="none"/>
    <circle cx="29" cy="25" r="2.6" fill="#fff" stroke="none"/>
  </g>
</svg>`;
}

// Maskable icon — same mark but with a larger safe margin because Android
// crops the outer ~10% into a squircle/circle/rounded-square.
function maskableSvg(size) {
  const inner = size * 0.44;
  const offset = (size - inner) / 2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${ACCENT}"/>
  <g transform="translate(${offset} ${offset}) scale(${inner / 40})" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round">
    <path d="M11 25 C 11 21, 14 19, 18 19 C 22 19, 25 17, 25 13" />
    <circle cx="11" cy="15" r="2.6" fill="#fff" stroke="none"/>
    <circle cx="29" cy="25" r="2.6" fill="#fff" stroke="none"/>
  </g>
</svg>`;
}

async function render(svg, size, name) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  const path = join(OUT_DIR, name);
  await writeFile(path, buf);
  console.log(`  wrote ${name} (${buf.length} bytes)`);
}

await mkdir(OUT_DIR, { recursive: true });
console.log(`Writing icons to ${OUT_DIR}`);
await render(fullBleedSvg(192), 192, "icon-192.png");
await render(fullBleedSvg(512), 512, "icon-512.png");
await render(maskableSvg(512), 512, "icon-maskable-512.png");
await render(fullBleedSvg(180), 180, "apple-touch-icon.png");
await render(fullBleedSvg(32), 32, "favicon-32.png");
console.log("Done.");
