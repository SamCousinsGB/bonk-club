// Only these identifiers cross the wire; clients render the same local copy.
export const VICTORY_MESSAGES = Object.freeze({
  turbine: "By blending the opposition",
  bubble: "By bursting the opposition's bubble",
  gas: "By ignoring the hissing canister",
  electrified: "By completing the circuit",
  gold: "By turning the opposition into gold",
  jelly: "By turning the opposition into jelly",
  tangle: "By tying the opposition in knots",
  nuke: "By nuclear apocalypse",
  singularity: "By commanding the forces of space and time",
  phaser: "By deleting the opposition from existence",
  burn: "By turning up the heat",
  ice: "By shattering the competition",
  plasma: "By reducing the opposition to atoms",
  tesla: "By delivering a shocking finale",
  saw: "By cutting the competition in half",
  railgun: "By settling it with one shot",
  sword: "By putting the opposition to the sword",
  bat: "By knocking it out of the park",
  punch: "By letting their fists do the talking",
  kick: "By putting their foot down",
  spin: "By going out with a spin",
  shotgun: "By making it a close-range conversation",
  bullet: "By superior firepower",
  blast: "By ending with a bang",
  thrown: "By throwing the whole weapon at the problem",
  impale: "By leaving the competition on a spike",
  crusher: "By crushing the competition",
  pendulum: "By letting the wrecking ball decide",
  props: "By bringing the furniture into it",
  fall: "By trusting gravity to finish the job",
  sudden: "By outlasting sudden death",
  slice: "By cutting the opposition down to size",
});

export const validVictoryCause = (cause) =>
  cause === null || (typeof cause === "string" && Object.hasOwn(VICTORY_MESSAGES, cause));

export function hitCause(options) {
  // Shattering an already frozen fighter is the visible finish, whatever hit it.
  if (options.effect === "ice") return "ice";
  if (options.cause && validVictoryCause(options.cause)) return options.cause;
  if (["saw", "railgun", "sword", "bat", "shotgun"].includes(options.weapon))
    return options.weapon;
  if (options.effect && validVictoryCause(options.effect)) return options.effect;
  if (options.melee && options.weapon === "hammer") return "crusher";
  if (options.melee) return ["punch", "kick", "spin"].includes(options.move) ? options.move : "punch";
  if (options.blast) return "blast";
  if (options.projectile) return "bullet";
  return null;
}

export function victoryMessage(state, name) {
  if (state.winner === null) return { title: "DRAW", detail: "" };
  return {
    title: `${name.toUpperCase()} WON`,
    detail: validVictoryCause(state.victoryCause) ? VICTORY_MESSAGES[state.victoryCause] || "" : "",
  };
}
