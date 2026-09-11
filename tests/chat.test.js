import test from "node:test";
import assert from "node:assert/strict";
import { FighterChat, cleanChat, validChat, CHAT_LIFETIME, ChatComposer } from "../src/chat.js";
import { chatLines, drawChat } from "../src/chat-art.js";

test("chat normalizes plain text, bounds length and preserves emoji and literal markup", () => {
  assert.equal(cleanChat("  hello\n\tthere\u202e  "), "hello there");
  assert.equal(cleanChat("<img onerror=alert(1)> 🙂"), "<img onerror=alert(1)> 🙂");
  assert.equal(cleanChat("a".repeat(119) + "🙂"), "a".repeat(119));
  for (const value of [null, {}, 5, "\u0000\u202e "]) assert.equal(cleanChat(value), "");
});
test("speech replaces only its speaker, rate limits and expires by wall clock", () => {
  let now = 0; const chat = new FighterChat(() => now); chat.setRound(1);
  assert.ok(chat.publish(0, "one")); assert.equal(chat.publish(0, "spam"), null);
  chat.publish(1, "two"); now = 1000; chat.publish(0, "replacement");
  assert.deepEqual(chat.snapshot().map(m => m.text), ["replacement", "two"]);
  now = 4000; assert.deepEqual(chat.snapshot().map(m => m.text), ["replacement"]);
  now = 5000; assert.deepEqual(chat.snapshot(), []);
});
test("hot join carries only remaining lifetime; new rounds and occupants clear speech", () => {
  let now = 0; const host = new FighterChat(() => now), guest = new FighterChat(() => now);
  host.setRound(3); host.publish(1, "hello"); now = 3200;
  guest.receive(host.snapshot()[0]); assert.equal(guest.snapshot()[0].life, 800);
  now = 4000; assert.equal(guest.snapshot().length, 0);
  const old = host.publish(1, "round three");
  host.setRound(4); assert.equal(host.snapshot().length, 0);
  assert.equal(host.receive(old), false);
  host.setRound(3); assert.equal(host.round, 4, "older physics frames cannot erase newer speech");
  host.retain([0]); assert.ok(host.publish(1, "new occupant"));
  host.retain([0]); assert.equal(host.snapshot().length, 0);
  host.reset(); assert.equal(host.round, null); assert.equal(host.cooldowns.size, 0);
});
test("malformed wire speech is rejected without changing current messages", () => {
  const message = { id: 1, text: "hello", round: 1, life: CHAT_LIFETIME };
  const chat = new FighterChat(() => 0); assert.ok(chat.receive(message));
  for (const patch of [{ id: -1 }, { id: 4 }, { round: 0 }, { round: Infinity },
    { text: "" }, { text: {} }, { text: "x".repeat(121) }, { text: "hi\nthere" },
    { life: Infinity }, { life: -1 }, { life: 4001 }]) {
    assert.equal(validChat({ ...message, ...patch }), false);
    assert.equal(chat.receive({ ...message, ...patch }), false);
  }
  assert.equal(chat.snapshot()[0].text, "hello");
});
test("chat wrapping handles sentences and long unbroken words", () => {
  const context = { measureText: text => ({ width: [...text].length * 10 }) };
  assert.deepEqual(chatLines(context, "hello there friend", 110), ["hello there", "friend"]);
  const lines = chatLines(context, "🙂".repeat(40), 110);
  assert.equal(lines.join(""), "🙂".repeat(40));
  assert.ok(lines.every(line => context.measureText(line).width <= 110));
});
test("speech follows the physical head and is drawn as literal text", () => {
  const drawn = [], boxes = [];
  const context = new Proxy({ measureText: text => ({ width: text.length * 10 }),
    roundRect: (...args) => boxes.push(args), fillText: text => drawn.push(text) },
    { get: (object, key) => key in object ? object[key] : () => {} });
  const p = { id: 1, bot: false, alive: true, x: 400, y: 900, rig: [{ x: 550, y: 860 }] };
  drawChat(context, { players: [p], round: 1 }, [{ id: 1, round: 1, text: "<hello>", life: 3000 }]);
  assert.deepEqual(drawn, ["<hello>"]); assert.equal(boxes[0][0] + boxes[0][2] / 2, 550);
  assert.ok(boxes[0][1] + boxes[0][3] < 860);
});
test("Enter opens/sends, Escape cancels, IME and repeated Enter never send", () => {
  const listeners = {}, sent = []; let clears = 0, enabled = true;
  const input = { value: "", addEventListener: (name, fn) => { listeners[name] = fn; }, focus() {}, blur() {} };
  const form = { querySelector: () => input, classList: { add() {}, remove() {} }, addEventListener() {} };
  const composer = new ChatComposer(form, { enabled: () => enabled, clearInput: () => clears++, send: text => { sent.push(text); return true; } });
  const key = (key, extra = {}) => composer.handleKey({ key, preventDefault() {}, target: {}, ...extra });
  assert.equal(key("Enter", { target: { tagName: "INPUT" } }), false);
  key("Enter"); assert.ok(composer.isOpen); assert.equal(clears, 1);
  input.value = "hello"; key("Enter", { repeat: true }); key("Enter", { isComposing: true });
  assert.deepEqual(sent, []); key("w"); assert.ok(composer.isOpen);
  key("Enter"); assert.deepEqual(sent, ["hello"]); assert.equal(composer.isOpen, false);
  key("Enter"); input.value = "cancel"; key("Escape"); assert.deepEqual(sent, ["hello"]);
  enabled = false; key("Enter"); assert.equal(composer.isOpen, false);
});
