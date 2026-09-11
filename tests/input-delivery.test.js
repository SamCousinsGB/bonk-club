import test from "node:test";
import assert from "node:assert/strict";
import { InputDelivery } from "../src/input-delivery.js";
import { cleanInput } from "../src/engine.js";

test("a lost short tap reaches the host once via the next released input", () => {
  for (const key of ["jump", "attack", "block", "throw"]) {
    const guest = new InputDelivery(), host = new InputDelivery();
    guest.capture(cleanInput({ [key]: true }), 1); // lost
    host.receive(guest.capture(cleanInput({}), 2), 2);
    assert.equal(host.sample(cleanInput({}))[key], true);
    assert.equal(host.sample(cleanInput({}))[key], false);
    host.receive(guest.capture(cleanInput({}), 3), 3);
    assert.equal(host.sample(cleanInput({}))[key], false);
  }
});
test("held buttons never repeat edges, distinct taps get release ticks and stale controls clear", () => {
  const guest = new InputDelivery(), host = new InputDelivery(), held = cleanInput({ jump: true });
  host.receive(guest.capture(held, 1), 1);
  for (let i = 0; i < 10; i++) assert.equal(host.sample(held).jump, true);
  guest.capture(cleanInput({}), 2);
  host.receive(guest.capture(held, 3), 3);
  assert.equal(host.sample(held).jump, false); assert.equal(host.sample(held).jump, true);
  host.receive([NaN, 500, -1, {}], 4);
  assert.deepEqual(host.edges, [3, 0, 0, 0]);
  assert.equal(host.sample(cleanInput({}), true).jump, false);
});
