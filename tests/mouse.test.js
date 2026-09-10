import test from "node:test";
import assert from "node:assert/strict";
import { bindMouseControls } from "../src/mouse.js";

function setup() {
  class Surface extends EventTarget {
    captured = null;
    setPointerCapture(id) { this.captured = id; }
    hasPointerCapture(id) { return this.captured === id; }
    releasePointerCapture() { this.captured = null; }
  }
  const canvas = new Surface(), root = new EventTarget();
  const state = { attack: false, block: false };
  const context = { enabled: true, wakes: 0, point: null };
  const controls = bindMouseControls(canvas, state, {
    root,
    enabled: () => context.enabled,
    wake: () => context.wakes++,
    aim: (e) => { context.point = [e.clientX, e.clientY]; },
  });
  const event = (type, buttons, options = {}, target = canvas) => {
    const make = () => Object.assign(new Event(type, { cancelable: true }), {
      pointerType: "mouse", pointerId: 1, buttons, button: -1,
      clientX: 420, clientY: 250, ...options,
    });
    target.dispatchEvent(make());
    // EventTarget has no DOM bubbling; reproduce the canvas-to-window path.
    if (target === canvas) root.dispatchEvent(make());
  };
  const held = (attack, block) => assert.deepEqual(state, { attack, block });
  return { canvas, root, state, context, controls, event, held };
}

for (const first of [1, 2]) {
  for (const remaining of [1, 2]) {
    test(`overlapping mouse buttons: first ${first}, remaining ${remaining}`, () => {
      const { event, held } = setup();
      event("pointerdown", first, { button: first === 1 ? 0 : 2 });
      held(first === 1, first === 2);
      event("pointermove", 3, { button: first === 1 ? 2 : 0 });
      held(true, true);
      event("pointermove", remaining, { button: remaining === 1 ? 2 : 0 });
      held(remaining === 1, remaining === 2);
      event("pointerup", 0, { button: remaining === 1 ? 0 : 2 });
      held(false, false);
    });
  }
}

test("middle-button chords never hold combat after left/right release", () => {
  const { event, held } = setup();
  event("pointerdown", 4, { button: 1 });
  held(false, false);
  event("pointermove", 7, { button: 0 });
  held(true, true);
  event("pointermove", 4, { button: 2 });
  held(false, false);
  event("pointerup", 0, { button: 1 });
  held(false, false);
});

test("release outside the canvas and a missed release clear held buttons", () => {
  const { event, root, held } = setup();
  event("pointerdown", 3);
  event("pointermove", 2, {}, root);
  held(false, true);
  event("pointerup", 0, {}, root);
  held(false, false);
  event("pointerdown", 1);
  event("pointermove", 0);
  held(false, false);
});

for (const reason of ["pointercancel", "lostpointercapture", "blur", "reset"]) {
  test(`${reason} clears both buttons and requires a fresh press`, () => {
    const { event, root, held, canvas, controls } = setup();
    event("pointerdown", 3);
    if (reason === "reset") controls.reset();
    else if (reason === "blur") root.dispatchEvent(new Event("blur"));
    else event(reason, 3);
    held(false, false);
    assert.equal(canvas.captured, null);
    event("pointermove", 3);
    held(false, false);
    event("pointerup", 0);
    event("pointerdown", 1);
    held(true, false);
  });
}

test("disabled controls ignore menu clicks and cannot resume a cancelled hold", () => {
  const { event, held, context, controls } = setup();
  context.enabled = false;
  event("pointerdown", 1);
  context.enabled = true;
  event("pointermove", 1);
  held(false, false);
  assert.equal(context.wakes, 0);
  event("pointerdown", 3);
  context.enabled = false;
  event("pointermove", 3);
  held(false, false);
  context.enabled = true;
  event("pointermove", 3);
  held(false, false);
  controls.reset();
});

test("touch and unrelated pen pointers cannot alter the held mouse buttons", () => {
  const { event, held } = setup();
  event("pointerdown", 1);
  event("pointerup", 0, { pointerType: "touch" });
  event("pointercancel", 0, { pointerType: "touch" });
  event("pointermove", 0, { pointerType: "pen", pointerId: 7 });
  held(true, false);
  event("pointerup", 0);
  event("pointerdown", 1, { pointerType: "touch" });
  held(false, false);
});

test("press updates aim immediately and capture failure still allows release", () => {
  const { canvas, root, event, held, context } = setup();
  canvas.setPointerCapture = () => { throw new Error("Capture unavailable"); };
  event("pointerdown", 2);
  assert.deepEqual(context.point, [420, 250]);
  assert.equal(context.wakes, 1);
  held(false, true);
  event("pointerup", 0, {}, root);
  held(false, false);
});

test("disposing the binding clears controls and removes listeners", () => {
  const { event, controls, context, held } = setup();
  event("pointerdown", 1);
  controls.dispose();
  held(false, false);
  event("pointerdown", 3);
  event("pointermove", 3);
  held(false, false);
  assert.equal(context.wakes, 1);
});
