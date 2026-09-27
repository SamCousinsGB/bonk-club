import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));

export async function gameFingerprint(directory = root) {
  const hash = createHash('sha256');
  async function visit(relative) {
    const file = path.join(directory, relative);
    if ((await fs.stat(file)).isDirectory()) {
      for (const name of (await fs.readdir(file)).sort()) await visit(relative + '/' + name);
    } else {
      // Normalize source text across Windows/Linux checkouts, but preserve every
      // byte of raster artwork and any other binary game assets.
      hash.update(relative + '\0');
      const bytes=await fs.readFile(file);
      hash.update(/\.(?:js|mjs|json|html|css|svg)$/i.test(relative)
        ? bytes.toString('utf8').replaceAll('\r\n', '\n') : bytes);
    }
  }
  for (const name of ['src', 'index.html', 'favicon.svg', 'package.json', 'package-lock.json', 'vite.config.js', 'scripts/release-metadata.mjs']) await visit(name);
  return hash.digest('hex');
}

export async function releaseMetadata(target, directory = root) {
  if (!['browser', 'steam'].includes(target)) throw new Error('Invalid release target');
  const pkg = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
  const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  return { schema: 1, target, version: pkg.version, revision: git(['rev-parse', 'HEAD']),
    dirty: !!git(['status', '--porcelain', '--untracked-files=normal']), gameSourceHash: await gameFingerprint(directory) };
}
