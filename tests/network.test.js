import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  Room,
  validCode,
  validSnapshot,
  PROTOCOL,
  encodeState,
  decodeState,
} from "../src/network.js";
import { World, STEP } from "../src/engine.js";
import { pack, unpack } from "peerjs-js-binarypack";
const tick = () => new Promise((r) => setImmediate(r));
test("host acknowledges applied inputs, rejects stale sequences and never accepts guest movement authority", async () => {
  const states = [], host = new Room({}, FakePeer), guest = new Room({ onState: s => states.push(s) }, FakePeer);
  try {
    await host.create(); await guest.join(host.code); host.start(); await tick();
    const seq = guest.sendInput({ right: true, x: 999, hp: 1000 }); await tick();
    assert.equal(host.appliedInputs[1], 0, "receiving is not an application acknowledgement");
    assert.equal(host.getInputs()[1].right, true);
    assert.equal(host.getInputs()[1].x, undefined);
    assert.equal(host.appliedInputs[1], seq);
    guest.connection.send({ t: "input", seq, input: { left: true } });
    guest.connection.send({ t: "input", seq: Infinity, input: { left: true } }); await tick();
    assert.equal(host.getInputs()[1].right, true);
    await host.sendState(new World().snapshot()); await tick(); await tick();
    assert.equal(states.at(-1).inputAcks[1], seq);
    assert.equal(typeof states.at(-1).players[1].motion.jumpHeld, "boolean");
  } finally { guest.close(); host.close(); }
});
test("host and guest chat is attributed by the host and shared with late arrivals", async () => {
  const host = new Room({}, FakePeer), guest = new Room({}, FakePeer), hot = new Room({}, FakePeer);
  try {
    await host.create(); await guest.join(host.code);
    assert.equal(guest.sendChat("lobby"), false);
    host.start(); await host.sendState(new World().snapshot()); await tick();
    assert.equal(host.sendChat("from host"), true);
    // A guest cannot choose another fighter's id, lifetime or round.
    guest.send(guest.connection, { t: "chat", text: "from guest", id: 0, life: 999999, round: 99 });
    await tick();
    assert.deepEqual(host.chat.snapshot().map(m => [m.id, m.text]), [[0, "from host"], [1, "from guest"]]);
    assert.deepEqual(guest.chat.snapshot().map(m => [m.id, m.text]), [[0, "from host"], [1, "from guest"]]);
    guest.send(guest.connection, { t: "chat", text: "spam" }); await tick();
    assert.equal(host.chat.snapshot()[1].text, "from guest");
    await hot.join(host.code); await tick();
    assert.deepEqual(hot.chat.snapshot().map(m => m.text), ["from host", "from guest"]);
    assert.ok(hot.chat.snapshot().every(m => m.life < 4000));
    guest.close(); await tick();
    assert.ok(host.chat.snapshot().every(m => m.id !== 1));
    assert.ok(hot.chat.snapshot().every(m => m.id !== 1));
    const next = new World().snapshot(); next.round = 2;
    await host.sendState(next); await tick();
    assert.deepEqual(host.chat.snapshot(), []);
  } finally { hot.close(); guest.close(); host.close(); }
});

