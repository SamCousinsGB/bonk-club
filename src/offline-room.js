import { RoomSession } from './room-session.js';

// Use the same lobby and host rules when the platform has no online transport.
// An offline identifier is deliberately not a valid shareable invite code.
export function createOfflineRoom(callbacks, options, reason) {
  const room = new RoomSession(callbacks, options);
  room.host = true; room.id = 0; room.offline = true;
  room.code = 'OFFLINE'; room.offlineReason = reason;
  room.roster = [{ id: 0, ...room.profile }];
  return room;
}
