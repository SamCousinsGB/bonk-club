// Host-only ownership follows the original occupant through projectiles, fields
// and the finished singularity. None of these references enter snapshots.
const credits = new WeakMap();
export function trackKillSource(world, source, parent = null, replace = false) {
  if (replace) credits.delete(source);
  if (credits.has(source)) return source;
  const inherited = parent && credits.get(parent);
  const id = source.owner ?? parent?.owner;
  if (inherited) credits.set(source, inherited);
  else if (Number.isInteger(id) && world.players.some(p => p.id === id))
    credits.set(source, { id, occupant: world.occupants[id] });
  return source;
}
export function killCredit(world, source) {
  if (!source || typeof source !== "object") return null;
  if (world.players.includes(source)) return { id: source.id, occupant: world.occupants[source.id] };
  return credits.get(source) || null;
}
