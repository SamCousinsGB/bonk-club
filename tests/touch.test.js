import test from "node:test";
import assert from "node:assert/strict";
import {
  TouchControls,
  bindTouchZone,
  bindTouchButtons,
} from "../src/touch.js";
import { World, STEP, W, H, emptyInput, cleanInput } from "../src/engine.js";
import { gameViewport, screenToWorld } from "../src/viewport.js";

test("dragging moves immediately, reverses direction, and stops on release", () => {
  const t = new TouchControls();
  t.down("move", 1, 100, 300, 0);
  t.update(1, 130, 300, 10);
  assert.equal(t.read(10).right, true);
  t.update(1, 80, 300, 20);
  assert.equal(t.read(20).left, true);
  assert.equal(t.read(20).right, false);
  t.up(1, 30);
  assert.equal(t.read(30).left, false);
});

test("small finger jitter does not move, aim or jump", () => {
  const t = new TouchControls();
  t.down("move", 1, 100, 300, 0);
  t.down("aim", 2, 300, 300, 0);
  t.update(1, 106, 294, 10);
  t.update(2, 307, 299, 10);
  const input = t.read(20);
  assert.equal(input.left || input.right || input.jump || input.attack, false);
  assert.equal(input.aim, null);
});

test("a long upward swipe produces only one jump, another stroke produces the air jump", () => {
  const t = new TouchControls();
  t.down("move", 1, 100, 300, 0);
  t.update(1, 100, 265, 10);
  t.update(1, 100, 190, 20);
  assert.equal(t.pulses.jump.length, 1);
  assert.equal(t.read(30).jump, true);
  assert.equal(t.read(160).jump, false);
  t.update(1, 100, 295, 170);
  t.update(1, 100, 250, 200);
  assert.equal(t.read(210).jump, true);
});

test("downward drag holds prone and release stands up", () => {
  const t = new TouchControls();
  t.down("move", 1, 100, 300, 0);
  t.update(1, 140, 350, 20);
  assert.equal(t.read(20).duck, true);
  assert.equal(t.read(20).right, true);
  t.up(1, 80);
  assert.equal(t.read(80).duck, false);
});

test("two thumbs move and aim independently, including crossing the screen midpoint", () => {
  const t = new TouchControls();
  t.down("move", 11, 80, 300, 0);
  t.down("aim", 12, 320, 300, 0);
  t.update(11, 350, 300, 30);
  t.update(12, 280, 260, 30);
  assert.equal(t.read(30).right, true);
  assert.equal(t.read(30).attack, true);
  assert.ok(Math.abs(t.read(30).aim + Math.PI * 0.75) < 0.001);
  t.up(12, 50);
  assert.equal(t.read(50).right, true);
  assert.equal(t.read(50).attack, false);
});

test("holding the right side fires continuously without repeated tapping", () => {
  const t = new TouchControls();
  t.down("aim", 1, 300, 300, 0);
  assert.equal(t.read(50).attack, false);
  assert.equal(t.read(125).attack, true);
  assert.equal(t.read(1000).attack, true);
  t.up(1, 1100);
  assert.equal(t.read(1100).attack, false);
});

test("a quick tap attacks after the double-tap window and survives slow polling", () => {
  const t = new TouchControls();
  t.down("aim", 1, 300, 300, 0);
  t.up(1, 50);
  assert.equal(t.read(200).attack, false);
  assert.equal(t.read(700).attack, true);
  assert.equal(t.read(850).attack, false);
});

test("double tap throws once without an attack, and holding the second tap instead fires", () => {
  const t = new TouchControls();
  t.down("aim", 1, 300, 300, 0);
  t.up(1, 50);
  t.down("aim", 2, 306, 303, 140);
  t.up(2, 185);
  for (const now of [185, 220, 300, 350, 600])
    assert.equal(t.read(now).attack, false);
  // Use a fresh recognizer for a monotonic clock check of the throw pulse.
  const u = new TouchControls();
  u.down("aim", 1, 300, 300, 0);
  u.up(1, 40);
  u.down("aim", 2, 300, 300, 100);
  u.up(2, 150);
  assert.equal(u.read(160).throw, true);
  assert.equal(u.read(310).throw, false);
  u.down("aim", 3, 300, 300, 500);
  u.up(3, 530);
  u.down("aim", 4, 300, 300, 600);
  assert.equal(u.read(750).attack, true);
  u.up(4, 800);
  assert.equal(u.read(800).throw, false);
});

