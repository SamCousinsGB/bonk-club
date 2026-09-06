import PeerModule from "peerjs";
const Peer = PeerModule.Peer ?? PeerModule;
import { cleanInput } from "./engine.js";
export const validCode = (value) =>
  typeof value === "string" && /^[A-HJ-NP-Z2-9]{6}$/.test(value);
const PREFIX = "bonkclub-v1-";
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode() {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (v) => alphabet[v % alphabet.length],
  ).join("");
}
export class Room {
  constructor(callbacks = {}, PeerClass = Peer) {
    this.callbacks = callbacks;
    this.PeerClass = PeerClass;
    this.peer = null;
    this.connections = new Map();
    this.pending = new Set();
    this.timers = new Set();
    this.host = false;
    this.id = null;
    this.code = "";
    this.roster = [];
    this.running = false;
    this.closed = false;
    this.inputTimes = {};
    this.lastInputs = {};
  }
  emit(name, ...args) {
    this.callbacks[name]?.(...args);
  }
  later(fn, ms) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (!this.closed) fn();
    }, ms);
    this.timers.add(t);
    return t;
  }
  clear(t) {
    clearTimeout(t);
    this.timers.delete(t);
  }
  send(c, data) {
    if (c?.open)
      try {
        c.send(data);
      } catch {
        this.emit("onNotice", "Connection interrupted.");
      }
  }
  broadcast(data) {
    for (const c of this.connections.values()) this.send(c, data);
  }
  async openPeer(id) {
    return new Promise((resolve, reject) => {
      const p = (this.peer = new this.PeerClass(id, { debug: 0 }));
      let settled = false;
      const t = this.later(() => {
        settled = true;
        reject(
          new Error("The room service did not respond. Try again in a moment."),
        );
      }, 12000);
      p.on("open", () => {
        if (settled || this.closed) return;
        settled = true;
        this.clear(t);
        resolve(p);
      });
      p.on("error", (e) => {
        const map = {
          "peer-unavailable":
            "That room could not be found. Check the code and ask the host to keep the room open.",
          "unavailable-id":
            "That room code is taken. Please create another room.",
          network:
            "Could not reach the room service. Check your connection and try again.",
          webrtc:
            "These browsers could not connect directly. Try another network.",
          "browser-incompatible":
            "This browser cannot use online rooms. Try a current Chrome, Edge, Firefox or Safari.",
        };
        const message =
          map[e.type] || "The online connection failed. Please try again.";
        if (!settled) {
          settled = true;
          this.clear(t);
          reject(Object.assign(new Error(message), { type: e.type }));
        } else if (this.joinReject) {
          this.joinReject(Object.assign(new Error(message), { type: e.type }));
          this.joinReject = null;
        } else if (this.host && e.type === "peer-unavailable") {
          this.emit(
            "onNotice",
            "A joining player could not connect. Your room is still open.",
          );
        } else this.emit("onError", message);
      });
      p.on("disconnected", () => {
        if (!this.closed)
          this.emit(
            "onNotice",
            "Room service disconnected. Existing players can keep playing; reopen the room to add friends.",
          );
      });
    });
  }
  async create(code = makeCode()) {
    if (!validCode(code)) throw new Error("Invalid room code.");
    this.host = true;
    this.id = 0;
    this.code = code;
    this.roster = [{ id: 0, ready: true }];
    await this.openPeer(PREFIX + this.code);
    this.peer.on("connection", (c) => this.accept(c));
    this.emit("onRoster", this.roster);
    return this.code;
  }
  accept(c) {
    if (this.closed) return c.close();
    this.pending.add(c);
    const t = this.later(() => {
      this.pending.delete(c);
      c.close();
    }, 12000);
    let id = null;
    c.on("open", () => {
      this.clear(t);
      this.pending.delete(c);
      if (this.closed) return c.close();
      if (this.running || this.connections.size >= 3) {
        this.send(c, {
          t: "reject",
          code: this.running ? "room-busy" : "room-full",
          reason: this.running
            ? "This match has already started. Join after it finishes."
            : "This room is full (4 players).",
        });
        this.later(() => c.close(), 300);
        return;
      }
      id = [1, 2, 3].find((n) => !this.connections.has(n));
      this.connections.set(id, c);
      this.roster.push({ id, ready: false });
      this.send(c, { t: "welcome", id, code: this.code });
      this.publishRoster();
    });
    c.on("data", (m) => {
      if (id === null || !m || typeof m !== "object") return;
      if (m.t === "input") {
        this.lastInputs[id] = cleanInput(m.input);
        this.inputTimes[id] = performance.now();
      }
      if (m.t === "ready" && !this.running) {
        this.roster = this.roster.map((p) =>
          p.id === id ? { ...p, ready: m.ready === true } : p,
        );
        this.publishRoster();
      }
      if (m.t === "ping" && typeof m.time === "number")
        this.send(c, { t: "pong", time: m.time });
    });
    c.on("close", () => {
      this.clear(t);
      this.pending.delete(c);
      if (id === null || this.closed) return;
      this.connections.delete(id);
      delete this.lastInputs[id];
      delete this.inputTimes[id];
      this.roster = this.roster.filter((p) => p.id !== id);
      if (this.running) {
        this.running = false;
        this.broadcast({
          t: "end",
          reason: "A player disconnected. Back to the room for a fresh match.",
        });
        this.emit(
          "onEnd",
          "A player disconnected. Back to the room for a fresh match.",
        );
      }
      this.publishRoster();
    });
    c.on("error", () => c.close());
  }
  async join(code) {
    if (!validCode(code)) throw new Error("Enter the six-character room code.");
    this.code = code;
    await this.openPeer(PREFIX + "guest-" + crypto.randomUUID());
    return new Promise((resolve, reject) => {
      this.joinReject = reject;
      let welcomed = false;
      const c = (this.connection = this.peer.connect(PREFIX + code, {
        reliable: false,
        serialization: "json",
      }));
      const t = this.later(() => {
        reject(
          new Error(
            "Could not reach this room. Ask the host to check the code. Some networks need a relay server.",
          ),
        );
        c.close();
      }, 15000);
      c.on("data", (m) => {
        if (!m || typeof m !== "object") return;
        if (
          m.t === "welcome" &&
          Number.isInteger(m.id) &&
          m.id > 0 &&
          m.id < 4
        ) {
          welcomed = true;
          this.joinReject = null;
          this.clear(t);
          this.id = m.id;
          resolve();
        }
        if (m.t === "reject") {
          this.clear(t);
          this.joinReject = null;
          reject(
            Object.assign(new Error(String(m.reason).slice(0, 180)), {
              type: m.code,
            }),
          );
        }
        if (!welcomed) return;
        if (
          m.t === "roster" &&
          Array.isArray(m.players) &&
          m.players.length <= 4
        ) {
          this.roster = m.players
            .filter((p) => Number.isInteger(p.id) && p.id >= 0 && p.id < 4)
            .map((p) => ({ id: p.id, ready: p.ready === true }));
          this.emit("onRoster", this.roster);
        }
        if (m.t === "start") {
          this.running = true;
          this.emit("onStart");
        }
        if (m.t === "state" && this.running && validSnapshot(m.state))
          this.emit("onState", m.state);
        if (m.t === "end") {
          this.running = false;
          this.emit(
            "onEnd",
            String(m.reason || "Back to the room.").slice(0, 180),
          );
        }
        if (m.t === "pong")
          this.emit("onPing", Math.round(performance.now() - m.time));
      });
      c.on("close", () => {
        this.clear(t);
        if (!welcomed)
          reject(new Error("The room connection closed. Try joining again."));
        else if (!this.closed)
          this.emit(
            "onError",
            "The host left the room. Create or join a new room to keep playing.",
          );
      });
      c.on("error", () => {
        this.clear(t);
        reject(
          new Error("Could not connect to this room. Try a different network."),
        );
        if (welcomed && !this.closed)
          this.emit("onError", "The connection to the host failed.");
      });
    });
  }
  publishRoster() {
    this.roster.sort((a, b) => a.id - b.id);
    this.broadcast({ t: "roster", players: this.roster });
    this.emit("onRoster", this.roster);
  }
  ready(value) {
    this.send(this.connection, { t: "ready", ready: value });
  }
  start() {
    if (
      !this.host ||
      this.running ||
      this.roster.length < 2 ||
      !this.roster.every((p) => p.ready)
    )
      return false;
    this.running = true;
    this.broadcast({ t: "start" });
    return true;
  }
  sendInput(input) {
    this.send(this.connection, { t: "input", input: cleanInput(input) });
  }
  getInputs(now = performance.now()) {
    const out = {};
    for (const id in this.lastInputs)
      out[id] =
        now - (this.inputTimes[id] || 0) < 700
          ? this.lastInputs[id]
          : cleanInput(null);
    return out;
  }
  sendState(state) {
    if (this.host && this.running) this.broadcast({ t: "state", state });
  }
  ping() {
    this.send(this.connection, { t: "ping", time: performance.now() });
  }
  end(reason = "Back to the room.") {
    if (!this.host) return;
    this.running = false;
    this.broadcast({ t: "end", reason });
    this.emit("onEnd", reason);
  }
  close() {
    this.closed = true;
    this.joinReject?.(new Error("Connection cancelled."));
    this.joinReject = null;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    for (const c of this.pending) c.close();
    this.pending.clear();
    for (const c of this.connections.values()) c.close();
    this.connections.clear();
    this.connection?.close();
    this.peer?.destroy();
  }
}
const finite = (n) =>
  typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 10000000;
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const weaponTypes = ["bat", "sword", "blaster", "shotgun", "rocket", "grenade"];
const list = (value, max, check) =>
  Array.isArray(value) &&
  value.length <= max &&
  value.every((v) => v && typeof v === "object" && check(v));