test("invalid guest chat cannot inject payloads or unbounded speech", async () => {
  const host = new Room({}, FakePeer), guest = new Room({}, FakePeer);
  try {
    await host.create(); await guest.join(host.code); host.start();
    await host.sendState(new World().snapshot()); await tick();
    for (const text of [null, {}, "x".repeat(121), "\u0000\u202e"]) guest.send(guest.connection, { t: "chat", text });
    await tick(); assert.deepEqual(host.chat.snapshot(), []);
    assert.equal(host.receiveChat({ id: 3, text: "unoccupied", life: 4000, round: 1 }), false);
    guest.sendChat("<b>hello</b>"); await tick();
    assert.equal(host.chat.snapshot()[0].text, "<b>hello</b>");
    assert.equal(guest.chat.snapshot()[0].text, "<b>hello</b>");
  } finally { guest.close(); host.close(); }
});
class Connection extends EventEmitter {
  constructor() {
    super();
    this.open = false;
  }
  send(data) {
    const copy = structuredClone(data);
    queueMicrotask(() => {
      if (this.other.open) this.other.emit("data", copy);
    });
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.emit("close");
    if (this.other.open) {
      this.other.open = false;
      this.other.emit("close");
    }
  }
}
class FakePeer extends EventEmitter {
  static peers = new Map();
  constructor(id, options) {
    super();
    this.config = options.config;
    this.options = options;
    this.id = id || "client-" + Math.random();
    if (FakePeer.peers.has(this.id)) {
      queueMicrotask(() => this.emit("error", { type: "unavailable-id" }));
      return;
    }
    FakePeer.peers.set(this.id, this);
    queueMicrotask(() => this.emit("open", this.id));
  }
  connect(id, options) {
    assert.equal(
      options.serialization,
      "binary",
      "running combat requires chunked binary transport",
    );
    assert.equal(options.reliable, true);
    const a = new Connection(),
      b = new Connection();
    b.metadata = options.metadata;
    a.other = b;
    b.other = a;
    queueMicrotask(() => {
      const host = FakePeer.peers.get(id);
      if (!host) return this.emit("error", { type: "peer-unavailable" });
      host.emit("connection", b);
      a.open = b.open = true;
      b.emit("open");
      a.emit("open");
    });
    return a;
  }
  destroy() {
    if (FakePeer.peers.get(this.id) === this) FakePeer.peers.delete(this.id);
  }
}
test("host and guest load relay credentials before creating their peer connection", async (t) => {
  const relay = {
    urls: "turns:relay.example:443?transport=tcp",
    username: "test",
    credential: "test",
  };
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return { ok: true, json: async () => [relay] };
  });
  const options = { iceServersUrl: "https://relay.example/ice" };
  const host = new Room({}, FakePeer, options),
    guest = new Room({}, FakePeer, options);
  try {
    await host.create();
    await guest.join(host.code);
    assert.equal(requests, 2);
    for (const room of [host, guest]) {
      assert.deepEqual(room.peer.config.iceServers.at(-1), {
        ...relay,
        urls: [relay.urls],
      });
    }
  } finally {
    guest.close();
    host.close();
  }
});

test("long-running hosts renew credentials for new arrivals without closing connected players", async (t) => {
  let count = 0;
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => [
      {
        urls: "turn:rooms.example:3478",
        username: `expiry-${++count}`,
        credential: "temporary",
      },
    ],
  }));
  const host = new Room({}, FakePeer, {
    iceServersUrl: "https://rooms.example/ice",
  });
  const guest = new Room({}, FakePeer);
  try {
    await host.create();
    await guest.join(host.code);
    const connection = [...host.connections.values()][0];
    await host.refreshIceConfig();
    assert.equal(
      host.peer.options.config.iceServers.at(-1).username,
      "expiry-2",
    );
    assert.equal(connection.open, true);
    assert.equal(host.connections.size, 1);
  } finally {
    host.close();
    guest.close();
  }
});

