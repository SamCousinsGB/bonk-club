import { cleanPreferences } from './preferences-data.js';

export async function loadPreferences({ storage, desktop = globalThis.bonkDesktop } = {}) {
  let value, warning;
  if (desktop) {
    try { ({ value, warning } = await desktop.loadPreferences()); }
    catch { warning = 'Saved settings are unavailable. Changes may not be saved.'; }
  } else {
    try {
      storage ??= globalThis.localStorage;
      const saved = storage.getItem('bonk-preferences');
      value = saved ? JSON.parse(saved) : {
        profile: JSON.parse(storage.getItem('bonk-profile')),
        difficulty: storage.getItem('bonk-difficulty'),
      };
    } catch { /* Browsers may disable storage. */ }
  }
  let state = cleanPreferences(value), queue = Promise.resolve();
  return {
    get value() { return state; }, warning,
    save(patch) {
      state = cleanPreferences({ ...state, ...patch });
      const snapshot = state;
      // Ordered saves prevent a slow earlier IPC write reverting newer edits.
      queue = queue.catch(() => {}).then(async () => {
        if (desktop) await desktop.savePreferences(snapshot);
        else storage.setItem('bonk-preferences', JSON.stringify(snapshot));
      });
      return queue;
    },
  };
}
