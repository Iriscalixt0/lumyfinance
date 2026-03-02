#!/usr/bin/env node
/**
 * Gera ícones PNG em resoluções corretas para PWA e iOS a partir do logo (pig.png).
 * Execute: npm run generate-icons
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const sourcePath = join(publicDir, "pig.png");

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

async function main() {
  if (!existsSync(sourcePath)) {
    console.error("❌ pig.png não encontrado em public/");
    process.exit(1);
  }

  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("❌ sharp não instalado. Execute: npm install sharp --save-dev");
    process.exit(1);
  }

  const buffer = readFileSync(sourcePath);

  for (const { name, size } of sizes) {
    const outPath = join(publicDir, name);
    await sharp(buffer)
      .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(outPath);
    console.log(`✓ ${name} (${size}x${size})`);
  }

  console.log("\n✓ Ícones gerados em public/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
