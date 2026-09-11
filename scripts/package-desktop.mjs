import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { sourceFingerprint, treeHashes } from './desktop-inputs.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'desktop/package.json'));
const { packager } = await import(pathToFileURL(require.resolve('@electron/packager')).href);
const { flipFuses, FuseVersion, FuseV1Options } = await import(pathToFileURL(require.resolve('@electron/fuses')).href);
const platform = process.argv.find(a => a.startsWith('--platform='))?.slice(11) || process.platform;
if (!['win32', 'linux'].includes(platform)) throw new Error('Supported packages: win32 and linux (x64).');
if (platform !== process.platform) throw new Error('Package on the target OS. Use the desktop CI matrix for the other platform.');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const config = JSON.parse(await fs.readFile(path.join(root, 'desktop/build-config.json'), 'utf8'));
if (config.version !== pkg.version) throw new Error('Rebuild desktop assets for this version before packaging.');
if (config.sourceHash !== await sourceFingerprint(root) || JSON.stringify(config.assets) !== JSON.stringify(await treeHashes(path.join(root, 'dist-desktop'))))
  throw new Error('Source or built assets changed. Run desktop:build before packaging.');
const stage = await fs.mkdtemp(path.join(root, 'desktop/.stage-'));
try {
  await fs.mkdir(path.join(stage, 'desktop')); await fs.mkdir(path.join(stage, 'src'));
  await fs.cp(path.join(root, 'desktop/assets'), path.join(stage, 'desktop/assets'), { recursive: true });
  for (const file of ['main.cjs', 'preload.cjs', 'policy.cjs', 'store.mjs', 'build-config.json'])
    await fs.copyFile(path.join(root, 'desktop', file), path.join(stage, 'desktop', file));
  for (const file of ['preferences-data.js', 'identity.js', 'bot-difficulty.js'])
    await fs.copyFile(path.join(root, 'src', file), path.join(stage, 'src', file));
  await fs.cp(path.join(root, 'dist-desktop'), path.join(stage, 'dist-desktop'), { recursive: true });
  await fs.writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: 'bonk-club', productName: 'Bonk Club', author: 'SamCousinsGB', version: pkg.version, type: 'module', main: 'desktop/main.cjs', private: true }));
  const lock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'));
  let notices = 'Bonk Club third-party notices\n\nGame code and original artwork are not licensed by this notice.\nElectron and Chromium notices are also included beside the executable.\n';
  for (const [folder, entry] of Object.entries(lock.packages)) {
    if (!folder || entry.dev) continue;
    const directory = path.join(root, folder);
    const names = (await fs.readdir(directory)).filter(n => /^(license|licence|ofl|copyright)(\.|$)/i.test(n));
    if (!names.length) throw new Error(`Missing licence notice for ${folder}`);
    notices += `\n\n=== ${folder.replace('node_modules/', '')} ${entry.version} ===\n`;
    for (const name of names) notices += await fs.readFile(path.join(directory, name), 'utf8') + '\n';
  }
  await fs.writeFile(path.join(stage, 'THIRD-PARTY-NOTICES.txt'), notices);
  const desktopPkg = JSON.parse(await fs.readFile(path.join(root, 'desktop/package.json'), 'utf8'));
  const outputs = await packager({ dir: stage, name: 'BonkClub', executableName: 'BonkClub', appVersion: pkg.version,
    platform, arch: 'x64', electronVersion: desktopPkg.devDependencies.electron,
    out: path.join(root, 'release'), overwrite: true, asar: true, prune: false,
    icon: path.join(root, 'desktop/assets/icon'),
    win32metadata: { ProductName: 'Bonk Club', FileDescription: 'Bonk Club' },
  });
  for (const output of outputs) {
    const executable = path.join(output, platform === 'win32' ? 'BonkClub.exe' : 'BonkClub');
    await flipFuses(executable, { version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      // Embedded ASAR validation is supported on Windows/macOS, not Linux.
      ...(platform === 'win32' ? { [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true } : {}),
    });
    await fs.writeFile(path.join(output, 'THIRD-PARTY-NOTICES.txt'), notices);
    const hashes = {};
    async function hashDirectory(directory) {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) await hashDirectory(file);
        else if (entry.isFile()) hashes[path.relative(output, file).split(path.sep).join('/')] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
      }
    }
    await hashDirectory(output);
    await fs.writeFile(path.join(output, 'build-manifest.json'), JSON.stringify({ version: pkg.version, revision: config.revision, dirty: config.dirty, platform, arch: 'x64', electron: desktopPkg.devDependencies.electron, hashes }, null, 2) + '\n');
    console.log(`Packaged ${output}`);
  }
} finally {
  // This is an absolute mkdtemp path created above inside desktop, never user input.
  if (!stage.startsWith(path.join(root, 'desktop/.stage-'))) throw new Error('Unsafe staging path');
  await fs.rm(stage, { recursive: true, force: true });
}
