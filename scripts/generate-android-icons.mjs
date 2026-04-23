// Generates the SAB-branded Android launcher icons + splash from the same
// brand mark used for the PWA (orange #d97757 + white connector motif).
//
// Writes into android/app/src/main/res/:
//   - mipmap-*dpi/ic_launcher.png         full-bleed orange + motif (legacy)
//   - mipmap-*dpi/ic_launcher_round.png   round-masked equivalent
//   - drawable/ic_launcher_foreground.png white motif on transparent (adaptive)
//   - drawable/splash.png                 1024x1024 launch image
//   - values/ic_launcher_background.xml   overwritten to the orange color

import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = new URL("../android/app/src/main/res/", import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, "$1");

const ACCENT = "#d97757";

// Legacy full-bleed launcher (mipmap-*dpi/ic_launcher.png)
function legacySvg(size) {
  const inner = size * 0.56;
  const off = (size - inner) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${ACCENT}"/>
    <g transform="translate(${off} ${off}) scale(${inner / 40})" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round">
      <path d="M11 25 C 11 21, 14 19, 18 19 C 22 19, 25 17, 25 13"/>
      <circle cx="11" cy="15" r="2.6" fill="#fff" stroke="none"/>
      <circle cx="29" cy="25" r="2.6" fill="#fff" stroke="none"/>
    </g>
  </svg>`;
}

// Adaptive icon foreground: transparent bg, motif sits in the 66% safe area
// (Android Oreo+ crops the outer ~25% to a squircle/circle/etc.)
function adaptiveFgSvg(size) {
  const inner = size * 0.36; // smaller so it survives the mask crop
  const off = (size - inner) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <g transform="translate(${off} ${off}) scale(${inner / 40})" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round">
      <path d="M11 25 C 11 21, 14 19, 18 19 C 22 19, 25 17, 25 13"/>
      <circle cx="11" cy="15" r="2.6" fill="#fff" stroke="none"/>
      <circle cx="29" cy="25" r="2.6" fill="#fff" stroke="none"/>
    </g>
  </svg>`;
}

async function writePng(svg, size, path) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  await writeFile(path, buf);
  console.log(`  wrote ${path.replace(ROOT, "")} (${buf.length} bytes)`);
}

const legacySizes = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

console.log(`Writing Android assets under ${ROOT}`);
for (const [dir, size] of Object.entries(legacySizes)) {
  await mkdir(join(ROOT, dir), { recursive: true });
  await writePng(legacySvg(size), size, join(ROOT, dir, "ic_launcher.png"));
  await writePng(legacySvg(size), size, join(ROOT, dir, "ic_launcher_round.png"));
  // Adaptive foreground per density (same motif, transparent bg)
  await writePng(adaptiveFgSvg(size * 2), size * 2, join(ROOT, dir, "ic_launcher_foreground.png"));
}

// Splash screen drawable (2732x2732 is overkill; 1024 is plenty and fast)
await mkdir(join(ROOT, "drawable"), { recursive: true });
await writePng(legacySvg(1024), 1024, join(ROOT, "drawable", "splash.png"));

// Overwrite the color background for the adaptive icon to SAB orange
const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${ACCENT}</color>
</resources>
`;
await writeFile(join(ROOT, "values", "ic_launcher_background.xml"), bgXml);
console.log(`  wrote values/ic_launcher_background.xml -> ${ACCENT}`);

console.log("Done.");
