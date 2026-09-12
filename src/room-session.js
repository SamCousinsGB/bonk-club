import { validVictoryCause } from "./victory.js";
import { validReactions, validReactionObject } from "./reactions.js";
import {BLOOD_LIMIT} from "./gore.js";
import { PROP_MATERIALS, CHUNK_LIMIT } from "./props.js";
import { SINGULARITY } from "./blackhole.js";
import { MATTER_KINDS, MATTER_LIMIT } from "./accretion.js";
import { DEATH_EFFECTS } from "./death-effects.js";
import { NUCLEAR, PARRY } from "./impact.js";
import { defaultSlots, validSlots, allowsPlayer, activeSlots, SLOT_LABELS } from "./slots.js";
import { RenderSnapshots } from "./render-state.js";
import { validMotion, validInputSequence } from "./prediction-state.js";
import { FrameAssembler, LatestFrameDecoder, framePackets, motionPacket } from "./realtime.js";
import { compactSnapshot } from "./snapshot-wire.js";
import { SnapshotHistory } from "./snapshot-delta.js";
import { StateCodec } from "./state-codec.js";
import { InputDelivery } from "./input-delivery.js";
import { motionState, mergeMotion, completeMotion } from "./motion-stream.js";
import { compactFlights } from "./flight-replay.js";
export { encodeState, decodeState } from "./state-codec.js";
import { FighterChat, cleanChat, CHAT_LIMIT, CHAT_COOLDOWN } from "./chat.js";
import { PROJECTILE_KINDS } from "./arsenal.js";
import { validExpandedProjectile } from "./expanded-weapons.js";
import { validTransmutation, validTransmutationProjectile } from "./transmutation.js";
import { MAX_PROJECTILES } from "./projectile-flight.js";
import { COVER_KINDS } from "./maps.js";
import { HAZARD_TYPES } from "./hazards.js";
import {
  cleanProfile,
  defaultProfile,
  availableProfile,
  validProfile,
  validAppearance,
} from "./identity.js";
import { cleanInput, ARENAS, WEAPONS } from "./engine.js";
export const PROTOCOL = 44;
// Shared traffic budgets protect the host's upload; the browser transport also
// needs headroom below its current relay allocation cap.
const STATE_BYTES_PER_SECOND = 60000, MOTION_BYTES_PER_SECOND = 28000;
const realtimeOpen = c => c?.realtimeReady && c.realtime?.readyState === "open";
// Shared room rules and snapshot protocol. Platform modules own discovery and connections.
export class RoomSession {
  constructor(callbacks = {}, options = {}) {
    this.callbacks = callbacks;
    this.diagnostics = options.diagnostics || { watch() {}, close() {}, report() { return {}; }, async refresh() {} };
    this.profile = cleanProfile(options.profile);
    this.compression = options.compression ?? (typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined");
    this.connections = new Map();
    this.pending = new Set();
    this.timers = new Set();
    this.host = false;
    this.id = null;
    this.code = "";
    this.roster = [];
    this.slots = defaultSlots();
    this.renderSnapshots = new RenderSnapshots();
    this.snapshots = new SnapshotHistory();
    this.motionSnapshots = new SnapshotHistory();
    this.codec = new StateCodec();
    this.receivedSequence = 0;
    this.receivedMotionSequence = 0;
    this.running = false;
    this.closed = false;
    this.inputTimes = {};
    this.lastInputs = {};
    this.sequence = 0;
    this.reconnectAttempts = 0;
    this.inputSequence = 0;
    this.inputDelivery = new InputDelivery();
    this.appliedInputs = [0, 0, 0, 0];

    this.chat = new FighterChat();
    this.chatRoles = new Map();
    this.nextChatAt = -Infinity;
    this.streamStats = { received: 0, skipped: 0, lastBytes: 0, lastGapMs: 0, maxGapMs: 0 };
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
  setupRealtime(c) {
    if (!this.compression || c.metadata?.compression === false) return;
    try {
      const channel = this.openRealtimeChannel(c);
      if (!channel) return;
      c.realtime = channel;
      channel.binaryType = "arraybuffer";
      const announce = () => {
        if (c.open && channel.readyState === "open") this.send(c, {t:"realtime-ready"});
      };
      channel.onopen = announce;
      c.on("open", announce);
      c.on("data", m => { if (m?.t === "realtime-ready") c.realtimeReady = true; });
      const assembler = new FrameAssembler(), motionAssembler = new FrameAssembler();
      channel.onmessage = ({ data }) => {
        if (this.closed || !c.open || !this.running) return;
        if (this.host) {
          const id = [...this.connections].find(([, conn]) => conn === c)?.[0];
          if (id === undefined || typeof data !== "string" || data.length > 1000) return;
          try {
            const m = JSON.parse(data);
            if (m.t === "input" && validInputSequence(m.seq) && m.seq > (c.inputSequence || 0)) {
              this.acknowledgeState(c, m.stateAck); this.acknowledgeState(c, m.motionAck, true);
              c.inputSequence = m.seq;
              c.inputDelivery ||= new InputDelivery(); c.inputDelivery.receive(m.edges, m.seq);
              this.lastInputs[id] = cleanInput(m.input);
              this.inputTimes[id] = performance.now();
            }
          } catch { /* Ignore malformed guest controls. */ }
        } else if (this.connection === c && this.id !== null) {
          const frame = (motionPacket(data) ? motionAssembler : assembler).push(data, performance.now());
          if (frame) this.receiveFrame(c, frame);
        }
      };
      channel.onerror = () => { /* Reliable fallback remains available. */ };
      c.on("close", () => { channel.close(); c.decoder?.close(); c.motionDecoder?.close(); });
    } catch { /* Browsers without a second stream retain bounded reliable delivery. */ }
  }
  receiveFrame(c, frame) {
    const decoderKey = frame.motion ? "motionDecoder" : "decoder";
    c[decoderKey] ||= new LatestFrameDecoder(async m => {
      try {
        const decoded = m.t === "frame" ? await this.codec.run("decode", m.bytes) : m.state;
        if (this.closed || this.connection !== c) return;
        const history = m.motion ? this.motionSnapshots : this.snapshots;
        const ackKey = m.motion ? "receivedMotionSequence" : "receivedSequence";
        const compact = history.decode(decoded, m.seq);
        if (!compact) { this[ackKey] = 0; return; }
        let state;
        if (m.motion) {
          if (!completeMotion(compact)) throw new Error("Incomplete motion snapshot");
          // The full world establishes the epoch and collision state. A hot
          // join never renders actors against a missing or different arena.
          if (!this.worldState || this.worldState.round !== compact.round || this.worldState.arenaIndex !== compact.arenaIndex) return;
          const expanded = await this.codec.run("motion", compact);
          if (this.closed || this.connection !== c) return;
          if (this.worldState.round !== expanded.round || this.worldState.arenaIndex !== expanded.arenaIndex) return;
          if (!validSnapshot({ ...this.worldState, ...expanded })) throw new Error("Invalid motion snapshot");
          state = mergeMotion(this.worldState, expanded);
          this.motionState = expanded;
        } else {
          const expanded = await this.codec.run("expand", compact);
          if (this.closed || this.connection !== c) return;
          if (!validSnapshot(expanded)) throw new Error("Invalid snapshot");
          this.worldState = expanded;
          this.emit("onWorldState", this.worldState);
          state = mergeMotion(this.worldState, this.motionState);
        }
        history.remember(m.seq, compact);
        this[ackKey] = m.seq;
        const now = performance.now(), stats = this.streamStats;
        stats.lastBytes = m.bytes?.byteLength || 0;
        stats[m.motion ? "motionBytes" : "worldBytes"] = stats.lastBytes;
        this.chat.setRound(state.round);
        if (!this.emittedState || state.round !== this.emittedState.round || state.arenaIndex !== this.emittedState.arenaIndex || state.time > this.emittedState.time) {
          if (this.lastFrameAt !== undefined) {
            stats.lastGapMs = Math.round(now - this.lastFrameAt);
            stats.maxGapMs = Math.max(stats.maxGapMs, stats.lastGapMs);
          }
          this.lastFrameAt = now; stats.received++;
          this.emittedState = state; this.emit("onState", state);
        }
      } catch {
        this.emit("onNotice", "A game update could not be read. Waiting for the next update.");
      } finally {
        if (m.ack) this.send(c, { t: "ack", seq: m.seq, stateAck: this.receivedSequence });
      }
    });
    if (c[decoderKey].pending && frame.seq > c[decoderKey].last) this.streamStats.skipped++;
    c[decoderKey].push(frame);
  }
  acknowledgeState(c, seq, motion = false) {
    const key = motion ? "motionAck" : "stateAck", sent = motion ? c.sentMotionStates : c.sentStates;
    if (seq === 0) { c[key] = 0; return; }
    if (Number.isInteger(seq) && seq > (c[key] || 0) && sent?.has(seq)) c[key] = seq;
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
    this.setupRealtime(c);
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
          "Game versions differ. Update both games, then use a new invite.",
        );
      if (this.connections.size >= 3)
        return reject("room-full", "This room is full (4 players).");
      const available = [1, 2, 3].find((n) => allowsPlayer(this.slots[n]) && !this.connections.has(n));
      if (available === undefined) return reject("room-full", "No player slots are open in this room.");
      id = available;
      this.connections.set(id, c);
      this.appliedInputs[id] = 0;
      const profile = availableProfile(
        c.metadata?.profile,
        this.roster,
        defaultProfile(id),
      );
      this.roster.push({ id, ...profile });
      this.syncChatRoles();
      c.frameSequence = 0;
      c.frameAck = 0;
      c.frameSentAt = 0;
      c.inFlight = [];
      c.sentStates = new Set();
      this.send(c, {
        t: "welcome",
        id,
        code: this.code,
        protocol: PROTOCOL,
        running: this.running,
        players: this.roster,
        slots: this.slots,
        chatRound: this.chat.round,
        chat: this.chat.snapshot(),
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
        if (realtimeOpen(c)) return;
        if (!validInputSequence(m.seq) || m.seq <= (c.inputSequence || 0)) return;
        this.acknowledgeState(c, m.stateAck); this.acknowledgeState(c, m.motionAck, true);
        c.inputSequence = m.seq;
        c.inputDelivery ||= new InputDelivery(); c.inputDelivery.receive(m.edges, m.seq);
        this.lastInputs[id] = cleanInput(m.input);
        this.inputTimes[id] = performance.now();
      }
      if (m.t === "profile") this.assignProfile(id, m.profile);
      if (m.t === "chat") this.acceptChat(id, m.text);
      if (m.t === "ack" && Number.isInteger(m.seq) && m.seq > c.frameAck && m.seq <= c.frameSequence) {
        this.acknowledgeState(c, m.stateAck);
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
  joinConnection(c) {
    return new Promise((resolve, reject) => {
      let welcomed = false,
        settled = false;
      this.connection = c;
      this.diagnostics.watch(c, "outgoing");
      this.setupRealtime(c);
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
        fail(Object.assign(new Error(this.connectionTimeout(c)), { type: "connection-timeout" }));
      }, 25000);
      c.on("open", () => this.emit("onStatus", "Joining roomâ€¦"));
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
                  "The host has an older game open. Update both games, then use a new invite.",
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
          this.syncChatRoles();
          welcomed = settled = true;
          this.clear(t);
          this.joinReject = null;
          this.id = m.id;
          this.running = m.running === true;
          this.chat.setRound(m.chatRound);
          if (Array.isArray(m.chat) && m.chat.length <= 4)
            for (const message of m.chat) this.receiveChat(message);
          this.profile = cleanProfile(
            this.roster.find((p) => p.id === this.id),
          );
          this.emit("onRoster", this.roster);
          this.emit(this.running ? "onStart" : "onLobby");
          resolve();
        }
        if (!welcomed) return;
        if (m.t === "chat" && this.running) this.receiveChat(m);
        if (m.t === "removed") {
          this.emit("onError", typeof m.reason === "string" ? m.reason.slice(0, 120) : "The host removed your slot.");
          return;
        }
        if (m.t === "roster" && validSlots(m.slots) && this.receiveRoster(m.players)) {
          this.slots = [...m.slots];
          this.syncChatRoles();
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
          this.receiveFrame(c, { ...m, ack: true });
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
    this.syncChatRoles();
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
    this.syncChatRoles();
    this.broadcast({ t: "roster", players: this.roster, slots: this.slots });
    this.emit("onRoster", this.roster);
  }
  syncChatRoles() {
    const active = activeSlots(this.slots, this.roster);
    this.chat.retain(active.filter(p => !this.chatRoles.has(p.id) || this.chatRoles.get(p.id) === p.bot).map(p => p.id));
    this.chatRoles = new Map(active.map(p => [p.id, p.bot]));
  }
  receiveChat(message) {
    if (!activeSlots(this.slots, this.roster).some(p => p.id === message?.id)) return false;
    return this.chat.receive(message);
  }
  sendBotChat(id, text) {
    if (!this.host || !this.running || this.closed ||
      !activeSlots(this.slots, this.roster).some(p => p.id === id && p.bot) ||
      !this.latestState?.players.some(p => p.id === id && p.bot && p.alive)) return false;
    const message = this.chat.publish(id, text);
    if (!message) return false;
    this.broadcast({ t: "chat", ...message });
    return true;
  }
  acceptChat(id, text) {
    if (!this.host || !this.running || this.closed || !this.roster.some(p => p.id === id) ||
      typeof text !== "string" || text.length > CHAT_LIMIT) return false;
    const message = this.chat.publish(id, text);
    if (!message) return false;
    this.broadcast({ t: "chat", ...message });
    return true;
  }
  sendChat(value) {
    const text = cleanChat(value), now = performance.now();
    if (!this.running || this.closed || !text || now < this.nextChatAt) return false;
    if (this.host) return this.acceptChat(this.id, text);
    if (!this.connection?.open) return false;
    this.nextChatAt = now + CHAT_COOLDOWN;
    this.send(this.connection, { t: "chat", text });
    return true;
  }
  sendInput(input) {
    if (!this.running) return;
    const c = this.connection, channel = c?.realtime;
    const m = { t: "input", seq: ++this.inputSequence, stateAck: this.receivedSequence,
      motionAck: this.receivedMotionSequence, input: cleanInput(input) };
    m.edges = this.inputDelivery.capture(m.input, m.seq);
    if (realtimeOpen(c)) {
      if (channel.bufferedAmount < 1000) try { channel.send(JSON.stringify(m)); } catch { /* Next input replaces it. */ }
    } else if (!c?.bufferSize && (c?.dataChannel?.bufferedAmount || 0) < 1000) this.send(c, m);
    return m.seq;
  }
  getInputs(now = performance.now(), consume = true) {
    const out = {};
    for (const id in this.lastInputs) {
      const c = this.connections.get(Number(id)), stale = now - (this.inputTimes[id] || 0) >= 700;
      if (consume) this.appliedInputs[id] = c?.inputSequence || 0;
      const input = stale ? cleanInput(null) : this.lastInputs[id];
      out[id] = consume && c?.inputDelivery ? c.inputDelivery.sample(input, stale) : input;
    }
    return out;
  }
  async sendState(state) {
    if (!this.host || !this.running || this.closed) return;
    this.latestState = state;
    this.chat.setRound(state.round);
    if (this.encoding) return;
    const now = performance.now();
    const ready = [...this.connections.values()].filter(
      (c) =>
        c.open &&
        now >= (c.nextFrameAt || 0) &&
        (realtimeOpen(c)
          ? c.realtime.bufferedAmount === 0
          : !c.bufferSize && (c.dataChannel?.bufferedAmount || 0) < 16384 &&
            (c.inFlight.length < 4 || now - c.frameSentAt > 1200)),
    );
    const motionReady = [...this.connections.values()].filter(c => c.open && realtimeOpen(c) &&
      !c.realtime.bufferedAmount && now >= (c.nextMotionAt || 0));
    if (!ready.length && !motionReady.length) return;
    this.encoding = true;
    const encodeAt = performance.now();
    try {
      const view = { ...this.renderSnapshots.make(ready.length ? state : motionState(state)), inputAcks: [...this.appliedInputs] };
      const motion = compactFlights(motionState(view));
      state = ready.length ? compactSnapshot(view) : null;
      const seq = ++this.sequence;
      const encodings = new Map();
      const jobs = [...motionReady.map(c => ({ c, fast: true })), ...ready.map(c => ({ c, fast: false }))];
      const deliveries = await Promise.all(jobs.map(async ({ c, fast }) => {
        const history = fast ? this.motionSnapshots : this.snapshots;
        const envelope = history.encode(fast ? motion : state, (fast ? c.motionAck : c.stateAck) || 0);
        const compressed = this.compression && c.metadata?.compression;
        const key = `${fast}:${envelope.base}:${compressed}`;
        if (!encodings.has(key)) encodings.set(key, compressed ? this.codec.run("encode", envelope) : envelope);
        return { c, fast, value: await encodings.get(key), compressed };
      }));
      if (this.closed) return;
      if (state) this.snapshots.remember(seq, state);
      if (motionReady.length) this.motionSnapshots.remember(seq, motion);
      this.streamStats.encodeMs = Math.round(performance.now() - encodeAt);
      this.streamStats.maxEncodeMs = Math.max(this.streamStats.maxEncodeMs || 0, this.streamStats.encodeMs);
      this.streamStats.sent = (this.streamStats.sent || 0) + 1;
      const permitted = new Set([...ready, ...motionReady].filter(c => !realtimeOpen(c) || !c.realtime.bufferedAmount));
      for (const { c, fast, value, compressed } of deliveries) {
        if (!c.open || ![...this.connections.values()].includes(c)) continue;
        const packets = compressed ? framePackets(value, seq, fast) : null;
        const history = fast ? this.motionSnapshots : this.snapshots, sentKey = fast ? "sentMotionStates" : "sentStates";
        c[sentKey] ||= new Set(); c[sentKey].add(seq);
        for (const old of c[sentKey]) if (!history.states.has(old)) c[sentKey].delete(old);
        if (packets && realtimeOpen(c)) {
          if (permitted.has(c)) {
            try { for (const packet of packets) c.realtime.send(packet); }
            catch { /* Drop the frame; the next complete one is independent. */ }
            c[fast ? "nextMotionAt" : "nextFrameAt"] = performance.now() +
              (value.byteLength + packets.length * 10) * 1000 / (fast ? MOTION_BYTES_PER_SECOND : STATE_BYTES_PER_SECOND);
          }
          continue;
        }
        if (fast) continue;
        if (now - c.frameSentAt > 1200) c.inFlight = [];
        c.inFlight.push(seq);
        c.frameSequence = seq;
        c.frameSentAt = performance.now();
        const bytes = compressed ? value.byteLength : new TextEncoder().encode(JSON.stringify(value)).byteLength;
        c.nextFrameAt = c.frameSentAt + bytes * 1000 / STATE_BYTES_PER_SECOND;
        this.send(
          c,
          compressed
            ? { t: "frame", seq, bytes: value }
            : { t: "state", seq, state: value },
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
      ...this.transportReport(),
      role: this.host ? "host" : "guest",
      roomClosed: this.closed,
      roomService: this.roomServiceAtClose || this.roomServiceState(),
      realtime: {
        ...this.streamStats,
        channels: (this.host ? [...this.connections.values()] : [this.connection]).filter(Boolean).map(c => ({
          transport: realtimeOpen(c) ? "unordered" : "reliable-fallback",
          queuedBytes: c.realtime?.bufferedAmount || c.dataChannel?.bufferedAmount || 0,
        })),
      },
      ...this.diagnostics.report(),
    };
  }
  roomServiceState() { return "not-open"; }
  transportReport() { return {}; }
  openRealtimeChannel() { return null; }
  closeTransport() {}
  connectionTimeout() { return "The room did not answer. Ask the host to update the game and send a new invite."; }
  close() {
    if (this.closed) return;
    this.roomServiceAtClose = this.roomServiceState();
    this.closed = true;
    this.codec.stop(); this.snapshots.states.clear(); this.motionSnapshots.states.clear();
    this.worldState = this.motionState = this.emittedState = null;
    this.chat.reset();
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
    this.closeTransport();
  }}

const finite = (n) =>
  typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 10000000;
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const action = value => value === undefined || typeof value === "string" && value.length <= 54 &&
  /^\d+:\d+:[0-3]:\d+$/.test(value) && value.split(":").every(n => Number.isSafeInteger(Number(n)));
const weaponTypes = Object.keys(WEAPONS);
const list = (value, max, check) =>
  Array.isArray(value) &&
  value.length <= max &&
  value.every((v) => v && typeof v === "object" && check(v));
const xy = (p) => finite(p.x) && finite(p.y);
const strands = value => list(value,10,s => list(s.points,6,xy) && s.points.length===6) && value.length===10;
const matter = c => c && c.kind === "matter" && xy(c) && integer(c.id,1,1000000) &&
  [c.w,c.h,c.angle,c.hp,c.packing,c.mass].every(finite) && c.w>=42 && c.w<=140 && c.h===c.w &&
  c.hp>=0 && c.hp<=120 && c.packing>=0 && c.packing<=1 && c.mass>0 && c.mass<=1000000 &&
  Array.isArray(c.totals) && c.totals.length===MATTER_KINDS.length && c.totals.every(n=>integer(n,0,1000000)) &&
  list(c.items,MATTER_LIMIT,q=>xy(q) && integer(q.id,1,1000000) && MATTER_KINDS.includes(q.kind) && [q.angle,q.size].every(finite) && q.size>0 && q.size<=16 &&
    typeof q.color==="string" && /^#[0-9a-f]{6}$/i.test(q.color) &&
    (q.kind!=="fighter" || (validAppearance(q) && [1,-1].includes(q.facing))) &&
    (q.type===null || weaponTypes.includes(q.type)) && (q.sourceKind===null || COVER_KINDS.includes(q.sourceKind))) &&
  new Set(c.items.map(q=>q.id)).size===c.items.length;
const propShape = shape => {
  if (shape === undefined) return true;
  if (!Array.isArray(shape) || shape.length < 3 || shape.length > 9 ||
    !shape.every(p => Array.isArray(p) && p.length === 2 && p.every(n=>finite(n)&&Math.abs(n)<=.5))) return false;
  let sign=0, area=0;
  for(let i=0;i<shape.length;i++) {
    const a=shape[i],b=shape[(i+1)%shape.length],c=shape[(i+2)%shape.length];
    const turn=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
    if(Math.abs(turn)<.0001 || (sign && Math.sign(turn)!==sign)) return false;
    sign=Math.sign(turn);area+=a[0]*b[1]-a[1]*b[0];
  }
  return Math.abs(area)>.12;
};
const propSourceArt = b => {
  if(b.sourceArt === undefined) return true;
  const a=b.sourceArt;
  return (b.chunk || b.sourceChunk) && Array.isArray(b.shape) && Array.isArray(a) && a.length===6 && a.every(finite) &&
    a[0]>=0 && a[1]>=0 && a[2]>0 && a[3]>0 && a[4]>0 && a[4]<=250 && a[5]>0 && a[5]<=200 &&
    a[0]+a[2]<=a[4]+.02 && a[1]+a[3]<=a[5]+.02;
};
const physicalProp = c => validReactionObject(c) && propSourceArt(c) && xy(c) && typeof c.id === "string" && c.id.length > 0 && c.id.length <= 80 &&
  [c.w,c.h,c.hp,c.maxHp,c.vx,c.vy,c.angle,c.spin,c.mass,c.dx,c.dy].every(finite) &&
  c.w > 0 && c.w <= 250 && c.h > 0 && c.h <= 200 && c.hp >= 0 && c.hp <= c.maxHp && c.maxHp <= 200 &&
  c.mass > 0 && c.mass <= 250 && Math.abs(c.vx) <= 1500.01 && Math.abs(c.vy) <= 1500.01 &&
  Math.abs(c.angle) <= Math.PI+.01 && Math.abs(c.spin) <= 18.01 && COVER_KINDS.includes(c.kind) &&
  typeof c.material === "string" && Object.hasOwn(PROP_MATERIALS,c.material) && propShape(c.shape);
export function validSnapshot(s) {
  return (
    (s?.inputAcks === undefined || Array.isArray(s.inputAcks) && s.inputAcks.length === 4 && s.inputAcks.every(validInputSequence)) &&
    !!s &&
    typeof s === "object" &&
    validReactions(s) &&
    ["countdown", "fight", "result"].includes(s.phase) &&
    integer(s.arenaIndex, 0, ARENAS.length - 1) &&
    integer(s.round, 1, Number.MAX_SAFE_INTEGER) &&
    [s.phaseTime, s.elapsed, s.time].every(finite) &&
    (s.winner === null || integer(s.winner, 0, 3)) &&
    validVictoryCause(s.victoryCause) &&
    list(
      s.players,
      4,
      (p) =>
        integer(p.id, 0, 3) &&
        (p.motion === undefined || validMotion(p.motion)) &&
        validProfile(p) &&
        validReactionObject(p) &&
        typeof p.bot === "boolean" &&
        integer(p.occupant, 0, Number.MAX_SAFE_INTEGER) &&
        integer(p.actionSerial, 0, Number.MAX_SAFE_INTEGER) &&
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
        (p.strands === undefined || (strands(p.strands) && [p.targetX,p.targetY].every(finite))) &&
        integer(p.comboStep, 0, 2) &&
        ["punch", "kick", "spin", "weapon"].includes(p.meleeMove) &&
        integer(p.ammo, 0, 100) &&
        p.parryCooldown >= 0 && p.parryCooldown <= PARRY.cooldown + 0.01 &&
        p.knockdown>=0 && p.knockdown<=1.8 &&
        p.freeze >= 0 && p.freeze <= 1.2 && p.xray >= 0 && p.xray <= .4 &&
        finite(p.bubble) && p.bubble >= 0 && p.bubble <= 2.4 &&
        validTransmutation(p) &&
        p.burn >= 0 && p.burn <= 3 &&
        p.hp >= 0 &&
        p.hp <= 100 &&
        (p.facing === 1 || p.facing === -1) &&
        typeof p.alive === "boolean" &&
        (p.carryId === null || (typeof p.carryId === "string" && p.carryId.length > 0 && p.carryId.length <= 80 &&
          p.alive && p.weapon === null && p.knockdown === 0 && p.freeze === 0)) &&
        (p.weapon === null || weaponTypes.includes(p.weapon)),
    ) &&
    s.players.length >= 1 &&
    new Set(s.players.map((p) => p.id)).size === s.players.length &&
    list(
      s.platforms,
      1536,
      (p) =>
        xy(p) && validReactionObject(p) &&
        (p.circuit === undefined || (integer(p.circuit,0,1) && p.material === "cable")) &&
        (p.material !== "cable" || integer(p.circuit,0,1)) &&
        (p.waterId === undefined || (integer(p.waterId, 1, 10000000) && p.ice === true && p.material === "ice")) &&
        typeof p.id === "string" && p.id.length <= 160 &&
        (p.sourceId === undefined || (typeof p.sourceId === "string" && p.sourceId.length <= 160)) &&
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
    new Set(s.platforms.map(p => p.id)).size === s.platforms.length &&
    list(s.spikes,512,p => xy(p) && finite(p.w) && p.w > 0 && p.w <= 3000) &&
    list(
      s.cover,
      64,
      c => physicalProp(c) && !c.chunk,
    ) &&
    new Set(s.cover.map(c => c.id)).size === s.cover.length &&
    list(s.chunks,CHUNK_LIMIT,c => physicalProp(c) && c.chunk === true) &&
    new Set([...s.cover,...s.chunks].map(c => c.id)).size === s.cover.length+s.chunks.length &&
    s.players.every(p => p.carryId === null || [...s.cover,...s.chunks].some(b => b.id === p.carryId && b.hp > 0)) &&
    new Set(s.players.filter(p => p.carryId).map(p => p.carryId)).size === s.players.filter(p => p.carryId).length &&
    list(
      s.hazards,
      8,
      (h) =>
        integer(h.id, 1, 1000000) &&
        HAZARD_TYPES.includes(h.type) &&
        (h.type !== "powerline" || integer(h.circuit,0,1)) &&
        [h.x, h.y, h.w, h.h, h.warning, h.age, h.duration, h.bodyX, h.bodyY, h.vy].every(
          finite,
        ) &&
        h.w > 0 &&
        h.w <= (h.type === "saw" ? 2400 : h.type === "powerline" ? 1000 : 400) &&
        (h.beltSpeed === undefined || (h.type === "conveyor" && finite(h.beltSpeed) && h.beltSpeed >= 80 && h.beltSpeed <= 800)) &&
        (h.beltForce === undefined || (h.type === "conveyor" && finite(h.beltForce) && h.beltForce >= 100 && h.beltForce <= 3000)) &&
        (h.motionSpeed === undefined || (h.type === "saw" && finite(h.motionSpeed) && h.motionSpeed >= .2 && h.motionSpeed <= 2)) &&
        (h.motionPhase === undefined || (h.type === "saw" && finite(h.motionPhase) && Math.abs(h.motionPhase) <= Math.PI)) &&
        h.h > 0 &&
        h.h <= 300 &&
        h.warning >= 0 &&
        h.warning <= 2 &&
        h.age >= 0 &&
        h.duration >= -0.02 &&
        h.duration <= (h.type === "powerline" ? 7 : 6) &&
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
      MAX_PROJECTILES,
      (p) =>
        xy(p) &&
        [p.vx, p.vy, p.r, p.life].every(finite) &&
        PROJECTILE_KINDS.includes(p.kind) &&
        action(p.action) && (p.shot === undefined || integer(p.shot, 0, 127)) &&
        (p.age === undefined || (finite(p.age) && p.age >= 0)) &&
        validTransmutationProjectile(p) &&
        validExpandedProjectile(p) &&
        (!['bubble', 'boomerang', 'duck'].includes(p.kind) ||
          (p.weapon === p.kind && integer(p.owner, 0, 3) && p.r === WEAPONS[p.kind].r &&
           p.life >= 0 && p.life <= WEAPONS[p.kind].life &&
           (p.returning === undefined || typeof p.returning === "boolean"))),
    ) &&
    list(
      s.fields,
      12,
      (f) =>
        xy(f) &&
        [f.ex, f.ey, f.radius, f.life].every(finite) &&
        action(f.action) &&
        ["arc", "tesla", "blackhole", "shockwave", "phaser", "tether", "cryo", "firework"].includes(f.kind) &&
        (f.kind !== "tesla" || (integer(f.owner,0,3) && f.radius === 0 && f.life <= .14 &&
          list(f.links,7,l => xy(l) && [l.ex,l.ey].every(finite) &&
            Math.abs(l.ex) <= 100000 && Math.abs(l.ey) <= 100000 &&
            typeof l.key === "string" && l.key.length <= 192) && f.links.length >= 1)) &&
        (!["tether", "cryo", "firework"].includes(f.kind) ||
          (integer(f.owner, 0, 3) && f.radius === {tether: 0, cryo: 210, firework: 120}[f.kind] &&
           f.life <= {tether: .18, cryo: .55, firework: .45}[f.kind])) &&
        f.radius >= 0 &&
        f.radius <= (f.kind === "shockwave" ? NUCLEAR.waveRadius : f.kind === "blackhole" ? SINGULARITY.radius : 400) &&
        (f.kind === "arc" || (finite(f.age) && f.age >= 0 && f.age <= 6)) &&
        (f.kind !== "shockwave" ||
          (integer(f.craterId,1,1000000) && typeof f.melted === "boolean")) &&
        (f.kind!=="blackhole" || (integer(f.riftId,1,1000000) && typeof f.torn === "boolean" && (f.matter===undefined || matter(f.matter)))) &&
        (f.kind !== "phaser" || (f.radius === WEAPONS.phaser.radius && f.flare === WEAPONS.phaser.flare &&
          f.life <= WEAPONS.phaser.life && f.age <= WEAPONS.phaser.life &&
          integer(f.owner,0,3) && Math.abs(Math.hypot(f.ex-f.x,f.ey-f.y)-WEAPONS.phaser.range) < .03)) &&
        f.life >= 0 &&
        f.life <= 6,
    ) &&
    list(s.blood,BLOOD_LIMIT,b=>xy(b)&&[b.vx,b.vy,b.r,b.life].every(finite)&&b.r>0&&b.r<=4&&b.life>=0&&b.life<=7&&typeof b.landed==="boolean") &&
    list(s.wreckage,60,w => w.kind === "matter" ? matter(w) : xy(w) && integer(w.id,1,1000000) && [w.w,w.h,w.angle,w.hp].every(finite) &&
      w.w>0 && w.w<=150 && w.h>0 && w.h<=90 && w.hp>=0 && w.hp<=120 && ["platform","trap","prop"].includes(w.kind) &&
      (w.sourceKind==null || COVER_KINDS.includes(w.sourceKind)) &&
      (w.sourceChunk===undefined || typeof w.sourceChunk==="boolean") &&
      (!w.sourceChunk || (w.kind==="prop" && typeof w.material==="string" && Object.hasOwn(PROP_MATERIALS,w.material))) && propShape(w.shape) && propSourceArt(w) &&
      (w.elevator===undefined || typeof w.elevator==="boolean") &&
      (w.spine===undefined||(list(w.spine,6,xy)&&w.spine.length===6&&list(w.outline,12,xy)&&w.outline.length===12))) &&
    list(s.rifts,128,c => xy(c) && integer(c.id,1,1000000) && c.radius===SINGULARITY.radius && finite(c.born)) &&
    list(s.craters,128,c => xy(c) && integer(c.id,1,1000000) &&
      finite(c.radius) && c.radius > 0 && c.radius <= NUCLEAR.coreRadius && finite(c.born) && c.born >= 0 && c.born <= s.time + .01) &&
    new Set(s.craters.map(c=>c.id)).size === s.craters.length &&
    list(
      s.drops,
      20,
      (d) => xy(d) && finite(d.life) && weaponTypes.includes(d.type) && action(d.action),
    ) &&
    list(
      s.ragdolls,
      4,
      (r) =>
        finite(r.life) &&
        (r.deathId === undefined || integer(r.deathId, 0, 10000000)) &&
        (r.ash === undefined || (r.ash === true && finite(r.ashAge) && r.ashAge >= 0 && r.ashAge <= NUCLEAR.ashDuration && [-1,1].includes(r.ashDirection))) &&
        validAppearance(r) &&
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
        action(e.action) &&
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
        (e.at === undefined || (finite(e.at) && e.at >= 0)) &&
        (e.color === undefined ||
          (typeof e.color === "string" && /^#[a-fA-F0-9]{6}$/.test(e.color))),
    )
  );
}
