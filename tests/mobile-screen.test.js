import test from "node:test";
import assert from "node:assert/strict";
import { MobileScreen } from "../src/mobile-screen.js";

test("fullscreen starts synchronously, then landscape locks after it completes", async () => {
  const calls = [];
  let complete;
  const doc = { documentElement: { requestFullscreen(options) {
    calls.push(["fullscreen", options]);
    return new Promise(resolve => { complete = () => { doc.fullscreenElement = {}; resolve(); }; });
  } } };
  const s = new MobileScreen(doc, { orientation: { lock: async mode => calls.push(["lock", mode]) } });
  const pending = s.enter();
  assert.equal(s.enter(), pending, "avoid duplicate fullscreen requests");
  assert.deepEqual(calls, [["fullscreen", { navigationUI: "hide" }]]);
  complete();
  await pending;
  assert.deepEqual(calls[1], ["lock", "landscape"]);
  await s.enter();
  assert.equal(calls.filter(c => c[0] === "fullscreen").length, 1);
});

test("denied or missing screen APIs never prevent joining, and can be retried", async () => {
  let attempts = 0;
  const s = new MobileScreen({ documentElement: { requestFullscreen() {
    attempts++;
    return Promise.reject(new Error("No activation"));
  } } }, { orientation: { lock: () => Promise.reject(new Error("Not supported")) } });
  await s.enter();
  await s.enter();
  assert.equal(attempts, 2);
  assert.equal(s.fullscreen, false);
  const unsupported = new MobileScreen({ documentElement: {} }, {});
  assert.equal(unsupported.supported, false);
  await unsupported.enter();
  unsupported.release();
});

test("prefixed fullscreen is supported without requiring orientation APIs", async () => {
  const doc = { documentElement: { webkitRequestFullscreen() { doc.webkitFullscreenElement = {}; } } };
  const s = new MobileScreen(doc, {});
  assert.equal(s.supported, true);
  await s.enter();
  assert.equal(s.fullscreen, true);
});

test("leaving during a fullscreen request prevents a late landscape lock", async () => {
  let complete, locks = 0, unlocks = 0;
  const s = new MobileScreen({ documentElement: { requestFullscreen: () => new Promise(resolve => { complete = resolve; }) } }, {
    orientation: { lock() { locks++; }, unlock() { unlocks++; } },
  });
  const pending = s.enter();
  s.release();
  complete();
  await pending;
  assert.equal(locks, 0);
  assert.equal(unlocks, 1);
});
