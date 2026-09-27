import { cleanProfile } from './identity.js';
import { cleanDifficulty } from './bot-difficulty.js';

export function cleanPreferences(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  return {
    schema: 1,
    profile: cleanProfile(value.profile, { name: 'Player', color: '#55baff', hair: 'None' }),
    difficulty: cleanDifficulty(value.difficulty),
    arena: 'random',
    muted: value.muted === true,
    reducedMotion: typeof value.reducedMotion === 'boolean' ? value.reducedMotion : null,
  };
}
