import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { ConnectionDiagnostics } from "../src/connection-diagnostics.js";

test("connection reports observe candidate exchange and selected routes without exposing private data or replacing handlers", async () => {
  const diagnostics = new ConnectionDiagnostics(),
    pc = new EventTarget();
  const existing = () => {};
  Object.assign(pc, {
    onicecandidate: existing,
    iceConnectionState: "connected",
    iceGatheringState: "complete",
    signalingState: "stable",
    connectionState: "connected",
    localDescription: { type: "offer", sdp: "PRIVATE_SDP" },
    remoteDescription: { type: "answer", sdp: "PRIVATE_SDP" },
    getStats: async () =>
      new Map([
        [
          "local",
          {
            type: "local-candidate",
            candidateType: "host",
            protocol: "udp",
            address: "192.0.2.1",
          },
        ],
        [
          "remote",
          {
            type: "remote-candidate",
            candidateType: "srflx",
            address: "198.51.100.1",
          },
        ],
        [
          "pair",
          {
            type: "candidate-pair",
            nominated: true,
            state: "succeeded",
            localCandidateId: "local",
            remoteCandidateId: "remote",
          },
        ],
      ]),
  });
  const connection = new EventEmitter();
  Object.assign(connection, {
    connectionId: "PRIVATE_CONNECTION_ID",
    peerConnection: pc,
    dataChannel: { readyState: "open" },
  });
  diagnostics.signal({
    type: "CANDIDATE",
    payload: {
      connectionId: connection.connectionId,
      candidate: {
        candidate: "candidate:1 1 UDP 1 198.51.100.1 1234 typ srflx",
      },
    },
  });
  diagnostics.watch(connection, "outgoing");
  try {
    pc.dispatchEvent(
      Object.assign(new Event("icecandidate"), {
        candidate: { candidate: "candidate:1 1 UDP 1 192.0.2.1 1234 typ host" },
      }),
    );
    pc.dispatchEvent(
      Object.assign(new Event("icecandidateerror"), {
        errorCode: 701,
        errorText: "PRIVATE_ERROR",
        url: "turn:PRIVATE_SERVER",
      }),
    );
    diagnostics.error({ type: "webrtc", message: "PRIVATE_ERROR" });
    connection.emit("open");
    await diagnostics.refresh();
    const report = diagnostics.report(),
      r = report.connections[0];
    assert.equal(pc.onicecandidate, existing);
    assert.equal(r.localCandidates.host, 1);
    assert.equal(r.remoteSignaled.srflx, 1);
    assert.equal(r.remoteAccepted.srflx, 1);
    assert.equal(r.localDescription, "offer");
    assert.equal(r.remoteDescription, "answer");
    assert.equal(r.opened, true);
    assert.deepEqual(r.selectedPair, {
      local: "host",
      remote: "srflx",
      protocol: "udp",
    });
    assert.deepEqual(r.errors, [{ gatheringCode: 701 }]);
    assert.doesNotMatch(
      JSON.stringify(report),
      /PRIVATE|192\.0\.2\.1|198\.51\.100\.1/,
    );
    pc.getStats = async () => new Map();
    pc.localDescription = pc.remoteDescription = null;
    connection.emit("close");
    await diagnostics.refresh();
    assert.equal(diagnostics.report().connections[0].remoteAccepted.srflx, 1);
    assert.equal(
      diagnostics.report().connections[0].remoteDescription,
      "answer",
    );
  } finally {
    diagnostics.close();
  }
});

test("diagnostic history is bounded and reports cannot mutate the recorded evidence", () => {
  const diagnostics = new ConnectionDiagnostics();
  for (let n = 0; n < 100; n++) {
    diagnostics.signal({
      type: "CANDIDATE",
      payload: {
        connectionId: String(n),
        candidate: { candidate: "typ relay" },
      },
    });
    diagnostics.error({ type: "network" });
  }
  const report = diagnostics.report();
  assert.equal(report.connections.length, 8);
  assert.equal(report.errors.length, 12);
  report.connections[0].remoteSignaled.relay = 999;
  assert.equal(diagnostics.report().connections[0].remoteSignaled.relay, 1);
  diagnostics.close();
});
