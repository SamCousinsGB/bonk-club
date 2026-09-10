// Independent of requestAnimationFrame, which browsers suspend in background tabs.
// Keep only one outstanding tick. After a blocked main thread, stale timer
// messages must not monopolize the event loop and delay fresh network packets.
let waiting = false;
onmessage = () => { waiting = false; };
setInterval(() => {
  if (!waiting) { waiting = true; postMessage(null); }
}, 1000 / 120);
