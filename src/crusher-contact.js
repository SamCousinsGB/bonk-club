// Only the descending lower face crushes. A rider on top and a returning
// head cannot deal damage through the crusher's full casing rectangle.
export function crusherSweep(h, oldY, newY, halfHeight = 22) {
  if (newY <= oldY + 1e-6) return null;
  return { x: h.x - h.w / 2, y: oldY + halfHeight, w: h.w, h: newY - oldY };
}
export function crusherContact(h, oldY, newY, box, halfHeight = 22) {
  const face = crusherSweep(h, oldY, newY, halfHeight);
  return !!face && box.x < face.x + face.w && box.x + box.w > face.x &&
    box.y < face.y + face.h && box.y + box.h > face.y && box.y + box.h / 2 >= face.y - 2;
}
