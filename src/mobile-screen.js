// Fullscreen needs a user gesture. Call enter() before awaiting room discovery.
// Orientation locking is optional: the UI asks the player to rotate if denied.
export class MobileScreen {
  constructor(doc = document, screenApi = screen) {
    this.doc = doc;
    this.screen = screenApi;
    this.pending = null;
    this.generation = 0;
  }
  get fullscreen() {
    return !!(this.doc.fullscreenElement || this.doc.webkitFullscreenElement);
  }
  get supported() {
    const root = this.doc.documentElement;
    return !!(root.requestFullscreen || root.webkitRequestFullscreen);
  }
  enter() {
    if (this.pending) return this.pending;
    const generation = this.generation;
    this.pending = this.request(generation).finally(() => { this.pending = null; });
    return this.pending;
  }
  async request(generation) {
    const root = this.doc.documentElement;
    try {
      if (!this.fullscreen) {
        if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: "hide" });
        else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen();
      }
    } catch { /* Keep the viewport layout when fullscreen is refused. */ }
    if (generation !== this.generation) return;
    try { await this.screen.orientation?.lock?.("landscape"); }
    catch { /* The rotate prompt remains available without orientation locking. */ }
    if (generation !== this.generation) {
      try { this.screen.orientation?.unlock?.(); } catch { /* Unsupported browser. */ }
    }
  }
  release() {
    this.generation++;
    try { this.screen.orientation?.unlock?.(); } catch { /* Unsupported browser. */ }
  }
}
