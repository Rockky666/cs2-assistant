import { Resvg } from '@resvg/resvg-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

// Format conversion only: the supplied SVG artwork and colours are preserved.
await mkdir('build', { recursive: true });
for (const name of ['Blue-dark-logo', 'Dark-logo', 'Red-dark-logo', 'Green-dark-logo']) {
  const png = new Resvg(await readFile(`public/assets/Logo-themes/${name}.svg`), {
    fitTo: { mode: 'width', value: 256 },
  })
    .render()
    .asPng();
  await writeFile(`public/assets/Logo-themes/${name}.png`, png);
  if (name === 'Blue-dark-logo') {
    const header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(1, 4);
    header.writeUInt16LE(1, 10);
    header.writeUInt16LE(32, 12);
    header.writeUInt32LE(png.length, 14);
    header.writeUInt32LE(22, 18);
    await writeFile('build/icon.ico', Buffer.concat([header, png]));
  }
}
