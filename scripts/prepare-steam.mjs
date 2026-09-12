import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')));
const ids = ['app-id', 'windows-depot', 'linux-depot'].map(key => args[key]);
if (ids.some(id => !/^[1-9]\d{2,9}$/.test(id || '') || id === '480') || new Set(ids).size !== 3)
  throw new Error('Supply your real, distinct --app-id=ID --windows-depot=ID --linux-depot=ID. No Steamworks IDs are configured yet.');
const content = path.resolve(args.content || path.join(root, 'release'));
const output = path.resolve(args.output || path.join(root, 'steam-build'));
const manifests = [];
for (const platform of ['win32', 'linux']) {
  const directory = path.join(content, `BonkClub-${platform}-x64`);
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'build-manifest.json'), 'utf8'));
  if (manifest.transport !== 'steam' || manifest.steamAppId !== Number(ids[0]))
    throw new Error('Build both Steam depots with STEAM_APP_ID matching the requested app.');
  if (!/^[a-f0-9]{64}$/.test(manifest.gameSourceHash)) throw new Error('Missing shared game source hash.');
  if (manifest.dirty || manifest.platform !== platform || manifest.arch !== 'x64' || !/^[a-f0-9]{40}$/.test(manifest.revision))
    throw new Error('Steam depots require clean, matching release builds.');
  const files = new Set();
  async function verify(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name), relative = path.relative(directory, file).split(path.sep).join('/');
      if (entry.isDirectory()) await verify(file);
      else if (entry.isFile() && relative !== 'build-manifest.json') {
        if (/steam_appid\.txt$|\.env|\.pdb$|\.log$|\.map$/i.test(relative)) throw new Error(`Excluded file in depot: ${relative}`);
        const hash = createHash('sha256').update(await fs.readFile(file)).digest('hex');
        if (manifest.hashes[relative] !== hash) throw new Error(`Modified/untracked depot file: ${relative}`);
        files.add(relative);
      } else if (!entry.isFile()) throw new Error(`Unsupported depot entry: ${relative}`);
    }
  }
  await verify(directory);
  if (files.size !== Object.keys(manifest.hashes).length || !files.has(platform === 'win32' ? 'BonkClub.exe' : 'BonkClub') || !files.has('resources/app.asar'))
    throw new Error('Incomplete depot.');
  manifests.push(manifest);
}
if (manifests[0].version !== manifests[1].version || manifests[0].revision !== manifests[1].revision)
  throw new Error('Windows and Linux depots must have the same version and source revision.');
if (manifests[0].gameSourceHash !== manifests[1].gameSourceHash) throw new Error('Windows and Linux depots must contain the same shared game source.');
const quote = value => '"' + String(value).replaceAll('\\', '/').replaceAll('"', '') + '"';
await fs.mkdir(output, { recursive: true });
for (const [index, platform] of ['win32', 'linux'].entries()) {
  const id = ids[index + 1];
  await fs.writeFile(path.join(output, `depot_${id}.vdf`), `"DepotBuildConfig"\n{\n  "DepotID" "${id}"\n  "ContentRoot" ${quote(path.join(content, `BonkClub-${platform}-x64`))}\n  "FileMapping"\n  {\n    "LocalPath" "*"\n    "DepotPath" "."\n    "recursive" "1"\n  }\n  "FileExclusion" "build-manifest.json"\n}\n`);
}
await fs.writeFile(path.join(output, `app_${ids[0]}.vdf`), `"AppBuild"\n{\n  "AppID" "${ids[0]}"\n  "Desc" "Bonk Club ${manifests[0].version} ${manifests[0].revision}"\n  "BuildOutput" ${quote(path.join(output, 'cache'))}\n  "Preview" "${args.upload === 'true' ? '0' : '1'}"\n  "Depots"\n  {\n    "${ids[1]}" "depot_${ids[1]}.vdf"\n    "${ids[2]}" "depot_${ids[2]}.vdf"\n  }\n}\n`);
console.log(`SteamPipe scripts written to ${output}. ${args.upload === 'true' ? 'Upload configuration only; no upload performed.' : 'Preview only; no upload or release.'}`);
