import { emptyInput } from "./engine.js";

const DEAD_ZONE = 12,
  SWIPE = 30,
  HOLD_MS = 120,
  DOUBLE_MS = 260;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Gesture recognition uses CSS pixels and a supplied clock, independent of frame rate.
export class TouchControls {
  constructor() {
    this.reset();
  }
  reset() {
    this.move = null;
    this.aim = null;
    this.blocks = new Set();
    this.lastAim = null;
    this.tap = null;
    this.pulses = { jump: [], attack: [], throw: [] };
  }
  pulse(action, now) {
    const queue = this.pulses[action];
    if (queue.length >= 8) return;
    const start = Math.max(now, (queue.at(-1)?.end ?? -50) + 50);
    queue.push({ start, end: start + 140 });
  }
  flushTap(now) {
    if (this.tap && now >= this.tap.due) {
      this.lastAim = this.tap.aim;
      this.pulse("attack", now);
      this.tap = null;
    }
  }
  down(zone, id, x, y, now) {
    this.flushTap(now);
    if (zone === "block") {
      this.tap = null;
      this.pulses.attack = [];
      this.blocks.add(id);
      return true;
    }
    if (!["move", "aim"].includes(zone) || this[zone]) return false;
    const second =
      zone === "aim" &&
      this.tap &&
      now < this.tap.due &&
      Math.hypot(x - this.tap.x, y - this.tap.y) < 60;
    if (zone === "aim" && this.tap) {
      if (!second) this.pulse("attack", now);
      this.tap = null;
    }
    this[zone] = {
      id,
      x,
      y,
      ox: x,
      oy: y,
      at: now,
      moved: false,
      jumped: false,
      second: !!second,
    };
    return true;
  }
  update(id, x, y, now) {
    const p =
      this.move?.id === id ? this.move : this.aim?.id === id ? this.aim : null;
    if (!p) return;
    p.x = x;
    p.y = y;
    const dx = x - p.ox,
      dy = y - p.oy;
    p.moved ||= Math.hypot(dx, dy) > DEAD_ZONE;
    if (p === this.move) {
      if (Math.abs(dx) > 64) p.ox = x - clamp(dx, -64, 64);
      if (dy > -12) p.jumped = false;
      if (dy < -SWIPE && !p.jumped) {
        this.pulse("jump", now);
        p.jumped = true;
      }
    } else if (Math.hypot(dx, dy) > DEAD_ZONE) {
      this.lastAim = Math.atan2(dy, dx);
      p.second = false;
      // Dragging explicitly aims and fires; an earlier tap must not fire after release.
      this.tap = null;
    }
  }
  up(id, now, cancelled = false) {
    this.blocks.delete(id);
    if (this.move?.id === id) {
      this.move = null;
      return;
    }
    if (this.aim?.id !== id) return;
    const p = this.aim;
    if (!cancelled && !p.moved && now - p.at < HOLD_MS) {
      if (p.second) {
        this.pulses.attack = [];
        this.pulse("throw", now);
      } else {
        this.tap = { x: p.x, y: p.y, due: now + DOUBLE_MS, aim: this.lastAim };
      }
    }
    if (cancelled) this.tap = null;
    this.aim = null;
  }
  read(now) {
    this.flushTap(now);
    const out = emptyInput(),
      p = this.move;
    if (p) {
      out.left = p.x - p.ox < -DEAD_ZONE;
      out.right = p.x - p.ox > DEAD_ZONE;
      out.duck = p.y - p.oy > SWIPE + 8;
    }
    out.aim = this.lastAim;
    out.block = this.blocks.size > 0;
    for (const [action, queue] of Object.entries(this.pulses)) {
      this.pulses[action] = queue.filter((p) => p.end > now);
      out[action] = this.pulses[action].some((p) => now >= p.start);
    }
    out.attack ||=
      !!this.aim && (this.aim.moved || now - this.aim.at >= HOLD_MS);
    if (out.throw || out.block) out.attack = false;
    return out;
  }
}

export function bindTouchZone(
  element,
  zone,
  controls,
  { enabled, wake, clock = () => performance.now() },
) {
  const down = (e) => {
    if (e.pointerType !== "touch" || !enabled()) return;
    wake();
    if (controls.down(zone, e.pointerId, e.clientX, e.clientY, clock()))
      element.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (e.pointerType !== "touch" || !enabled()) return;
    controls.update(e.pointerId, e.clientX, e.clientY, clock());
  };
  const up = (e) => {
    if (e.pointerType !== "touch") return;
    controls.up(e.pointerId, clock());
  };
  const cancel = (e) => controls.up(e.pointerId, clock(), true);
  const suppress = (e) => e.preventDefault();
  const handlers = {
    pointerdown: down,
    pointermove: move,
    pointerup: up,
    pointercancel: cancel,
    lostpointercapture: cancel,
    contextmenu: suppress,
  };
  for (const [type, fn] of Object.entries(handlers))
    element.addEventListener(type, fn, { passive: false });
  return () => {
    for (const [type, fn] of Object.entries(handlers))
      element.removeEventListener(type, fn);
  };
}

// Activate a menu button on a completed tap even after a cancelled game gesture.
// Some touch browsers omit the compatibility click; others send it as well.
export function bindTouchButtons(root, clock = () => performance.now()) {
  const pointers = new Map(),
    activated = new WeakMap();
  const buttonAt = (target) => target?.closest?.("button");
  const down = (e) => {
    if (e.pointerType !== "touch") return;
    const button = buttonAt(e.target);
    if (!button || button.disabled || button.id === "touch-block") return;
    pointers.set(e.pointerId, {
      button,
      x: e.clientX,
      y: e.clientY,
      at: clock(),
      moved: false,
    });
  };
  const move = (e) => {
    const p = pointers.get(e.pointerId);
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12) p.moved = true;
  };
  const up = (e) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (!p || p.moved || p.button.disabled || clock() - p.at > 700) return;
    if (buttonAt(root.elementFromPoint(e.clientX, e.clientY)) !== p.button)
      return;
    activated.set(p.button, clock());
    p.button.click();
  };
  const cancel = (e) => pointers.delete(e.pointerId);
  const click = (e) => {
    const button = buttonAt(e.target),
      at = button && activated.get(button);
    if (
      e.isTrusted &&
      e.detail !== 0 &&
      e.pointerType !== "mouse" &&
      at !== undefined &&
      clock() - at < 700
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  const handlers = {
    pointerdown: down,
    pointermove: move,
    pointerup: up,
    pointercancel: cancel,
    click,
  };
  for (const [type, fn] of Object.entries(handlers))
    root.addEventListener(type, fn, true);
  return () => {
    for (const [type, fn] of Object.entries(handlers))
      root.removeEventListener(type, fn, true);
  };
}
