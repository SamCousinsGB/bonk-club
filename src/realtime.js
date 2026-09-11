// Disposable gameplay frames use the existing peer connection and ICE route.
// Negotiating a reserved stream on both ends avoids PeerJS taking ownership of
// another datachannel event. Its reliable stream continues to carry room state.
export const REALTIME_LABEL = "bonk-realtime-1";
export const PACKET_BYTES = 12000;
const HEADER = 10, MAX_BYTES = 250000, MAX_PARTS = Math.ceil(MAX_BYTES / PACKET_BYTES);
export function motionPacket(buffer) {
  return buffer instanceof ArrayBuffer && buffer.byteLength > HEADER && !!(new DataView(buffer).getUint16(6) & 0x8000);
}
export function framePackets(bytes, seq, motion = false) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MAX_BYTES ||
      !Number.isInteger(seq) || seq < 1 || seq > 0xffffffff) throw new Error("Invalid frame");
  const count = Math.ceil(bytes.length / PACKET_BYTES), packets = [];
  for (let i = 0; i < count; i++) {
    const part = bytes.subarray(i * PACKET_BYTES, (i + 1) * PACKET_BYTES);
    const packet = new Uint8Array(HEADER + part.length), view = new DataView(packet.buffer);
    view.setUint32(0, seq); view.setUint16(4, i); view.setUint16(6, count | (motion ? 0x8000 : 0)); view.setUint16(8, part.length);
    packet.set(part, HEADER); packets.push(packet);
  }
  return packets;
}
export class FrameAssembler {
  constructor() { this.pending = new Map(); this.last = 0; }
  push(buffer, now) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength <= HEADER || buffer.byteLength > PACKET_BYTES + HEADER) return null;
    const view = new DataView(buffer), seq = view.getUint32(0), index = view.getUint16(4), count = view.getUint16(6) & 0x7fff, length = view.getUint16(8);
    if (seq <= this.last || !count || count > MAX_PARTS || index >= count || length !== buffer.byteLength - HEADER ||
        (index < count - 1 && length !== PACKET_BYTES) || (index === count - 1 && (count - 1) * PACKET_BYTES + length > MAX_BYTES)) return null;
    for (const [id, frame] of this.pending) if (now - frame.at > 250 || id < seq - 2) this.pending.delete(id);
    let frame = this.pending.get(seq);
    if (!frame) {
      if (this.pending.size >= 2) {
        const oldest = Math.min(...this.pending.keys());
        if (seq < oldest) return null;
        this.pending.delete(oldest);
      }
      frame = { at: now, parts: Array(count), received: 0 }; this.pending.set(seq, frame);
    }
    if (frame.parts.length !== count || frame.parts[index]) return null;
    frame.parts[index] = new Uint8Array(buffer, HEADER); frame.received++;
    if (frame.received !== count) return null;
    const bytes = new Uint8Array(frame.parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const p of frame.parts) { bytes.set(p, offset); offset += p.length; }
    this.last = seq;
    for (const id of this.pending.keys()) if (id <= seq) this.pending.delete(id);
    return { t: "frame", seq, bytes, ...(motionPacket(buffer) ? { motion: true } : {}) };
  }
}

// At most one decode plus one replacement. A stalled tab never replays seconds
// of obsolete compressed snapshots when its event loop becomes available again.
export class LatestFrameDecoder {
  constructor(consume) { this.consume = consume; this.last = 0; this.pending = null; this.running = false; this.closed = false; }
  push(frame) {
    if (this.closed || !Number.isInteger(frame.seq) || frame.seq <= this.last || frame.seq > 0xffffffff) return;
    this.last = frame.seq; this.pending = frame;
    if (!this.running) this.done = this.drain();
  }
  async drain() {
    this.running = true;
    try {
      while (this.pending && !this.closed) {
        const frame = this.pending; this.pending = null;
        await this.consume(frame);
      }
    } finally { this.running = false; }
  }
  close() { this.closed = true; this.pending = null; }
}
