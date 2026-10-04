import { ARENAS, WEAPONS } from './engine.js';
import { BOT_DIFFICULTIES } from './bot-difficulty.js';
import { GAME_MODES } from './crown.js';

export const defaultMatchOptions = (difficulty = 'easy') => ({
  maps: ARENAS.map((_, i) => i), weapons: Object.keys(WEAPONS),
  mode: 'elimination',
  difficulty: Object.hasOwn(BOT_DIFFICULTIES, difficulty) ? difficulty : 'easy',
});
export const validMatchOptions = value => !!value &&
  Object.hasOwn(GAME_MODES, value.mode) &&
  Object.hasOwn(BOT_DIFFICULTIES, value.difficulty) &&
  Array.isArray(value.maps) && value.maps.length > 0 && value.maps.length <= ARENAS.length &&
  new Set(value.maps).size === value.maps.length &&
  value.maps.every(i => Number.isInteger(i) && i >= 0 && i < ARENAS.length) &&
  Array.isArray(value.weapons) && value.weapons.length > 0 && value.weapons.length <= Object.keys(WEAPONS).length &&
  new Set(value.weapons).size === value.weapons.length &&
  value.weapons.every(key => typeof key === 'string' && Object.hasOwn(WEAPONS, key));
export const copyMatchOptions = value => ({ maps: [...value.maps], weapons: [...value.weapons], difficulty: value.difficulty, mode: value.mode });

export function validLobbyState(message) {
  return validMatchOptions(message.options) && Number.isSafeInteger(message.revision) && message.revision >= 0 &&
    Array.isArray(message.ready) && message.ready.length <= 3 && new Set(message.ready).size === message.ready.length &&
    Array.isArray(message.players) &&
    message.ready.every(id => Number.isInteger(id) && id > 0 && id <= 3 && message.players.some(p => p?.id === id));
}
