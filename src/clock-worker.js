// Independent of requestAnimationFrame, which browsers suspend in background tabs.
setInterval(() => postMessage(null), 1000 / 120);
