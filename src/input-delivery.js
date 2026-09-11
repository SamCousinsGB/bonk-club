// Repeat the sequence of each button press in later disposable inputs, so a
// short jump/fire/parry/throw tap survives loss of the packet that first held it.
const buttons = ["jump", "attack", "block", "throw"];
export class InputDelivery {
  constructor() { this.edges = [0, 0, 0, 0]; this.applied = [0, 0, 0, 0]; this.held = {}; }
  capture(input, seq) {
    buttons.forEach((key, i) => { if (input[key] && !this.held[key]) this.edges[i] = seq; });
    this.held = input; return [...this.edges];
  }
  receive(edges, seq) {
    if (!Array.isArray(edges) || edges.length !== 4 || !edges.every(n =>
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
}
