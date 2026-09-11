export async function encodeState(state) {
  const stream = new Blob([JSON.stringify(state)]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
export async function decodeState(bytes) {
  if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > 250000) throw new Error("Invalid frame");
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
  const chunks = []; let length = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > 1000000) { await reader.cancel(); throw new Error("Frame too large"); }
    chunks.push(value);
  }
  return JSON.parse(await new Blob(chunks).text());
}

// Keep JSON/compression off the rendering thread. At most one frame generation
// (two streams for three recipients) or two guest decodes are in flight.
export class StateCodec {
  constructor() { this.pending = new Map(); this.serial = 0; this.closed = false; this.terrain = new WreckReplayer();
    this.flights = new FlightReplayer(); this.motionFlights = new FlightReplayer(); this.matter = new MatterReplayer(); }
  async run(operation, value) {
    const fallback = () => operation === "motion" ? this.motionFlights.expand(value) :
      operation === "expand" ? expandSnapshot(value, () => true, this.terrain, this.flights, this.matter) :
      operation === "encode" ? encodeState(value) : decodeState(value);
    if (this.closed) throw new Error("Codec closed");
    if (typeof Worker === "undefined" || this.failed) return fallback();
    try {
      if (!this.worker) {
        this.worker = new Worker(new URL("./state-codec-worker.js", import.meta.url), { type: "module" });
        this.worker.onmessage = ({ data }) => {
          const request = this.pending.get(data.id); if (!request) return;
          this.pending.delete(data.id);
          if (data.error) request.reject(new Error("Invalid frame")); else request.resolve(data.value);
        };
        this.worker.onerror = () => this.stop(false);
      }
      if (this.pending.size >= 6) throw new Error("Codec busy");
      return await new Promise((resolve, reject) => {
        const id = ++this.serial; this.pending.set(id, { resolve, reject });
        // Do not transfer the caller's input: fallback still needs those bytes.
        try { this.worker.postMessage({ id, operation, value }); }
        catch (error) { this.pending.delete(id); reject(error); }
      });
    } catch (error) {
      if (this.closed) throw error;
      return fallback();
    }
  }
  stop(closed = true) {
    this.closed = closed; this.failed = true; this.worker?.terminate(); this.worker = null;
    for (const request of this.pending.values()) request.reject(new Error("Codec stopped"));
    this.pending.clear();
  }
}
import { expandSnapshot } from "./snapshot-wire.js";
import { WreckReplayer } from "./wreck-motion.js";
import { FlightReplayer } from "./flight-replay.js";
import { MatterReplayer } from "./matter-replay.js";
