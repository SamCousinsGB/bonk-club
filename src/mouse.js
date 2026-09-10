export function bindMouseControls(
  element,
  state,
  { enabled, wake, aim, root = window },
) {
  let pointerId = null;
  const reset = () => {
    const previous = pointerId;
    pointerId = null;
    state.attack = false;
    state.block = false;
    if (previous !== null && element.hasPointerCapture(previous))
      element.releasePointerCapture(previous);
  };
  const sync = (e) => {
    if (e.pointerType === "touch" || e.pointerId !== pointerId) return;
    if (!enabled() || e.buttons === 0) {
      reset();
      return;
    }
    // Chorded presses/releases arrive as pointermove, even without movement.
    state.attack = (e.buttons & 1) !== 0;
    state.block = (e.buttons & 2) !== 0;
  };
  const point = (e) => {
    if (e.pointerType !== "touch") aim(e);
  };
  const down = (e) => {
    if (e.pointerType === "touch" || !enabled()) return;
    e.preventDefault();
    wake();
    pointerId = e.pointerId;
    point(e);
    sync(e);
    if (pointerId !== null) {
      try {
        element.setPointerCapture(pointerId);
      } catch {
        // Window listeners still receive releases if capture is unavailable.
      }
    }
  };
  const cancel = (e) => {
    if (e.pointerType !== "touch" && e.pointerId === pointerId) reset();
  };
  const bindings = [
    [element, "pointerdown", down],
    [element, "pointermove", point],
    [element, "lostpointercapture", cancel],
    [root, "pointermove", sync],
    [root, "pointerup", sync],
    [root, "pointercancel", cancel],
    [root, "blur", reset],
  ];
  for (const [target, type, handler] of bindings)
    target.addEventListener(type, handler);
  return {
    reset,
    dispose() {
      reset();
      for (const [target, type, handler] of bindings)
        target.removeEventListener(type, handler);
    },
  };
}
