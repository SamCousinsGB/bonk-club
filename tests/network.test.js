import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Room, validCode, validSnapshot } from "../src/network.js";
import { World } from "../src/engine.js";
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
      queueMicrotask(() => this.emit("error", {type:"unavailable-id"}));
      return;
    }
    FakePeer.peers.set(this.id, this);
    queueMicrotask(() => this.emit("open", this.id));
  }
  connect(id) {
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
test("four peers join, ready, start, send only controls, synchronise state, then recover from disconnect", async () => {
  const state = [],
    ends = [];
  const host = new Room({ onEnd: (r) => ends.push(r) }, FakePeer),
    clients = Array.from(
      { length: 3 },
      () => new Room({ onState: (s) => state.push(s) }, FakePeer),
    );
  try {
    const code = await host.create();
    assert.ok(validCode(code));
    assert.equal(host.start(), false);
    for (const client of clients) await client.join(code);
    await tick();
    assert.equal(host.roster.length, 4);
    assert.equal(host.start(), false);
    for (const c of clients) c.ready(true);
    await tick();
    assert.ok(host.roster.every((p) => p.ready));
    assert.equal(host.start(), true);
    await tick();
    assert.ok(clients.every((c) => c.running));
    clients[0].sendInput({ attack: true, x: 99, hp: 1000 });
    await tick();
    assert.equal(host.getInputs()[1].attack, true);
    assert.equal(host.getInputs()[1].x, undefined);
    assert.equal(host.getInputs(performance.now() + 1000)[1].attack, false);
    const world = new World({ players: [0, 1, 2, 3] });
    host.sendState(world.snapshot());
    await tick();
    assert.equal(state.length, 3);
    assert.deepEqual(state[0].scores, world.scores);
    clients[2].close();
    await tick();
    assert.equal(host.running, false);
    assert.equal(host.roster.length, 3);
    assert.equal(ends.length, 1);
  } finally {
    host.close();
    clients.forEach((c) => c.close());
  }
});
test("a fifth player and late arrivals receive clear rejection", async () => {
  const host = new Room({}, FakePeer),
    clients = Array.from({ length: 4 }, () => new Room({}, FakePeer));
  try {
    const code = await host.create();
    for (const c of clients.slice(0, 3)) await c.join(code);
    await assert.rejects(() => clients[3].join(code), /full/);
    assert.equal(host.roster.length, 4);
    for (const c of clients.slice(0, 3)) c.ready(true);
    await tick();
    host.start();
    const late = new Room({}, FakePeer);
    try {
      await assert.rejects(() => late.join(code), /already started/);
    } finally {
      late.close();
    }
  } finally {
    host.close();
    clients.forEach((c) => c.close());
  }
});
test("invalid codes fail without opening a peer", async () => {
  const c = new Room({}, FakePeer);
  await assert.rejects(() => c.join("bad"), /six-character/);
  assert.equal(c.peer, null);
  c.close();
});
test("public table claims are exclusive and other visitors can join the claimed table",async()=>{
  const host=new Room({},FakePeer),claim=new Room({},FakePeer),guest=new Room({},FakePeer);
  try {await host.create('PUBAAA');await assert.rejects(()=>claim.create('PUBAAA'),error=>error.type==='unavailable-id');claim.close();await guest.join('PUBAAA');guest.ready(true);await tick();assert.equal(host.start(),true);}
  finally {host.close();claim.close();guest.close();}
});
