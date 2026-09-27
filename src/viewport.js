import { W, H } from "./engine.js";
// Desktop windows always contain the entire arena, with centred letterboxing.
export function gameViewport(width, height) {
  width = Math.max(1, width);
  height = Math.max(1, height);
  const scale = Math.min(width / W, height / H);
  return {
    left: 0,
    top: 0,
    width: W,
    height: H,
    scale,
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
