import { W, H } from "./engine.js";
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function gameViewport(width, height, focusX = W / 2, follow = false) {
  width = Math.max(1, width);
  height = Math.max(1, height);
  const scale = (follow ? Math.max : Math.min)(width / W, height / H);
  const visibleW = Math.min(W, width / scale),
    visibleH = Math.min(H, height / scale);
  const left = clamp(focusX - visibleW / 2, 0, W - visibleW);
  return {
    left,
    top: (H - visibleH) / 2,
    width: visibleW,
    height: visibleH,
    scale,
    position: W > visibleW ? (left / (W - visibleW)) * 100 : 50,
    offsetX: Math.max(0, (width - W * scale) / 2),
    offsetY: Math.max(0, (height - H * scale) / 2),
  };
}

export function screenToWorld(x, y, rect, view) {
  return {
    x: view.left + (x - rect.left - view.offsetX) / view.scale,
    y: view.top + (y - rect.top - view.offsetY) / view.scale,
  };
}
