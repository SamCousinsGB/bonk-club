// Repeat the sequence of each button press in later disposable inputs, so a
// short jump/fire/parry/throw/down tap survives loss of its first held packet.
const buttons = ["jump", "attack", "block", "throw", "duck"];
export class InputDelivery {
  constructor() { this.edges = buttons.map(() => 0); this.applied = buttons.map(() => 0); this.held = {}; }
  capture(input, seq) {
    buttons.forEach((key, i) => { if (input[key] && !this.held[key]) this.edges[i] = seq; });
    this.held = input; return [...this.edges];
  }
  receive(edges, seq) {
    if (!Array.isArray(edges) || edges.length !== buttons.length || !edges.every(n =>
      Number.isSafeInteger(n) && n >= 0 && n <= seq)) return;
    edges.forEach((n, i) => { this.edges[i] = Math.max(this.edges[i], n); });
  }
  sample(input, stale = false) {
    const out = { ...input };
    buttons.forEach((key, i) => {
      if (stale) this.applied[i] = this.edges[i];
      else if (this.edges[i] > this.applied[i]) {
        // A release tick separates two distinct taps, even if delivery batched
        // them together. Holding a button does not manufacture further presses.
        out[key] = !this.held[key];
        if (out[key]) this.applied[i] = this.edges[i];
      }
    });
    this.held = out; return out;
  }
  acknowledge(seq) {
    // A second tap may still need its separating release tick. Do not tell
    // prediction to discard that command before the press reaches simulation.
    return this.edges.reduce((ack, edge, i) => edge > this.applied[i] ? Math.min(ack, edge - 1) : ack, seq);
  }
}
