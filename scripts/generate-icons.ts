/**
 * Rasterises public/favicon.svg into the PNG icons referenced by the web manifest
 * and Apple devices. Run after changing the favicon: `node scripts/generate-icons.ts`.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

const root = process.cwd();
const source = await readFile(path.join(root, 'public/favicon.svg'));

const targets: Array<{ file: string; size: number; padding?: number }> = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  // Maskable icons need ~10% safe-zone padding on every side.
  { file: 'icon-maskable-512.png', size: 512, padding: 64 },
];

for (const target of targets) {
  const inner = target.size - (target.padding ?? 0) * 2;
  const icon = await sharp(source).resize(inner, inner).png().toBuffer();
  const image = target.padding
    ? sharp({
        create: {
          width: target.size,
          height: target.size,
          channels: 4,
          background: '#6d5dfc',
        },
      }).composite([{ input: icon, gravity: 'center' }])
    : sharp(icon);
  await image.png().toFile(path.join(root, 'public', target.file));
  console.log(`wrote public/${target.file}`);
}
