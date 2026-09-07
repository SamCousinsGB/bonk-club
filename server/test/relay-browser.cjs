const { chromium } = require(process.env.BONK_PLAYWRIGHT || "playwright");
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const bundle = fs.readFileSync(
  __dirname + "/../../node_modules/peerjs/dist/peerjs.min.js",
  "utf8",
);
const endpoint = new URL(process.env.ROOM_SERVICE_URL);
assert.equal(endpoint.protocol, "https:");
assert.equal(endpoint.pathname, "/peerjs");
const hostname = endpoint.hostname;
(async () => {
  const browsers = await Promise.all(
    [0, 1].map(() =>
      chromium.launch({
        ...(process.env.BONK_BROWSER
          ? { executablePath: process.env.BONK_BROWSER }
          : {}),
        headless: true,
      }),
    ),
  );
  try {
    const pages = await Promise.all(browsers.map((b) => b.newPage()));
    for (const p of pages) {
      p.on("pageerror", (e) => console.error("PAGE", e.message));
      await p.route(
        "https://samcousinsgb.github.io/bonk-club/__pi-check",
        (r) =>
          r.fulfill({
            contentType: "text/html",
            body: "<!doctype html><title>Connection check</title>",
          }),
      );
      await p.goto("https://samcousinsgb.github.io/bonk-club/__pi-check");
      await p.addScriptTag({ content: bundle });
    }
    for (const transport of ["udp", "tcp", "tls"]) {
      const id = "pi-check-" + Date.now();
      for (let i = 0; i < pages.length; i++)
        await pages[i].evaluate(
          async ({ hostname, transport, id, i }) => {
            const res = await fetch(`https://${hostname}/ice`);
            if (!res.ok)
              throw new Error("Credential service returned " + res.status);
            const result = await res.json();
            const server = result.iceServers.find((s) => s.username);
            server.urls = server.urls.filter((u) =>
              transport === "tls"
                ? u.startsWith("turns:")
                : u.startsWith("turn:") && u.endsWith("transport=" + transport),
            );
            window.peer = new Peer(id + "-" + i, {
              host: hostname,
              port: 443,
              path: "/peerjs",
              secure: true,
              config: { iceServers: [server], iceTransportPolicy: "relay" },
            });
            window.received = null;
            window.ack = null;
            peer.on("connection", (c) => {
              window.connection = c;
              c.on("data", (d) => {
                window.received = d;
                c.send({ ack: d.length });
              });
            });
            await new Promise((resolve, reject) => {
              peer.on("error", (e) => reject(new Error(e.type)));
              peer.on("open", resolve);
              setTimeout(() => reject(new Error("Signaling timeout")), 12000);
            });
          },
          { hostname, transport, id, i },
        );
      await pages[1].evaluate(
        (id) =>
          new Promise((resolve, reject) => {
            window.connection = peer.connect(id + "-0", {
              serialization: "binary",
              reliable: true,
            });
            const timer = setTimeout(
              () => reject(new Error("Relay data timeout")),
              30000,
            );
            connection.on("error", () =>
              reject(new Error("Data connection error")),
            );
            connection.on("open", () => connection.send("x".repeat(160000)));
            connection.on("data", (d) => {
              window.ack = d;
              clearTimeout(timer);
              resolve();
            });
          }),
        id,
      );
      assert.equal(await pages[0].evaluate(() => received.length), 160000);
      assert.equal(await pages[1].evaluate(() => ack.ack), 160000);
      for (const p of pages) {
        const stats = await p.evaluate(async () => {
          const report = await connection.peerConnection.getStats();
          const transport = [...report.values()].find(
            (s) => s.type === "transport" && s.selectedCandidatePairId,
          );
          const pair = report.get(transport.selectedCandidatePairId),
            local = report.get(pair.localCandidateId),
            remote = report.get(pair.remoteCandidateId);
          return {
            local: local.candidateType,
            remote: remote.candidateType,
            relayProtocol: local.relayProtocol,
            bytesSent: pair.bytesSent,
            bytesReceived: pair.bytesReceived,
          };
        });
        assert.equal(stats.local, "relay");
        assert.equal(stats.remote, "relay");
        console.log(transport, stats);
        await p.evaluate(() => peer.destroy());
      }
      console.log(
        `PASS ${transport}: two browsers transferred and acknowledged 160 KB through the Pi's public relay address.`,
      );
    }
  } finally {
    await Promise.all(browsers.map((b) => b.close()));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
