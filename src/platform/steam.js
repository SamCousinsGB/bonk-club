// Selected at build time. Never import the browser transport here: a missing
// Steam integration must not silently create a room through the household Pi.
import { createProgressionClient } from '../progression.js';
export const progression = createProgressionClient();
export const validCode = () => false;
export const network = Object.freeze({
  transport: 'steam', available: false,
  reason: 'Steam online play is not configured in this build. You can play against bots.',
});
export function createRoom() {
  throw Object.assign(new Error(network.reason), { code: 'steam-not-configured' });
}