test("closing while relay credentials load does not create an abandoned public room", async (t) => {
  let finish;
  t.mock.method(
    globalThis,
    "fetch",
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const room = new Room({}, FakePeer, {
    iceServersUrl: "https://relay.example/ice",
  });
  const before = FakePeer.peers.size;
  const creating = room.create();
  room.close();
  finish({
    ok: true,
    json: async () => [
      { urls: "turn:relay.example:3478", username: "test", credential: "test" },
    ],
  });
  await assert.rejects(creating, /Room closed/);
  assert.equal(FakePeer.peers.size, before);
  assert.equal(room.peer, null);
});

test("room codes and network snapshots are validated", () => {
  assert.ok(validCode("ABC234"));
  assert.ok(!validCode("ABC1234"));
  assert.ok(!validCode("<svg>"));
  assert.ok(validSnapshot(new World().snapshot()));
  assert.ok(!validSnapshot({ players: [] }));
});

test("intentional room cleanup does not falsely report a signaling failure in the saved diagnostics", async () => {
  const room = new Room({}, FakePeer);
  await room.create();
  room.peer.open = true;
  room.close();
  room.peer.disconnected = true;
  const report = room.connectionReport();
  assert.equal(report.roomClosed, true);
  assert.equal(report.roomService, "connected");
});
test("rooms start with one human, hot joins replace AI and departures preserve the running match", async () => {
  let world;
  const states = [];
  const host = new Room(
    {
      onStart: () => {
        world = new World({ players: [0] });
      },
      onRoster: (roster) => {
        if (!world) return;
        for (const p of world.players)
          world.replacePlayer(p.id, !roster.some((q) => q.id === p.id));
        host.sendState(world.snapshot());
      },
    },
    FakePeer,
  );
  const clients = Array.from(
    { length: 4 },
    () => new Room({ onState: (s) => states.push(s) }, FakePeer),
  );
  try {
    const code = await host.create();
    assert.equal(host.running, false);
    host.start();
    assert.ok(host.running);
    assert.equal(world.players.filter((p) => p.bot).length, 3);
    world.phase = "fight";
    world.elapsed = 32;
    world.round = 7;
    world.scores = [8, 6, 4, 2];
    for (const c of clients.slice(0, 3)) await c.join(code);
    await tick();
    assert.equal(host.roster.length, 4);
    assert.ok(clients.slice(0, 3).every((c) => c.running));
    assert.equal(world.players.filter((p) => p.bot).length, 0);
    assert.equal(world.round, 7);
    assert.equal(world.elapsed, 32);
    assert.deepEqual(world.scores, [8, 0, 0, 0]);
    assert.ok(states.some((s) => s.round === 7));
    await assert.rejects(() => clients[3].join(code), /full/);
    clients[0].sendInput({ attack: true, x: 99, hp: 1000 });
    await tick();
    assert.equal(host.getInputs()[1].attack, true);
    assert.equal(host.getInputs()[1].x, undefined);
    assert.equal(host.getInputs(performance.now() + 1000)[1].attack, false);
    world.scores = [8, 12, 3, 2];
    const oldConnection = host.connections.get(1);
    clients[0].close();
    await tick();
    assert.ok(host.running);
    assert.ok(world.players[1].bot);
    assert.deepEqual(world.scores, [8, 0, 3, 2]);
    assert.equal(world.round, 7);
    assert.equal(host.getInputs()[1], undefined);
    const replacement = new Room({}, FakePeer);
    try {
      await replacement.join(code);
      await tick();
      assert.equal(replacement.id, 1);
      assert.equal(world.players[1].bot, false);
      assert.equal(world.players[1].occupant, 3);
      oldConnection.emit("data", { t: "input", input: { attack: true } });
      oldConnection.emit("close");
      assert.equal(host.getInputs()[1], undefined);
      assert.equal(host.connections.size, 3);
      assert.equal(world.players[1].bot, false);
    } finally {
      replacement.close();
    }
  } finally {
    host.close();
    clients.forEach((c) => c.close());
  }
});

test("a late join gets the current snapshot immediately without a start or ready message", async () => {
  let received;
  const host = new Room({}, FakePeer),
    guest = new Room({ onState: (s) => (received = s) }, FakePeer);
  try {
    const code = await host.create();
    host.start();
    const world = new World({ players: [0] });
    world.round = 14;
    world.phase = "fight";
    host.sendState(world.snapshot());
    await guest.join(code);
    await tick();
    assert.equal(guest.running, true);
    assert.equal(received.round, 14);
  } finally {
    host.close();
    guest.close();
  }
});

test("invalid codes fail without opening a peer", async () => {
  const c = new Room({}, FakePeer);
  await assert.rejects(() => c.join("bad"), /six-character/);
  assert.equal(c.peer, null);
  c.close();
});
test("public table claims are exclusive and other visitors can join the claimed table", async () => {
  const host = new Room({}, FakePeer),
    claim = new Room({}, FakePeer),
    guest = new Room({}, FakePeer);
  try {
    await host.create("PUBAAA");
    host.start();
    await assert.rejects(
      () => claim.create("PUBAAA"),
      (error) => error.type === "unavailable-id",
    );
    claim.close();
    await guest.join("PUBAAA");
    await tick();
    assert.equal(host.running, true);
    assert.equal(guest.running, true);
  } finally {
    host.close();
    claim.close();
    guest.close();
  }
});

test("large combat snapshots survive the binary wire format and still pass validation", async () => {
  const w = new World({
    players: [0, 1, 2, 3],
    bots: [0, 1, 2, 3],
    arena: 8,
    random: () => 0.45,
  });
  let large = false;
  for (let n = 0; n < 120 * 12; n++) {
    w.step(STEP);
    if (n % 30 !== 0) continue;
    const snapshot = w.snapshot();
    const encoded = await pack({ t: "state", state: snapshot });
    const decoded = unpack(encoded);
    large ||= JSON.stringify(snapshot).length > 16300;
    assert.ok(validSnapshot(decoded.state));
    assert.deepEqual(decoded.state.scores, snapshot.scores);
    assert.equal(decoded.state.players.length, 4);
  }
  assert.ok(
    large,
    "exercise a real combat state larger than the old channel limit",
  );
});

test("pregame lobby shares profiles, reserves colours and starts all guests without ready checks", async () => {
  let started = 0;
  const host = new Room({ onStart: () => started++ }, FakePeer, {
    profile: { name: "Sam", color: "#bc9bff", hair: "Mohawk" },
  });
  const guest = new Room({ onStart: () => started++ }, FakePeer, {
    profile: { name: "Friend", color: "#bc9bff", hair: "Bob" },
  });
  try {
    const code = await host.create();
    await guest.join(code);
    await tick();
    assert.equal(started, 0);
    assert.equal(host.running, false);
    assert.equal(guest.running, false);
    assert.equal(host.roster.length, 2);
    assert.equal(guest.roster[0].name, "Sam");
    assert.equal(guest.roster[1].name, "Friend");
    assert.notEqual(guest.roster[0].color, guest.roster[1].color);
    guest.setProfile({
      name: "New name",
      hair: "Afro",
      hairColor: "#f2d17a",
      facialHair: "Moustache",
      accessory: "Sunglasses",
      color: "#ff9b58",
      id: 0,
      hp: 999,
    });
    await tick();
    assert.equal(host.roster[1].name, "New name");
    for (const roster of [host.roster, guest.roster]) {
      assert.equal(roster[1].hairColor, "#f2d17a");
      assert.equal(roster[1].facialHair, "Moustache");
      assert.equal(roster[1].accessory, "Sunglasses");
    }
    assert.equal(host.roster[0].name, "Sam");
    assert.equal(host.roster[1].hp, undefined);
    assert.equal(guest.start(), false);
    host.start();
    await tick();
    assert.equal(started, 2);
    assert.ok(guest.running);
    assert.equal(host.start(), false);
  } finally {
    guest.close();
    host.close();
  }
});

test("compressed combat frames survive the real binary wire format and are much smaller", async () => {
  const w = new World({ players: [0], arena: 21 });
  for (let n = 0; n < 60; n++) w.step(STEP);
  const state = w.snapshot(),
    bytes = await encodeState(state),
    wire = unpack(await pack({ t: "frame", seq: 1, bytes }));
  const decoded = await decodeState(wire.bytes);
  assert.ok(validSnapshot(decoded));
  assert.deepEqual(decoded, state);
  assert.ok(bytes.length < JSON.stringify(state).length * 0.4);
  await assert.rejects(() => decodeState(new Uint8Array([1, 2, 3])));
});

test("slow guest acknowledgements prevent an unbounded snapshot queue and the next frame is current", async () => {
  const got = [];
  const host = new Room({}, FakePeer),
    guest = new Room({ onState: (s) => got.push(s.round) }, FakePeer);
  try {
    const code = await host.create();
    host.start();
    await guest.join(code);
    await tick();
    const send = guest.connection.send.bind(guest.connection);
    guest.connection.send = (m) => {
      if (m.t !== "ack") send(m);
    };
    const w = new World();
    for (let round = 1; round <= 30; round++) {
      w.round = round;
      // Isolate the acknowledgement window from the separate bandwidth pacing.
      host.connections.get(1).nextFrameAt = 0;
      await host.sendState(w.snapshot());
      await tick();
    }
    assert.deepEqual(got, [1, 2, 3, 4]);
    const c = host.connections.get(1);
    send({ t: "ack", seq: c.frameSequence });
    await tick();
    c.nextFrameAt = 0;
    await host.sendState(w.snapshot());
    await tick();
    assert.deepEqual(got, [1, 2, 3, 4, 30]);
    c.dataChannel = { bufferedAmount: 200000 };
    send({ t: "ack", seq: c.frameSequence });
    await tick();
    w.round = 31;
    await host.sendState(w.snapshot());
    await tick();
    assert.deepEqual(got, [1, 2, 3, 4, 30]);
  } finally {
    guest.close();
    host.close();
  }
});

test("bandwidth pacing sends current state at the next opportunity instead of accumulating frames", async t => {
  const got=[],host=new Room({},FakePeer),guest=new Room({onState:s=>got.push(s.round)},FakePeer);
  try {
    await host.create();host.start();await guest.join(host.code);await tick();
    let now=1000;t.mock.method(performance,"now",()=>now);
    const w=new World();await host.sendState(w.snapshot());await tick();
    const c=host.connections.get(1);assert.ok(c.nextFrameAt>now);
    for(let n=2;n<=100;n++){w.round=n;await host.sendState(w.snapshot());}
    await tick();assert.deepEqual(got,[1]);
    now=c.nextFrameAt+1;await host.sendState(w.snapshot());await tick();assert.deepEqual(got,[1,100]);
  } finally {guest.close();host.close();}
});

test("negotiated disposable stream carries validated state and sequenced bounded controls, with reliable fallback", async () => {
  const got=[],host=new Room({},FakePeer),guest=new Room({onState:s=>got.push(s.round)},FakePeer);
  try {
    await host.create();host.start();await guest.join(host.code);await tick();
    const h=host.connections.get(1),g=guest.connection;
    const channels=[0,1].map(i=>({readyState:"open",bufferedAmount:0,close(){this.readyState="closed";},send(data){
      const copy=ArrayBuffer.isView(data)?data.slice().buffer:structuredClone(data);
      queueMicrotask(()=>channels[1-i].onmessage({data:copy}));
    }}));
    for(const [i,c] of [h,g].entries())c.peerConnection={createDataChannel(label,options){
      assert.deepEqual(options,{negotiated:true,id:2,ordered:false,maxRetransmits:0});return channels[i];
    }};
    host.compression=guest.compression=true;h.metadata.compression=true;
    host.setupRealtime(h);guest.setupRealtime(g);channels[0].onopen();channels[1].onopen();await tick();
    assert.ok(h.realtimeReady&&g.realtimeReady);
    const w=new World();w.round=20;await host.sendState(w.snapshot());await tick();await g.decoder.done;
    assert.deepEqual(got,[20]);assert.equal(h.inFlight.length,0);
    guest.sendInput({right:true,hp:0,x:10000});await tick();assert.equal(host.getInputs()[1].right,true);assert.equal(host.lastInputs[1].hp,undefined);
    channels[1].send(JSON.stringify({t:"input",seq:1,input:{left:true}}));await tick();assert.equal(host.getInputs()[1].right,true);
    channels[1].send(JSON.stringify({t:"state",seq:999,state:{hp:0}}));await tick();assert.equal(host.getInputs()[1].right,true);
    channels[0].close();channels[1].close();h.nextFrameAt=0;w.round=21;await host.sendState(w.snapshot());await tick();await g.decoder.done;
    assert.deepEqual(got,[20,21]);
  } finally {guest.close();host.close();}
});

test("host slot modes reserve bots, skip closed slots and admit hot joins only to player slots", async () => {
  const host = new Room({}, FakePeer), guest = new Room({}, FakePeer), extra = new Room({}, FakePeer);
  try {
    const code = await host.create();
    assert.equal(host.setSlot(0, "closed"), false);
    assert.equal(host.setSlot(1, "invalid"), false);
    host.setSlot(1,"ai");host.setSlot(2,"closed");host.setSlot(3,"player");
    host.start();
    await guest.join(code);await tick();
    assert.equal(guest.id,3);
    assert.deepEqual(guest.slots,["player","ai","closed","player"]);
    assert.equal(guest.setSlot(1,"mixed"),false);
    guest.send(guest.connection,{t:"slots",slots:["player","mixed","mixed","mixed"]});
    await tick();
    assert.deepEqual(host.slots,["player","ai","closed","player"]);
    assert.equal(host.setSlot(1,"closed"),false,"slot setup is locked during combat");
    await assert.rejects(()=>extra.join(code),/No player slots/);
    guest.close();await tick();
    assert.deepEqual(host.roster.map(p=>p.id),[0]);
    assert.equal(host.slots[3],"player");
  } finally {extra.close();guest.close();host.close();}
});

test("host can close an occupied lobby slot and cannot start without an opponent", async () => {
  const notices=[];
  const host=new Room({},FakePeer),guest=new Room({onError:s=>notices.push(s)},FakePeer);
  try {
    const code=await host.create();await guest.join(code);await tick();
    host.setSlot(1,"player");await tick();
    assert.deepEqual(guest.slots,["player","player","mixed","mixed"]);
    assert.equal(host.roster.length,2);
    host.setSlot(1,"closed");host.setSlot(2,"closed");host.setSlot(3,"closed");
    await tick();
    assert.deepEqual(host.roster.map(p=>p.id),[0]);
    assert.ok(notices.some(s=>s.includes("host changed your slot to Closed")));
    assert.equal(host.start(),false);
    host.setSlot(2,"ai");assert.equal(host.start(),true);
  } finally {guest.close();host.close();}
});

test("outdated clients are rejected explicitly without occupying a player slot", async () => {
  const host = new Room({}, FakePeer),
    guest = new Room({}, FakePeer);
  try {
    const code = await host.create();
    const original = FakePeer.prototype.connect;
    FakePeer.prototype.connect = function (id, options) {
      return original.call(this, id, {
        ...options,
        metadata: { ...options.metadata, protocol: PROTOCOL - 1 },
      });
    };
    try {
      await assert.rejects(
        () => guest.join(code),
        (e) => e.type === "version-mismatch",
      );
      assert.equal(host.roster.length, 1);
      assert.equal(host.connections.size, 0);
    } finally {
      FakePeer.prototype.connect = original;
    }
  } finally {
    guest.close();
    host.close();
  }
});

test("signaling reconnect keeps an established room and its guest alive", async () => {
  const host = new Room({}, FakePeer),
    guest = new Room({}, FakePeer);
  try {
    const code = await host.create();
    await guest.join(code);
    host.peer.disconnected = true;
    host.peer.reconnect = () => {
      host.peer.disconnected = false;
      host.peer.emit("open", host.peer.id);
    };
    const later = host.later.bind(host);
    host.later = (fn, ms) => later(fn, ms === 1000 ? 1 : ms);
    host.peer.emit("disconnected");
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(host.peer.disconnected, false);
    assert.equal(host.code, code);
    assert.equal(host.connections.size, 1);
    assert.equal(guest.connection.open, true);
  } finally {
    guest.close();
    host.close();
  }
});

test("a guest keeps its data channel when only the signaling service has a transient error", async () => {
  let ended = false;
  const host = new Room({}, FakePeer),
    guest = new Room({ onError: () => (ended = true) }, FakePeer);
  try {
    const code = await host.create();
    await guest.join(code);
    guest.peer.emit("error", { type: "network" });
    await tick();
    assert.equal(ended, false);
    assert.equal(guest.connection.open, true);
  } finally {
    guest.close();
    host.close();
  }
});
