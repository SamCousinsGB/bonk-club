import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { releaseMetadata } from './scripts/release-metadata.mjs';

export default defineConfig(({ mode }) => {
  const target = mode === 'desktop' ? 'steam' : 'browser';
  return {
    resolve: { alias: { '#bonk-platform': fileURLToPath(new URL(`./src/platform/${target}.js`, import.meta.url)) } },
    plugins: [{
      name: 'bonk-release-metadata', apply: 'build',
      async generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'build-metadata.json',
          source: JSON.stringify(await releaseMetadata(target), null, 2) + '\n' });
      },
    }],
  };
});
