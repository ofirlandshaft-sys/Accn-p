import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const appDir = path.join(__dirname, "..", "app");
mkdirSync(publicDir, { recursive: true });

// Source logo: "Tel Aviv Control" emblem (small raster, ~87x85 — upscaled
// with lanczos3; a bit soft at 512px but legible at normal icon sizes).
const sourcePath = path.join(__dirname, "logo-source.png");

const MASKABLE_BG = "#ffffff"; // logo has its own established colors; white keeps it clean

/** Logo padded onto a transparent square canvas, contained (no crop). */
async function squareTransparent(size, marginFrac = 0.06) {
  const inner = Math.round(size * (1 - marginFrac * 2));
  const buf = await sharp(sourcePath)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: buf, gravity: "center" }])
    .png();
}

/** Logo on an opaque square background (for maskable icons / apple-touch, which can't have transparency). */
async function squareOpaque(size, background, marginFrac) {
  const inner = Math.round(size * (1 - marginFrac * 2));
  const buf = await sharp(sourcePath)
    .resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .flatten({ background })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: buf, gravity: "center" }])
    .png();
}

async function main() {
  await (await squareTransparent(192)).toFile(path.join(publicDir, "icon-192.png"));
  await (await squareTransparent(512)).toFile(path.join(publicDir, "icon-512.png"));
  // maskable: bigger safe-zone margin (~20%) so nothing gets clipped when the OS masks it into a shape
  await (await squareOpaque(192, MASKABLE_BG, 0.2)).toFile(path.join(publicDir, "icon-maskable-192.png"));
  await (await squareOpaque(512, MASKABLE_BG, 0.2)).toFile(path.join(publicDir, "icon-maskable-512.png"));
  await (await squareOpaque(180, MASKABLE_BG, 0.1)).toFile(path.join(publicDir, "apple-touch-icon.png"));

  // Next.js file-convention icons (app/icon.png, app/apple-icon.png)
  await (await squareTransparent(256)).toFile(path.join(appDir, "icon.png"));
  await (await squareOpaque(180, MASKABLE_BG, 0.1)).toFile(path.join(appDir, "apple-icon.png"));

  console.log("wrote all icons from", sourcePath);
}

main();
