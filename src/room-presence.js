// Roster updates also carry profile and slot edits. Only human membership changes
// should make a sound; the first roster is the room's starting point.
export class RoomPresence {
  constructor() {
    this.reset();
  }
  reset() {
    this.room = null;
    this.players = new Map();
  }
  update(room, roster) {
    const players = new Map(roster.map(p => [p.id, { ...p }]));
    const changes = [];
    if (this.room === room) {
      for (const [id, player] of this.players)
        if (id !== room.id && !players.has(id))
          changes.push({ type: "leave", name: player.name });
      for (const [id, player] of players)
        if (id !== room.id && !this.players.has(id))
          changes.push({ type: "join", name: player.name });
    }
    this.room = room;
    this.players = players;
    return changes;
  }
}
