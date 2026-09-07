export const SLOT_MODES = ["mixed", "ai", "player", "closed"];
export const SLOT_LABELS = {
  mixed: "AI/Player",
  ai: "AI only",
  player: "Player only",
  closed: "Closed",
};
export const defaultSlots = () => ["player", "mixed", "mixed", "mixed"];
export const validSlots = (slots) =>
  Array.isArray(slots) && slots.length === 4 && slots[0] === "player" &&
  slots.every((mode) => SLOT_MODES.includes(mode));
export const allowsPlayer = (mode) => mode === "mixed" || mode === "player";
export function activeSlots(slots, roster) {
  return slots.flatMap((mode, id) => {
    const human = roster.some((p) => p.id === id);
    if (mode === "closed" || (mode === "player" && !human)) return [];
    return [{ id, bot: mode === "ai" || !human }];
  });
}