test("block overrides firing and cancellation releases only the affected finger", () => {
  const t = new TouchControls();
  t.down("move", 1, 80, 300, 0);
  t.update(1, 110, 300, 10);
  t.down("aim", 2, 300, 300, 0);
  t.down("block", 3, 380, 190, 150);
  assert.equal(t.read(160).block, true);
  assert.equal(t.read(160).attack, false);
  t.up(3, 170, true);
  assert.equal(t.read(180).attack, true);
  t.up(2, 200, true);
  assert.equal(t.read(200).attack, false);
  assert.equal(t.read(200).right, true);
  t.up(1, 210, true);
  assert.equal(t.read(210).right, false);
});

test("pause, orientation changes and losing focus clear gestures and queued actions", () => {
  const t = new TouchControls();
  t.down("move", 1, 80, 300, 0);
  t.update(1, 120, 250, 10);
  t.down("aim", 2, 300, 300, 0);
  t.up(2, 20);
  t.down("block", 3, 0, 0, 25);
  t.reset();
  assert.deepEqual(t.read(500), emptyInput());
});

test("another finger cannot steal a thumb area", () => {
  const t = new TouchControls();
  assert.equal(t.down("move", 1, 80, 300, 0), true);
  assert.equal(t.down("move", 2, 100, 300, 10), false);
  t.update(2, 150, 300, 20);
  t.up(2, 25);
  assert.equal(t.move.id, 1);
  assert.equal(t.read(25).right, false);
});

test("touch inputs drive the real movement, two jumps and weapon throw without consuming ammo", () => {
  const w = new World({ arena: 0, shuffle: false });
  w.phase = "fight";
  w.weaponTimer = 999;
  const p = w.players[0];
  Object.assign(p, { x: 600, y: 535, ground: true, weapon: "rocket", ammo: 1 });
  w.players[1].x = 1000;
  const t = new TouchControls();
  t.down("move", 1, 80, 300, 0);
  t.update(1, 130, 260, 1);
  for (let n = 1; n < 20; n++)
    w.step(STEP, { 0: cleanInput(t.read(n * STEP * 1000)) });
  assert.ok(p.x > 600);
  assert.ok(p.y < 535);
  assert.equal(p.jumps, 1);
  t.update(1, 130, 300, 180);
  t.update(1, 130, 250, 200);
  for (let n = 24; n < 30; n++) w.step(STEP, { 0: t.read(n * STEP * 1000) });
  assert.equal(p.jumps, 2);
  t.down("aim", 2, 300, 300, 260);
  t.up(2, 290);
  t.down("aim", 3, 300, 300, 340);
  t.up(3, 375);
  w.step(STEP, { 0: t.read(380) });
  assert.equal(p.weapon, null);
  assert.equal(w.drops[0].ammo, 1);
  assert.equal(w.projectiles.length, 0);
});

test("captured pointers isolate gestures and cancellation cannot create a tap", () => {
  class Surface extends EventTarget {
    setPointerCapture(id) {
      this.captured = id;
    }
  }
  const el = new Surface(),
    t = new TouchControls();
  let now = 0,
    wake = 0,
    enabled = true;
  const dispose = bindTouchZone(el, "aim", t, {
    enabled: () => enabled,
    wake: () => wake++,
    clock: () => now,
  });
  const event = (type, id = 1) => {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, {
      pointerType: "touch",
      pointerId: id,
      clientX: 300,
      clientY: 300,
    });
    el.dispatchEvent(e);
    return e;
  };
  event("pointerdown");
  assert.equal(el.captured, 1);
  assert.equal(wake, 1);
  now = 25;
  event("pointercancel");
  assert.equal(t.read(500).attack, false);
  enabled = false;
  event("pointerdown", 2);
  assert.equal(wake, 1);
  assert.equal(t.aim, null);
  dispose();
  enabled = true;
  event("pointerdown", 3);
  assert.equal(t.aim, null);
});

