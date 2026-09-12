import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export async function sourceFingerprint(root) {
  const hash = createHash('sha256');
  async function visit(relative) {
    const filename = path.join(root, relative), info = await fs.stat(filename);
    if (info.isDirectory()) {
      for (const name of (await fs.readdir(filename)).sort()) await visit(relative + '/' + name);
    } else { hash.update(relative + '\0'); hash.update(await fs.readFile(filename)); }
  }
  for (const file of ['src', 'index.html', 'favicon.svg', 'package.json', 'package-lock.json', 'vite.config.js', 'desktop/package.json', 'desktop/package-lock.json', 'desktop/main.cjs', 'desktop/preload.cjs', 'desktop/policy.cjs', 'desktop/platform.cjs', 'desktop/store.mjs', 'desktop/assets', 'scripts/build-desktop.mjs', 'scripts/package-desktop.mjs', 'scripts/desktop-inputs.mjs', 'scripts/release-metadata.mjs']) await visit(file);
  return hash.digest('hex');
}
export async function treeHashes(directory) {
  const hashes = {};
  async function visit(dir) {
    for (const entry of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) hashes[path.relative(directory, file).split(path.sep).join('/')] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
      else throw new Error('Unsupported build entry');
    }
  }
  await visit(directory); return hashes;
}
