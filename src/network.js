import PeerModule from "peerjs";
import { RoomSession, PROTOCOL } from "./room-session.js";
import { REALTIME_LABEL } from "./realtime.js";
import { ConnectionDiagnostics } from "./connection-diagnostics.js";
import { loadIceConfig, connectionFailure, hasRelay } from "./ice.js";
import { roomServiceOptions } from "./room-service.js";
export { PROTOCOL, validSnapshot, encodeState, decodeState } from "./room-session.js";
const Peer = PeerModule.Peer ?? PeerModule;
export const validCode = value => typeof value === "string" && /^[A-HJ-NP-Z2-9]{6}$/.test(value);
const PREFIX = "bonkclub-v9-";
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), v => alphabet[v % alphabet.length]).join("");
export class Room extends RoomSession {
  constructor(callbacks = {}, PeerClass = Peer, options = {}) {
    super(callbacks, { ...options, diagnostics: new ConnectionDiagnostics(), compression: options.compression ?? (PeerClass === Peer && typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined") });
    this.PeerClass = PeerClass;
    this.config = options.config;
    this.signaling = roomServiceOptions(options.roomServiceUrl ?? import.meta.env?.VITE_ROOM_SERVICE_URL ?? "");
    this.iceServersUrl = options.iceServersUrl ?? import.meta.env?.VITE_TURN_CREDENTIALS_URL ?? "";
    this.peer = null;
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
          this.emit("onStatus", "Reconnectingâ€¦");
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
        this.emit("onStatus", "Retrying connectionâ€¦");
      }
    }
  }
  joinAttempt(code) {
    return this.joinConnection(this.peer.connect(PREFIX + code, {
      reliable: true, serialization: "binary",
      metadata: { protocol: PROTOCOL, profile: this.profile, compression: this.compression },
    }));
  }
  openRealtimeChannel(c) {
    return c.peerConnection?.createDataChannel?.(REALTIME_LABEL, { negotiated: true, id: 2, ordered: false, maxRetransmits: 0 });
  }
  connectionTimeout(c) {
    return c.peerConnection?.remoteDescription ? connectionFailure(this.config, c) : super.connectionTimeout(c);
  }
  transportReport() { return { transport: "webrtc", peerjs: "1.5.5", relayConfigured: hasRelay(this.config) }; }
  roomServiceState() { return this.peer?.disconnected ? "disconnected" : this.peer?.open ? "connected" : "not-open"; }
  closeTransport() { this.peer?.destroy(); }
}