const xy = (p) => finite(p.x) && finite(p.y);
export function validSnapshot(s) {
  return (
    !!s &&
    typeof s === "object" &&
    ["countdown", "fight", "result", "match"].includes(s.phase) &&
    integer(s.arenaIndex, 0, 7) &&
    integer(s.round, 1, 100000) &&
    [3, 5, 10].includes(s.target) &&
    [s.phaseTime, s.elapsed, s.time].every(finite) &&
    (s.winner === null || integer(s.winner, 0, 3)) &&
    list(
      s.players,
      4,
      (p) =>
        integer(p.id, 0, 3) &&
        xy(p) &&
        [
          p.vx,
          p.vy,
          p.hp,
          p.walk,
          p.swing,
          p.blockTime,
          p.stamina,
          p.flash,
        ].every(finite) &&
        (p.rig === null || (list(p.rig, 11, xy) && p.rig.length === 11)) &&
        integer(p.ammo, 0, 100) &&
        p.hp >= 0 &&
        p.hp <= 100 &&
        (p.facing === 1 || p.facing === -1) &&
        typeof p.alive === "boolean" &&
        (p.weapon === null || weaponTypes.includes(p.weapon)),
    ) &&
    s.players.length >= 2 &&
    new Set(s.players.map((p) => p.id)).size === s.players.length &&
    list(
      s.platforms,
      12,
      (p) =>
        xy(p) &&
        [p.w, p.h, p.baseX, p.dx].every(finite) &&
        p.w > 0 &&
        p.w < 2000 &&
        p.h > 0 &&
        p.h < 1000,
    ) &&
    list(
      s.projectiles,
      100,
      (p) =>
        xy(p) &&
        [p.vx, p.vy, p.r, p.life].every(finite) &&
        ["bullet", "pellet", "rocket", "grenade"].includes(p.kind),
    ) &&
    list(
      s.drops,
      20,
      (d) => xy(d) && finite(d.life) && weaponTypes.includes(d.type),
    ) &&
    list(
      s.ragdolls,
      4,
      (r) =>
        finite(r.life) &&
        typeof r.color === "string" &&
        /^#[a-fA-F0-9]{6}$/.test(r.color) &&
        list(r.points, 11, xy) &&
        r.points.length === 11,
    ) &&
    Array.isArray(s.scores) &&
    s.scores.length === 4 &&
    s.scores.every((n) => integer(n, 0, 100000)) &&
    list(
      s.events,
      35,
      (e) =>
        integer(e.id, 0, 10000000) &&
        [
          "fight",
          "match",
          "round",
          "jump",
          "swing",
          "hit",
          "ko",
          "parry",
          "block",
          "shoot",
          "explosion",
          "pickup",
        ].includes(e.type) &&
        (e.x === undefined || xy(e)) &&
        (e.color === undefined ||
          (typeof e.color === "string" && /^#[a-fA-F0-9]{6}$/.test(e.color))),
    )
  );
}
