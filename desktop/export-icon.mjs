// Export the existing vector identity; no new artwork or runtime dependency.
import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const desktop = path.dirname(fileURLToPath(import.meta.url));
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'bonk-icon-'));
const app = await electron.launch({ args: [desktop, '--profile-dir=' + profile] });
try {
  const page = await app.firstWindow();
  const svg = await fs.readFile(path.join(desktop, '../favicon.svg'), 'utf8');
  const data = await page.evaluate(async svg => {
    const img = new Image(); img.src = 'data:image/svg+xml;base64,' + btoa(svg); await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    canvas.getContext('2d').drawImage(img, 0, 0, 256, 256);
    return canvas.toDataURL('image/png').split(',')[1];
  }, svg);
  const png = Buffer.from(data, 'base64');
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  await fs.mkdir(path.join(desktop, 'assets'), { recursive: true });
  await fs.writeFile(path.join(desktop, 'assets/icon.png'), png);
  await fs.writeFile(path.join(desktop, 'assets/icon.ico'), Buffer.concat([header, png]));
} finally { await app.close(); await fs.rm(profile, { recursive: true, force: true }); }
