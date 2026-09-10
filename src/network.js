import {BLOOD_LIMIT} from "./gore.js";
import { SINGULARITY } from "./blackhole.js";
import { DEATH_EFFECTS } from "./death-effects.js";
import { NUCLEAR, PARRY } from "./impact.js";
import { defaultSlots, validSlots, allowsPlayer, activeSlots, SLOT_LABELS } from "./slots.js";
import { RenderSnapshots } from "./render-state.js";
import { PROJECTILE_KINDS } from "./arsenal.js";
import { COVER_KINDS } from "./maps.js";
import { HAZARD_TYPES } from "./hazards.js";
import { loadIceConfig, connectionFailure, hasRelay } from "./ice.js";
import { ConnectionDiagnostics } from "./connection-diagnostics.js";
import { roomServiceOptions } from "./room-service.js";
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
export const PROTOCOL = 19;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (v) => alphabet[v % alphabet.length],
  ).join("");
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
    this.diagnostics = new ConnectionDiagnostics();
    this.PeerClass = PeerClass;
    this.profile = cleanProfile(options.profile);
    this.config = options.config;
    this.signaling = roomServiceOptions(
      options.roomServiceUrl ?? import.meta.env?.VITE_ROOM_SERVICE_URL ?? "",
    );
    this.iceServersUrl =
      options.iceServersUrl ?? import.meta.env?.VITE_TURN_CREDENTIALS_URL ?? "";
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
    this.slots = defaultSlots();
    this.renderSnapshots = new RenderSnapshots();
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
    if (!this.config) this.config = await loadIceConfig(this.iceServersUrl);
    if (this.closed) throw new Error("Room closed.");
    return new Promise((resolve, reject) => {
      const p = (this.peer = new this.PeerClass(id, {
        ...this.signaling,
        debug: 0,
        config: this.config,
      }));
      if (this.iceServersUrl) this.scheduleIceRefresh();
      let settled = false;
      p.socket?.on("message", (m) => this.diagnostics.signal(m));
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
        this.diagnostics.error(e);
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
  scheduleIceRefresh(delay = 20 * 60 * 1000) {
    if (this.iceRefreshTimer) this.clear(this.iceRefreshTimer);
    this.iceRefreshTimer = this.later(async () => {
      try {
        await this.refreshIceConfig();
        if (!this.closed) this.scheduleIceRefresh();
      } catch {
        if (!this.closed) this.scheduleIceRefresh(60 * 1000);
      }
    }, delay);
  }
  async refreshIceConfig() {
    const config = await loadIceConfig(this.iceServersUrl);
    if (this.closed) return;
    this.config = config;
    // PeerJS creates incoming connections before emitting its connection event.
    // Late joins must receive current TURN credentials from its configuration.
    if (this.peer?.options) this.peer.options.config = config;
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
    if (!this.host || this.closed || this.running || activeSlots(this.slots, this.roster).length < 2) return false;
    this.running = true;
    this.broadcast({ t: "start" });
    this.emit("onStart");
    return true;
  }
  setSlot(id, mode) {
    if (!this.host || this.running || this.closed || !Number.isInteger(id) || id < 1 || id > 3) return false;
    const slots = [...this.slots];
    slots[id] = mode;
    if (!validSlots(slots)) return false;
    this.slots = slots;
    const c = this.connections.get(id);
    if (c && !allowsPlayer(mode)) {
      this.connections.delete(id);
      this.roster = this.roster.filter(p => p.id !== id);
      delete this.lastInputs[id];
      delete this.inputTimes[id];
      this.send(c, { t: "removed", reason: `The host changed your slot to ${SLOT_LABELS[mode]}.` });
      this.later(() => c.close(), 200);
    }
    this.publishRoster();
    return true;
  }
  accept(c) {
    if (this.closed) return c.close();
    this.diagnostics.watch(c, "incoming");
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
      const available = [1, 2, 3].find((n) => allowsPlayer(this.slots[n]) && !this.connections.has(n));
      if (available === undefined) return reject("room-full", "No player slots are open in this room.");
      id = available;
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
      c.inFlight = [];
      this.send(c, {
        t: "welcome",
        id,
        code: this.code,
        protocol: PROTOCOL,
        running: this.running,
        players: this.roster,
        slots: this.slots,
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
      if (m.t === "ack" && Number.isInteger(m.seq) && m.seq > c.frameAck && m.seq <= c.frameSequence) {
        c.frameAck = m.seq;
        c.inFlight = c.inFlight.filter(seq => seq > m.seq);
      }
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
      this.diagnostics.watch(c, "outgoing");
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
                ? connectionFailure(this.config, c)
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
            !validSlots(m.slots) ||
            !this.receiveRoster(m.players)
          )
            return fail(new Error("Invalid room response."));
          this.slots = [...m.slots];
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
        if (m.t === "removed") {
          this.emit("onError", typeof m.reason === "string" ? m.reason.slice(0, 120) : "The host removed your slot.");
          return;
        }
        if (m.t === "roster" && validSlots(m.slots) && this.receiveRoster(m.players)) {
          this.slots = [...m.slots];
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
    this.broadcast({ t: "roster", players: this.roster, slots: this.slots });
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
        (c.inFlight.length < 4 || now - c.frameSentAt > 1200),
    );
    if (!ready.length) return;
    this.encoding = true;
    try {
      state = this.renderSnapshots.make(state);
      const compressed =
        this.compression && ready.some((c) => c.metadata?.compression)
          ? await encodeState(state)
          : null;
      if (this.closed) return;
      const seq = ++this.sequence;
      for (const c of ready) {
        if (!c.open || ![...this.connections.values()].includes(c)) continue;
        if (now - c.frameSentAt > 1200) c.inFlight = [];
        c.inFlight.push(seq);
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
  connectionReport() {
    return {
      protocol: PROTOCOL,
      peerjs: "1.5.5",
      role: this.host ? "host" : "guest",
      relayConfigured: hasRelay(this.config),
      roomClosed: this.closed,
      roomService: this.roomServiceAtClose || this.roomServiceState(),
      ...this.diagnostics.report(),
    };
  }
  roomServiceState() {
    return this.peer?.disconnected
      ? "disconnected"
      : this.peer?.open
        ? "connected"
        : "not-open";
  }
  close() {
    if (this.closed) return;
    this.roomServiceAtClose = this.roomServiceState();
    this.closed = true;
    this.diagnostics.close();
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
          p.chill, p.freeze, p.xray, p.knockdown,
          p.blockTime,
          p.parryCooldown,
          p.stamina,
          p.flash,
        ].every(finite) &&
        (p.rig === null || (list(p.rig, 11, xy) && p.rig.length === 11)) &&
        integer(p.comboStep, 0, 2) &&
        ["punch", "kick", "spin", "weapon"].includes(p.meleeMove) &&
        integer(p.ammo, 0, 100) &&
        p.parryCooldown >= 0 && p.parryCooldown <= PARRY.cooldown + 0.01 &&
        p.knockdown>=0 && p.knockdown<=1.8 &&
        p.freeze >= 0 && p.freeze <= 1.2 && p.xray >= 0 && p.xray <= .4 &&
        p.hp >= 0 &&
        p.hp <= 100 &&
        (p.facing === 1 || p.facing === -1) &&
        typeof p.alive === "boolean" &&
        (p.weapon === null || weaponTypes.includes(p.weapon)),
    ) &&
    s.players.length >= 1 &&
    new Set(s.players.map((p) => p.id)).size === s.players.length &&
    list(
      s.platforms,
      1536,
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
    list(s.spikes,512,p => xy(p) && finite(p.w) && p.w > 0 && p.w <= 3000) &&
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
      8,
      (h) =>
        integer(h.id, 1, 1000000) &&
        HAZARD_TYPES.includes(h.type) &&
        [h.x, h.y, h.w, h.h, h.warning, h.age, h.duration, h.bodyX, h.bodyY, h.vy].every(
          finite,
        ) &&
        h.w > 0 &&
        h.w <= 400 &&
        h.h > 0 &&
        h.h <= 300 &&
        h.warning >= 0 &&
        h.warning <= 2 &&
        h.age >= 0 &&
        h.duration >= -0.02 &&
        h.duration <= 6 &&
        (h.dir === 1 || h.dir === -1) &&
        typeof h.done === "boolean" &&
        typeof h.active === "boolean" &&
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
        ["arc", "blackhole", "shockwave", "phaser"].includes(f.kind) &&
        f.radius >= 0 &&
        f.radius <= (f.kind === "shockwave" ? NUCLEAR.waveRadius : f.kind === "blackhole" ? SINGULARITY.radius : 400) &&
        (f.kind === "arc" || (finite(f.age) && f.age >= 0 && f.age <= 6)) &&
        (f.kind !== "shockwave" ||
          (integer(f.craterId,1,1000000) && typeof f.melted === "boolean")) &&
        (f.kind!=="blackhole" || (integer(f.riftId,1,1000000) && typeof f.torn === "boolean")) &&
        (f.kind !== "phaser" || (f.radius === WEAPONS.phaser.radius &&
          f.life <= WEAPONS.phaser.life && f.age <= WEAPONS.phaser.life &&
          integer(f.owner,0,3) && Math.abs(Math.hypot(f.ex-f.x,f.ey-f.y)-WEAPONS.phaser.range) < .03)) &&
        f.life >= 0 &&
        f.life <= 6,
    ) &&
    list(s.blood,BLOOD_LIMIT,b=>xy(b)&&[b.vx,b.vy,b.r,b.life].every(finite)&&b.r>0&&b.r<=4&&b.life>=0&&b.life<=7&&typeof b.landed==="boolean") &&
    list(s.wreckage,60,w => xy(w) && integer(w.id,1,1000000) && [w.w,w.h,w.angle,w.hp].every(finite) &&
      w.w>0 && w.w<=150 && w.h>0 && w.h<=90 && w.hp>=0 && w.hp<=120 && ["platform","trap","prop"].includes(w.kind) &&
      (w.sourceKind==null || COVER_KINDS.includes(w.sourceKind)) &&
      (w.elevator===undefined || typeof w.elevator==="boolean") &&
      (w.spine===undefined||(list(w.spine,6,xy)&&w.spine.length===6&&list(w.outline,12,xy)&&w.outline.length===12))) &&
    list(s.rifts,128,c => xy(c) && integer(c.id,1,1000000) && c.radius===SINGULARITY.radius && finite(c.born)) &&
    list(s.craters,128,c => xy(c) && integer(c.id,1,1000000) &&
      finite(c.radius) && c.radius > 0 && c.radius <= NUCLEAR.coreRadius && finite(c.born) && c.born >= 0 && c.born <= s.time + .01) &&
    new Set(s.craters.map(c=>c.id)).size === s.craters.length &&
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
        (r.ash === undefined || (r.ash === true && finite(r.ashAge) && r.ashAge >= 0 && r.ashAge <= NUCLEAR.ashDuration && [-1,1].includes(r.ashDirection))) &&
        typeof r.color === "string" &&
        /^#[a-fA-F0-9]{6}$/.test(r.color) &&
        (r.effect===undefined || (DEATH_EFFECTS.includes(r.effect) && finite(r.deathAge) && r.deathAge>=0 && r.deathAge<=6)) &&
        (r.effect!=="singularity" || ([r.targetX,r.targetY].every(finite)&&list(r.strands,10,s=>list(s.points,6,xy)&&s.points.length===6)&&r.strands.length===10)) &&
        (r.effect!=="gib" || (Array.isArray(r.severed)&&r.severed.length===2&&r.severed.every(i=>integer(i,0,9)))) &&
        (r.effect!=="impale" || (r.anchor&&xy(r.anchor)&&integer(r.anchor.point,0,10))) &&
        list(r.points, 13, xy) &&
        r.points.length === (r.effect==="slice"?13:11),
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
