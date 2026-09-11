import test from "node:test";
import assert from "node:assert/strict";
import { MenuMontage } from "../src/menu-montage.js";

test("menu montage presents every effect with no consecutive repeated cuts", () => {
  const montage = new MenuMontage(() => 0.37), seen = [montage.scene.kind];
  for (let tick = 0; tick < 18000; tick++) {
    const frame = montage.advance(1 / 60);
    assert.ok(frame.fade >= 0 && frame.fade <= 1);
    if (frame.take === seen.length) seen.push(frame.scene.kind);
  }
  assert.ok(seen.length > 35);
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1]);
  for (let i = 1; i + 6 <= seen.length; i += 6) assert.equal(new Set(seen.slice(i, i + 6)).size, 6);
});

test("reduced motion holds one visible skeleton frame without advancing the montage", () => {
  const montage = new MenuMontage();
  const still = montage.advance(1 / 60, true);
  for (let i = 0; i < 500; i++) assert.deepEqual(montage.advance(1, true), still);
  assert.equal(still.fade, 1);
  assert.equal(still.scene.kind, "tesla");
  assert.equal(montage.age, 0);
});

test("background delays and invalid frame times cannot skip the montage or poison its clock", () => {
  const montage = new MenuMontage();
  for (const dt of [NaN, Infinity, -1, undefined]) montage.advance(dt);
  assert.equal(montage.age, 0);
  montage.advance(600);
  assert.equal(montage.age, 0.05);
  assert.equal(montage.take, 0);
});
