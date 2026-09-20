import test from "node:test";
import assert from "node:assert/strict";
import { World, STEP, ARENAS } from "../src/engine.js";
import { validSnapshot } from "../src/network.js";

const shardTotal = integerEnv("ARENA_SHARD_TOTAL", 1);
const shardIndex = integerEnv("ARENA_SHARD_INDEX", 0);

if (shardTotal < 1 || shardIndex < 0 || shardIndex >= shardTotal) {
  throw new Error("ARENA_SHARD_INDEX must identify a valid ARENA_SHARD_TOTAL shard");
}

function integerEnv(name, fallback) {
  if (process.env[name] === undefined) return fallback;
  const value = Number(process.env[name]);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
}

function assigned(arena) {
  return arena % shardTotal === shardIndex;
}

for (let arena = 0; arena < ARENAS.length; arena++) {
  if (!assigned(arena)) continue;
  const name = ARENAS[arena].name;

  test(`four AI fighters fight and complete a round: ${name}`, () => {
    let seed = 4781 + arena;
    const random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const w = new World({
      players: [0, 1, 2, 3],
      bots: [0, 1, 2, 3],
      arena,
      shuffle: false,
      random,
    });
    let combat = false;
    // Random container layouts can let machinery settle the opening round.
    // Check sustained play within the same time budget, including the next round.
    for (let n = 0; n < 120 * 150 && (w.round === 1 || !combat); n++) {
      w.step(STEP);
      combat ||= w.events.some(event => event.type === "shoot" || event.type === "swing");
      if (n % 120 === 0) {
        assert.ok(validSnapshot(w.snapshot()), name);
      }
    }
    assert.ok(combat, `${name} must have AI combat`);
    assert.ok(w.round > 1, `${name} must keep playing`);
  });

  test(`seeded four-player combat stays finite: ${name}`, () => {
    let seed = 7;
    const random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const w = new World({
      players: [0, 1, 2, 3],
      arena,
      random,
      shuffle: false,
    });
    let inputs = {};
    for (let n = 0; n < 7200; n++) {
      if (n % 24 === 0) {
        inputs = Object.fromEntries(
          w.ids.map((id) => [
            id,
            {
              left: random() < 0.45,
              right: random() < 0.45,
              attack: random() < 0.8,
              block: random() < 0.25,
              jump: random() < 0.5,
              throw: random() < 0.5,
            },
          ]),
        );
      }
      w.step(STEP, inputs);
      for (const player of w.players) {
        assert.ok(
          [player.x, player.y, player.vx, player.vy, player.hp].every(
            Number.isFinite,
          ),
        );
      }
      assert.ok(w.drops.length < 15);
      assert.ok(w.projectiles.length < 100);
    }
  });
}
