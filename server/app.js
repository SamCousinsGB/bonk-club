import express from "express";
import { createServer } from "node:http";
import { createHmac, randomBytes } from "node:crypto";
import { ExpressPeerServer } from "peer";
import { WebSocketServer } from "ws";

export function validateConfig(config) {
  if (
    !config ||
    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(config.hostname) ||
    !Array.isArray(config.origins) ||
    !config.origins.length ||
    config.origins.some((origin) => new URL(origin).origin !== origin) ||
    !/^[a-f0-9]{64}$/.test(config.turnSecret)
  )
    throw new Error("Invalid server configuration.");
  return config;
}

export function credentials(config, now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + 3600;
  const username = `${expiresAt}:${randomBytes(12).toString("hex")}`;
  return {
    expiresAt,
    iceServers: [
      { urls: `stun:${config.hostname}:3478` },
      {
        urls: [
          `turn:${config.hostname}:3478?transport=udp`,
          `turn:${config.hostname}:3478?transport=tcp`,
          `turns:${config.hostname}:5349?transport=tcp`,
        ],
        username,
        credential: createHmac("sha1", config.turnSecret)
          .update(username)
          .digest("base64"),
      },
    ],
  };
}

// Bounded in-memory limits. Client addresses never enter logs or responses.
export function rateLimiter({
  limit = 60,
  windowMs = 60000,
  maxEntries = 4096,
  clock = Date.now,
} = {}) {
  const buckets = new Map();
  return (ip) => {
    const now = clock();
    let bucket = buckets.get(ip);
    if (!bucket || bucket.until <= now) {
      if (buckets.size >= maxEntries) {
        for (const [key, entry] of buckets)
          if (entry.until <= now) buckets.delete(key);
        if (buckets.size >= maxEntries && !buckets.has(ip)) return false;
      }
      bucket = { until: now + windowMs, count: 0 };
      buckets.set(ip, bucket);
    }
    return ++bucket.count <= limit;
  };
}

export function createRoomServer(rawConfig, { revision = "development" } = {}) {
  const config = validateConfig(rawConfig);
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");
  const allowed = new Set(config.origins);
  const limited = rateLimiter();
  const iceLimit = rateLimiter({ limit: 20 });
  const upgrades = rateLimiter({ limit: 20 });
  app.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.path === "/healthz") return next();
    if (!allowed.has(req.get("origin"))) return res.sendStatus(403);
    res.set({
      "Access-Control-Allow-Origin": req.get("origin"),
      Vary: "Origin",
    });
    if (!limited(req.ip)) return res.sendStatus(429);
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      return res.sendStatus(204);
    }
    next();
  });
  app.get("/healthz", (_req, res) => res.json({ status: "ok", revision }));
  app.get("/ice", (req, res) => {
    if (!iceLimit(req.ip)) return res.sendStatus(429);
    res.json(credentials(config));
  });
  const server = createServer({ maxHeaderSize: 8192 }, app);
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  const peer = ExpressPeerServer(server, {
    path: "/",
    proxied: "loopback",
    allow_discovery: false,
    concurrent_limit: 64,
    alive_timeout: 60000,
    expire_timeout: 15000,
    corsOptions: { origin: config.origins },
    createWebSocketServer: (options) =>
      new WebSocketServer({
        ...options,
        maxPayload: 65536,
        perMessageDeflate: false,
        verifyClient: ({ req }) =>
          allowed.has(req.headers.origin) &&
          upgrades(req.headers["x-forwarded-for"] || req.socket.remoteAddress),
      }),
  });
  peer.on("error", () => {
    /* Individual malformed connections do not stop rooms. */
  });
  app.use("/peerjs", peer);
  app.use((_req, res) => res.sendStatus(404));
  return { app, server, peer };
}
