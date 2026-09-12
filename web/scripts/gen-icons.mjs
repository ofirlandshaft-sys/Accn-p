import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
mkdirSync(publicDir, { recursive: true });

const svgPath = path.join(__dirname, "icon.svg");

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-192.png", size: 192, padded: true },
  { file: "icon-maskable-512.png", size: 512, padded: true },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const t of targets) {
  const img = sharp(svgPath, { density: 384 });
  if (t.padded) {
    // maskable icons need safe-zone padding (~10%) around the artwork
    const inner = Math.round(t.size * 0.8);
    const buf = await sharp(svgPath, { density: 384 })
      .resize(inner, inner)
      .toBuffer();
    await sharp({
      create: {
        width: t.size,
        height: t.size,
        channels: 4,
        background: "#161a23",
      },
    })
      .composite([{ input: buf, gravity: "center" }])
      .png()
      .toFile(path.join(publicDir, t.file));
  } else {
    await img.resize(t.size, t.size).png().toFile(path.join(publicDir, t.file));
  }
  console.log("wrote", t.file);
}
