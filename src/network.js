import { PROJECTILE_KINDS } from "./arsenal.js";
import { COVER_KINDS } from "./maps.js";
import { HAZARD_TYPES } from "./hazards.js";
import {
  cleanProfile,
  defaultProfile,
  availableProfile,
  validProfile,
} from "./identity.js";
import PeerModule from "peerjs";
const Peer = PeerModule.Peer ?? PeerModule;
import { cleanInput, ARENAS, WEAPONS } from "./engine.js";
export const validCode = (value) =>
  typeof value === "string" && /^[A-HJ-NP-Z2-9]{6}$/.test(value);
// Keep discovery IDs stable; negotiate compatibility explicitly instead of making
// a room appear missing every time the game is updated.
const PREFIX = "bonkclub-v9-";
export const PROTOCOL = 10;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (v) => alphabet[v % alphabet.length],
  ).join("");
export const DEFAULT_ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];
export async function encodeState(state) {
  const stream = new Blob([JSON.stringify(state)])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
export async function decodeState(bytes) {
  if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > 250000)
    throw new Error("Invalid frame");
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"))
    .getReader();
  const chunks = [];
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 1000000) {
      await reader.cancel();
      throw new Error("Frame too large");
    }
    chunks.push(value);
  }
  return JSON.parse(await new Blob(chunks).text());
}
export class Room {
  constructor(callbacks = {}, PeerClass = Peer, options = {}) {
    this.callbacks = callbacks;
    this.PeerClass = PeerClass;
    this.profile = cleanProfile(options.profile);
    this.config = options.config || { iceServers: DEFAULT_ICE };
    this.compression =
      options.compression ??
      (PeerClass === Peer &&
        typeof CompressionStream !== "undefined" &&
        typeof DecompressionStream !== "undefined");
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
    this.sequence = 0;
    this.reconnectAttempts = 0;
    this.decoding = Promise.resolve();
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
    if (c?.open) {
      try {
        const sent = c.send(data);
        sent?.catch?.(() => this.emit("onNotice", "Connection interrupted."));
      } catch {
        this.emit("onNotice", "Connection interrupted.");
      }
    }
  }
  broadcast(data) {
    for (const c of this.connections.values()) this.send(c, data);
  }
  async openPeer(id) {
    return new Promise((resolve, reject) => {
      const p = (this.peer = new this.PeerClass(id, {
        debug: 0,
        config: this.config,
      }));
      let settled = false;
      const t = this.later(() => {
        settled = true;
        reject(new Error("The room service did not respond. Try again."));
      }, 20000);
      p.on("connection", (c) => (this.host ? this.accept(c) : c.close()));
      p.on("open", () => {
        if (this.closed) return;
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) {
          this.clear(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.emit("onStatus", "Connected");
        if (!settled) {
          settled = true;
          this.clear(t);
          resolve(p);
        }
      });
      p.on("error", (e) => {
        const messages = {
          "peer-unavailable":
            "Room not found. Check the code and ask the host to refresh the game and share a new invite.",
          "unavailable-id": "That room code is taken. Create another room.",
          network:
            "Could not reach the room service. Check your connection and retry.",
          webrtc:
            "The browsers could not establish a connection. Retry joining the room.",
          "browser-incompatible":
            "This browser cannot use online rooms. Try a current Chrome, Edge, Firefox or Safari.",
        };
        const error = Object.assign(
          new Error(
            messages[e.type] || "The online connection failed. Try again.",
          ),
          { type: e.type },
        );
        if (!settled) {
          settled = true;
          this.clear(t);
          reject(error);
        } else if (this.joinReject) this.joinReject(error);
        else if (
          this.host ||
          (this.connection?.open &&
            ["network", "socket-error", "server-error"].includes(e.type))
        ) {
          this.emit("onNotice", error.message);
          if (p.disconnected) this.reconnect();
        } else if (!this.closed) this.emit("onError", error.message);
      });
      p.on("disconnected", () => {
        if (!this.closed) {
          this.emit("onStatus", "Reconnecting…");
          this.reconnect();
        }
      });
    });
  }
  reconnect() {
    if (
      this.closed ||
      this.reconnectTimer ||
      !this.peer?.disconnected ||
      this.peer.destroyed
    )
      return;
    this.reconnectTimer = this.later(
      () => {
        this.reconnectTimer = null;
        try {
          this.peer.reconnect();
        } catch {
          /* Retry while existing data channels remain open. */
        }
        if (this.peer.disconnected) this.reconnect();
      },
      Math.min(8000, 1000 * 2 ** this.reconnectAttempts++),
    );
  }
  async create(code = makeCode()) {
    if (!validCode(code)) throw new Error("Invalid room code.");
    this.host = true;
    this.id = 0;
    this.code = code;
    this.roster = [{ id: 0, ...this.profile }];
    await this.openPeer(PREFIX + code);
    this.emit("onRoster", this.roster);
    this.emit("onLobby");
    return code;
  }
  start() {
    if (!this.host || this.closed || this.running) return false;
    this.running = true;
    this.broadcast({ t: "start" });
    this.emit("onStart");
    return true;
  }
  accept(c) {
    if (this.closed) return c.close();
    this.pending.add(c);
    const t = this.later(() => {
      this.pending.delete(c);
      c.close();
    }, 35000);
    let id = null;
    c.on("open", () => {
      if (id !== null) return;
      this.clear(t);
      this.pending.delete(c);
      if (this.closed) return c.close();
      const reject = (code, reason) => {
        this.send(c, { t: "reject", code, reason });
        this.later(() => c.close(), 400);
      };
      if (c.metadata?.protocol !== PROTOCOL)
        return reject(
          "version-mismatch",
          "Game versions differ. Refresh both game tabs, then use a new invite.",
        );
      if (this.connections.size >= 3)
        return reject("room-full", "This room is full (4 players).");
      id = [1, 2, 3].find((n) => !this.connections.has(n));
      this.connections.set(id, c);
      const profile = availableProfile(
        c.metadata?.profile,
        this.roster,
        defaultProfile(id),
      );
      this.roster.push({ id, ...profile });
      c.frameSequence = 0;
      c.frameAck = 0;
      c.frameSentAt = 0;
      this.send(c, {
        t: "welcome",
        id,
        code: this.code,
        protocol: PROTOCOL,
        running: this.running,
        players: this.roster,
      });
      this.publishRoster();
      if (this.latestState) this.sendState(this.latestState);
    });
    c.on("data", (m) => {
      if (
        id === null ||
        this.connections.get(id) !== c ||
        !m ||
        typeof m !== "object"
      )
        return;
      if (m.t === "input" && this.running) {
        this.lastInputs[id] = cleanInput(m.input);
        this.inputTimes[id] = performance.now();
      }
      if (m.t === "profile") this.assignProfile(id, m.profile);
      if (m.t === "ack" && Number.isInteger(m.seq) && m.seq === c.frameSequence)
        c.frameAck = m.seq;
      if (m.t === "ping" && typeof m.time === "number")
        this.send(c, { t: "pong", time: m.time });
    });
    c.on("close", () => {
      this.clear(t);
      this.pending.delete(c);
      if (id === null || this.closed || this.connections.get(id) !== c) return;
      this.connections.delete(id);
      delete this.lastInputs[id];
      delete this.inputTimes[id];
      this.roster = this.roster.filter((p) => p.id !== id);
      this.publishRoster();
    });
    c.on("error", () => c.close());
    if (c.open) queueMicrotask(() => c.emit("open"));
  }
  async join(code) {
    if (!validCode(code)) throw new Error("Enter the six-character room code.");
    this.code = code;
    await this.openPeer(PREFIX + "guest-" + crypto.randomUUID());
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await this.joinAttempt(code);
        return;
      } catch (e) {
        if (this.closed || attempt || e.type !== "connection-timeout") throw e;
        this.emit("onStatus", "Retrying connection…");
      }
    }
  }
  joinAttempt(code) {
    return new Promise((resolve, reject) => {
      let welcomed = false,
        settled = false;
      const c = (this.connection = this.peer.connect(PREFIX + code, {
        reliable: true,
        serialization: "binary",
        metadata: {
          protocol: PROTOCOL,
          profile: this.profile,
          compression: this.compression,
        },
      }));
      const fail = (error) => {
        if (settled) return;
        settled = true;
        this.clear(t);
        this.joinReject = null;
        reject(error);
        c.close();
      };
      this.joinReject = fail;
      const t = this.later(() => {
        const answered = !!c.peerConnection?.remoteDescription;
        fail(
          Object.assign(
            new Error(
              answered
                ? "The host responded, but the browsers could not connect. Refresh both tabs and retry. This network may need a working relay."
                : "The room did not answer. Ask the host to refresh the game and send a new invite.",
            ),
            { type: "connection-timeout" },
          ),
        );
      }, 25000);
      c.on("open", () => this.emit("onStatus", "Joining room…"));
      c.on("data", (m) => {
        if (this.connection !== c || this.closed || !m || typeof m !== "object")
          return;
        if (m.t === "reject" && !welcomed)
          return fail(
            Object.assign(new Error(String(m.reason).slice(0, 180)), {
              type: m.code,
            }),
          );
        if (!welcomed && m.t === "welcome") {
          if (m.protocol !== PROTOCOL)
            return fail(
              Object.assign(
                new Error(
                  "The host has an older game open. Refresh both game tabs, then use a new invite.",
                ),
                { type: "version-mismatch" },
              ),
            );
          if (
            !Number.isInteger(m.id) ||
            m.id < 1 ||
            m.id > 3 ||
            !this.receiveRoster(m.players)
          )
            return fail(new Error("Invalid room response."));
          welcomed = settled = true;
          this.clear(t);
          this.joinReject = null;
          this.id = m.id;
          this.running = m.running === true;
          this.profile = cleanProfile(
            this.roster.find((p) => p.id === this.id),
          );
          this.emit("onRoster", this.roster);
          this.emit(this.running ? "onStart" : "onLobby");
          resolve();
        }
        if (!welcomed) return;
        if (m.t === "roster" && this.receiveRoster(m.players)) {
          this.profile = cleanProfile(
            this.roster.find((p) => p.id === this.id),
          );
          this.emit("onRoster", this.roster);
        }
        if (m.t === "start" && !this.running) {
          this.running = true;
          this.emit("onStart");
        }
        if ((m.t === "state" || m.t === "frame") && this.running) {
          const consume = async () => {
            try {
              const state =
                m.t === "frame" ? await decodeState(m.bytes) : m.state;
              if (this.closed || this.connection !== c) return;
              if (validSnapshot(state)) this.emit("onState", state);
              this.send(c, { t: "ack", seq: m.seq });
            } catch {
              this.emit(
                "onNotice",
                "A game update could not be read. Waiting for the next update.",
              );
              this.send(c, { t: "ack", seq: m.seq });
            }
          };
          this.decoding = this.decoding.then(consume);
        }
        if (m.t === "pong")
          this.emit("onPing", Math.round(performance.now() - m.time));
      });
      c.on("close", () => {
        if (this.connection !== c || this.closed) return;
        if (!welcomed)
          fail(
            Object.assign(
              new Error("The room connection closed. Retry joining."),
              { type: "connection-timeout" },
            ),
          );
        else
          this.emit(
            "onError",
            "The connection to the host closed. Rejoin using the room code.",
          );
      });
      c.on("error", () => {
        if (!welcomed)
          fail(
            Object.assign(new Error("Could not connect to this room."), {
              type: "connection-timeout",
            }),
          );
        else if (!this.closed)
          this.emit(
            "onError",
            "The connection to the host failed. Rejoin using the room code.",
          );
      });
    });
  }
  receiveRoster(players) {
    if (
      !Array.isArray(players) ||
      players.length < 1 ||
      players.length > 4 ||
      players.some(
        (p) =>
          !Number.isInteger(p.id) || p.id < 0 || p.id > 3 || !validProfile(p),
      ) ||
      new Set(players.map((p) => p.id)).size !== players.length
    )
      return false;
    this.roster = players.map((p) => ({ id: p.id, ...cleanProfile(p) }));
    return true;
  }
  assignProfile(id, value) {
    const player = this.roster.find((p) => p.id === id);
    if (!player) return;
    Object.assign(
      player,
      availableProfile(
        value,
        this.roster.filter((p) => p.id !== id),
        player,
      ),
    );
    if (id === this.id) this.profile = cleanProfile(player);
    this.publishRoster();
  }
  setProfile(value) {
    this.profile = cleanProfile(value, this.profile);
    if (this.host) this.assignProfile(this.id, this.profile);
    else this.send(this.connection, { t: "profile", profile: this.profile });
  }
  publishRoster() {
    this.roster.sort((a, b) => a.id - b.id);
    this.broadcast({ t: "roster", players: this.roster });
    this.emit("onRoster", this.roster);
  }
  sendInput(input) {
    if (this.running)
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
  async sendState(state) {
    if (!this.host || !this.running || this.closed) return;
    this.latestState = state;
    if (this.encoding) return;
    const now = performance.now();
    const ready = [...this.connections.values()].filter(
      (c) =>
        c.open &&
        !c.bufferSize &&
        (c.dataChannel?.bufferedAmount || 0) < 65536 &&
        (c.frameAck === c.frameSequence || now - c.frameSentAt > 1200),
    );
    if (!ready.length) return;
    this.encoding = true;
    try {
      const compressed =
        this.compression && ready.some((c) => c.metadata?.compression)
          ? await encodeState(state)
          : null;
      if (this.closed) return;
      const seq = ++this.sequence;
      for (const c of ready) {
        if (!c.open || ![...this.connections.values()].includes(c)) continue;
        c.frameSequence = seq;
        c.frameSentAt = performance.now();
        this.send(
          c,
          compressed && c.metadata?.compression
            ? { t: "frame", seq, bytes: compressed }
            : { t: "state", seq, state },
        );
      }
    } catch {
      this.emit("onNotice", "A game update could not be sent. Retrying.");
    } finally {
      this.encoding = false;
    }
  }
  ping() {
    this.send(this.connection, { t: "ping", time: performance.now() });
  }
  close() {
    if (this.closed) return;
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
const weaponTypes = Object.keys(WEAPONS);
const list = (value, max, check) =>
  Array.isArray(value) &&
  value.length <= max &&
  value.every((v) => v && typeof v === "object" && check(v));
const xy = (p) => finite(p.x) && finite(p.y);
export function validSnapshot(s) {
  return (
    !!s &&
    typeof s === "object" &&
    ["countdown", "fight", "result"].includes(s.phase) &&
    integer(s.arenaIndex, 0, ARENAS.length - 1) &&
    integer(s.round, 1, Number.MAX_SAFE_INTEGER) &&
    [s.phaseTime, s.elapsed, s.time].every(finite) &&
    (s.winner === null || integer(s.winner, 0, 3)) &&
    list(
      s.players,
      4,
      (p) =>
        integer(p.id, 0, 3) &&
        validProfile(p) &&
        typeof p.bot === "boolean" &&
        integer(p.occupant, 0, Number.MAX_SAFE_INTEGER) &&
        xy(p) &&
        [
          p.vx,
          p.vy,
          p.hp,
          p.walk,
          p.swing,
          p.swingDuration,
          p.comboTime,
          p.recoilTime,
          p.rush,
          p.burn,
          p.chill,
          p.blockTime,
          p.stamina,
          p.flash,
        ].every(finite) &&
        (p.rig === null || (list(p.rig, 11, xy) && p.rig.length === 11)) &&
        integer(p.comboStep, 0, 2) &&
        ["punch", "kick", "spin", "weapon"].includes(p.meleeMove) &&
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
      72,
      (p) =>
        xy(p) &&
        [p.w, p.h, p.baseX, p.baseY, p.dx, p.dy].every(finite) &&
        (!p.destructible ||
          (["wood", "glass"].includes(p.panel) &&
            finite(p.hp) &&
            finite(p.maxHp) &&
            p.hp >= 0 &&
            p.hp <= p.maxHp &&
            p.maxHp <= 200)) &&
        p.w > 0 &&
        p.w < 3000 &&
        p.h > 0 &&
        p.h < 1000,
    ) &&
    list(
      s.cover,
      64,
      (c) =>
        xy(c) &&
        [c.w, c.h, c.hp, c.maxHp].every(finite) &&
        c.w > 0 &&
        c.h > 0 &&
        c.hp >= 0 &&
        c.hp <= c.maxHp &&
        COVER_KINDS.includes(c.kind),
    ) &&
    list(
      s.hazards,
      3,
      (h) =>
        integer(h.id, 1, 1000000) &&
        HAZARD_TYPES.includes(h.type) &&
        [h.x, h.y, h.w, h.h, h.warning, h.age, h.duration, h.bodyY, h.vy].every(
          finite,
        ) &&
        h.w > 0 &&
        h.w <= 300 &&
        h.h > 0 &&
        h.h <= 300 &&
        h.warning >= 0 &&
        h.warning <= 2 &&
        h.age >= 0 &&
        h.duration > 0 &&
        h.duration <= 6 &&
        (h.dir === 1 || h.dir === -1) &&
        typeof h.done === "boolean" &&
        Array.isArray(h.hitIds) &&
        h.hitIds.length <= 4 &&
        h.hitIds.every((id) => integer(id, 0, 3)),
    ) &&
    list(
      s.debris,
      90,
      (d) => xy(d) && [d.w, d.h, d.angle, d.life].every(finite),
    ) &&
    list(
      s.projectiles,
      160,
      (p) =>
        xy(p) &&
        [p.vx, p.vy, p.r, p.life].every(finite) &&
        PROJECTILE_KINDS.includes(p.kind),
    ) &&
    list(
      s.fields,
      12,
      (f) =>
        xy(f) &&
        [f.ex, f.ey, f.radius, f.life].every(finite) &&
        ["arc", "blackhole", "shockwave"].includes(f.kind) &&
        f.radius >= 0 &&
        f.radius <= (f.kind === "shockwave" ? 1050 : 320) &&
        (f.kind === "arc" || (finite(f.age) && f.age >= 0 && f.age <= 5)) &&
        f.life >= 0 &&
        f.life <= 5,
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
    s.scores.every((n) => integer(n, 0, Number.MAX_SAFE_INTEGER)) &&
    list(
      s.events,
      35,
      (e) =>
        integer(e.id, 0, 10000000) &&
        [
          "hazard",
          "fight",
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
          "throw",
          "coverhit",
          "break",
        ].includes(e.type) &&
        (e.x === undefined || xy(e)) &&
        (e.color === undefined ||
          (typeof e.color === "string" && /^#[a-fA-F0-9]{6}$/.test(e.color))),
    )
  );
}
