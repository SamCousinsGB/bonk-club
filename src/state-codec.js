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

// Each stream has its own worker. Bound outstanding work and recover from a
// crashed or unresponsive worker without stalling the other stream.
export class StateCodec {
  constructor({ WorkerClass = globalThis.Worker, timeoutMs = 1000 } = {}) {
    this.WorkerClass = WorkerClass; this.timeoutMs = timeoutMs;
    this.pending = new Map(); this.serial = 0; this.closed = false; this.terrain = new WreckReplayer();
    this.flights = new FlightReplayer(); this.motionFlights = new FlightReplayer(); this.matter = new MatterReplayer(); }
  async run(operation, value) {
    const fallback = () => operation === "motion" ? this.motionFlights.expand(value) :
      operation === "expand" ? expandSnapshot(value, () => true, this.terrain, this.flights, this.matter) :
      operation === "encode" ? encodeState(value) : decodeState(value);
    if (this.closed) throw new Error("Codec closed");
    if (!this.WorkerClass || this.unavailable) return fallback();
    if (!this.worker) {
      try {
        // Keep the production constructor literal so Vite bundles the worker
        // and its imports. The alternate class is only a test worker double.
        this.worker = this.WorkerClass === globalThis.Worker
          ? new Worker(new URL("./state-codec-worker.js", import.meta.url), { type: "module" })
          : new this.WorkerClass();
      } catch {
        // Environments that cannot create a worker retain the bounded codec.
        this.unavailable = true; return fallback();
      }
      const worker = this.worker;
      worker.onmessage = ({ data }) => {
        if (this.worker !== worker) return;
        const request = this.pending.get(data.id); if (!request) return;
        this.pending.delete(data.id); clearTimeout(request.timer);
        if (data.error) request.reject(new Error("Invalid frame")); else request.resolve(data.value);
      };
      worker.onerror = worker.onmessageerror = () => {
        if (this.worker === worker) this.stop(false);
      };
    }
    // Invalid data, overload and a crashed worker must not retry expensive work
    // on the rendering thread. Discard that frame; a fresh worker handles the next.
    if (this.pending.size >= 6) throw new Error("Codec busy");
    return await new Promise((resolve, reject) => {
      const id = ++this.serial;
      const timer = setTimeout(() => { if (this.pending.has(id)) this.stop(false); }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      // The caller may retain the bytes as an acknowledged baseline.
      try { this.worker.postMessage({ id, operation, value }); }
      catch { this.stop(false); }
    });
  }
  stop(closed = true) {
    this.closed ||= closed; this.worker?.terminate(); this.worker = null;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer); request.reject(new Error("Codec stopped"));
    }
    this.pending.clear();
  }
}
import { expandSnapshot } from "./snapshot-wire.js";
import { WreckReplayer } from "./wreck-motion.js";
import { FlightReplayer } from "./flight-replay.js";
import { MatterReplayer } from "./matter-replay.js";
