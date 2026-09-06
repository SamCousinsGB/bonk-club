import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Room, validCode, validSnapshot } from "../src/network.js";
import { World, STEP } from "../src/engine.js";
import { pack, unpack } from "peerjs-js-binarypack";
const tick = () => new Promise((r) => setImmediate(r));
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
  constructor(id) {
    super();
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
test("room codes and network snapshots are validated", () => {
  assert.ok(validCode("ABC234"));
  assert.ok(!validCode("ABC1234"));
  assert.ok(!validCode("<svg>"));
  assert.ok(validSnapshot(new World().snapshot()));
  assert.ok(!validSnapshot({ players: [] }));
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
