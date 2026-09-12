import { Room, validCode } from '../network.js';
import { createProgressionClient } from '../progression.js';

export { validCode };
export const network = Object.freeze({ transport: 'webrtc', available: true, reason: null });
export const createRoom = (callbacks, options) => new Room(callbacks, undefined, options);
export const progression = createProgressionClient();