for (const [width, height] of [
  [320, 358],
  [390, 608],
  [430, 652],
  [768, 744],
]) {
  test(`portrait camera keeps the player visible and maps touch coordinates at ${width}x${height}`, () => {
    for (const focus of [0, 200, 640, 1080, 1280]) {
      const view = gameViewport(width, height, focus, true);
      assert.ok(Math.abs(view.height - H) < 0.001);
      assert.ok(view.left >= 0 && view.left + view.width <= W + 0.001);
      assert.ok(focus >= view.left && focus <= view.left + view.width);
      const point = screenToWorld(
        width / 2 + 12,
        height / 2 + 20,
        { left: 12, top: 20 },
        view,
      );
      assert.ok(Math.abs(point.x - (view.left + view.width / 2)) < 0.001);
      assert.ok(Math.abs(point.y - H / 2) < 0.001);
    }
  });
}
test("landscape contains the entire arena and mouse coordinates respect letterboxing", () => {
  const view = gameViewport(844, 390);
  assert.equal(view.width, W);
  assert.ok(Math.abs(view.height - H) < 0.001);
  const point = screenToWorld(422, 195, { left: 0, top: 0 }, view);
  assert.ok(Math.abs(point.x - W / 2) < 0.001);
  assert.ok(Math.abs(point.y - H / 2) < 0.001);
});

test("menu touch releases activate once and ignore a delayed native click", () => {
  const listeners = {},
    button = {
      id: "pause",
      disabled: false,
      clicks: 0,
      closest: () => button,
      click() {
        this.clicks++;
      },
    };
  const root = {
    addEventListener: (t, f) => (listeners[t] = f),
    removeEventListener: (t) => delete listeners[t],
    elementFromPoint: () => button,
  };
  let now = 0;
  const dispose = bindTouchButtons(root, () => now);
  const pointer = {
    pointerType: "touch",
    pointerId: 1,
    target: button,
    clientX: 30,
    clientY: 20,
  };
  listeners.pointerdown(pointer);
  now = 50;
  listeners.pointerup(pointer);
  assert.equal(button.clicks, 1);
  let prevented = false,
    stopped = false;
  listeners.click({
    target: button,
    pointerType: "touch",
    isTrusted: true,
    detail: 1,
    preventDefault: () => (prevented = true),
    stopImmediatePropagation: () => (stopped = true),
  });
  assert.equal(prevented && stopped, true);
  prevented = false;
  listeners.click({
    target: button,
    pointerType: "mouse",
    isTrusted: true,
    detail: 1,
    preventDefault: () => (prevented = true),
  });
  assert.equal(prevented, false);
  dispose();
  assert.equal(Object.keys(listeners).length, 0);
});

test("scrolling off a menu button, cancellation, and the block button do not click", () => {
  const listeners = {},
    button = {
      id: "resume",
      disabled: false,
      clicks: 0,
      closest: () => button,
      click() {
        this.clicks++;
      },
    };
  const root = {
    addEventListener: (t, f) => (listeners[t] = f),
    elementFromPoint: () => button,
  };
  bindTouchButtons(root, () => 100);
  const pointer = {
    pointerType: "touch",
    pointerId: 1,
    target: button,
    clientX: 30,
    clientY: 20,
  };
  listeners.pointerdown(pointer);
  listeners.pointermove({ ...pointer, clientY: 100 });
  listeners.pointerup(pointer);
  listeners.pointerdown(pointer);
  listeners.pointercancel(pointer);
  listeners.pointerup(pointer);
  button.id = "touch-block";
  listeners.pointerdown(pointer);
  listeners.pointerup(pointer);
  assert.equal(button.clicks, 0);
});
