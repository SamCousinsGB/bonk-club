import fs from 'node:fs';
import path from 'node:path';
import { cleanPreferences } from '../src/preferences-data.js';

// One bounded JSON file, atomically replaced. Never upload Chromium storage,
// relay credentials, diagnostics or machine-specific window state to Cloud.
export class PreferenceStore {
  constructor(directory) {
    fs.mkdirSync(directory, { recursive: true });
    this.file = path.join(directory, 'preferences.json');
    this.value = cleanPreferences();
    this.warning = null;
    try {
      if (fs.statSync(this.file).size > 16384) throw new Error('Oversized preferences');
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (parsed.schema !== 1) throw new Error('Unsupported preferences');
      this.value = cleanPreferences(parsed);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        // Preserve the original for recovery, rather than overwriting it.
        fs.copyFileSync(this.file, this.file + '.recovery-' + Date.now());
        this.warning = 'Saved settings could not be read. A recovery copy was kept.';
      }
    }
  }
  save(value) {
    if (!value || JSON.stringify(value).length > 16384) throw new Error('Invalid preferences');
    const cleaned = cleanPreferences(value), temp = this.file + '.tmp';
    const fd = fs.openSync(temp, 'w', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(cleaned, null, 2) + '\n'); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    fs.renameSync(temp, this.file);
    this.value = cleaned;
    return cleaned;
  }
}
