import { EXPANDED_WEAPONS } from "./expanded-weapons.js";

function arrow(r, length, color, barbed = false) {
  r.line([[-length, 0], [9, 0]], color, 3);
  r.line([[2, -6], [11, 0], [2, 6]], color, 3);
  if (barbed) r.line([[-4, -7], [2, 0], [-4, 7]], color, 3);
  else r.line([[-length + 6, -5], [-length, 0], [-length + 6, 5]], "#c88566", 3);
}
export function drawExpandedWeapon(r, type) {
  if (!Object.hasOwn(EXPANDED_WEAPONS, type)) return false;
  const c = r.ctx, color = EXPANDED_WEAPONS[type].color;
  if (type === "hammer") {
    r.line([[-9, 0], [44, 0]], "#87644c", 7);
    r.line([[-9, 0], [9, 0]], "#ddd8ca", 8);
    c.fillStyle = "#394653"; c.fillRect(32, -19, 22, 38);
    c.fillStyle = "#a9bdc8"; c.fillRect(32, -19, 22, 7);
    c.fillStyle = color; c.fillRect(36, -8, 14, 4);
  } else if (type === "cryo") {
    r.circle(6, 0, 15, "#3e7285"); r.circle(6, 0, 10, color);
    for (let n = 0; n < 3; n++) {
      const a = n * Math.PI / 3;
      r.line([[6-Math.cos(a)*8, -Math.sin(a)*8], [6+Math.cos(a)*8, Math.sin(a)*8]], "#ffffff", 2);
    }
    r.line([[1, -15], [1, -20], [12, -20], [17, -10]], "#c3cdd3", 4);
  } else {
    c.fillStyle = "#334451"; c.fillRect(-18, -9, 43, 18); c.fillRect(-7, 7, 9, 14);
    c.fillStyle = color; c.fillRect(-13, -7, 29, 5);
    if (type === "crossbow") {
      r.line([[24, -26], [34, -14], [38, 0], [34, 14], [24, 26]], "#ba8d65", 6);
      r.line([[24, -26], [-6, 0], [24, 26]], "#e7e3d2", 1.8);
      c.save(); c.translate(40, 0); arrow(r, 46, color); c.restore();
    } else if (type === "harpoon") {
      r.circle(-8, 5, 12, "#758c94"); r.circle(-8, 5, 7, "#243c48");
      r.line([[18, 0], [51, 0]], "#809ba5", 10);
      c.save(); c.translate(48, 0); arrow(r, 25, color, true); c.restore();
    } else if (type === "shrapnel") {
      c.fillStyle = "#6d7981"; c.fillRect(12, -14, 35, 28);
      r.line([[46, -17], [46, 17]], color, 6);
      for (let x = 18; x < 43; x += 9) r.line([[x, -9], [x, 9]], "#273845", 3);
      r.circle(-8, 12, 12, "#906b45");
    } else {
      for (let y = -9; y <= 9; y += 9) {
        r.line([[4, y], [39, y]], "#a87a91", 7);
        r.line([[37, y], [47, y]], color, 6);
      }
      r.line([[41, -16], [49, -9], [41, -2]], "#fff0ca", 3);
    }
  }
  return true;
}

export function drawExpandedProjectile(r, b, time) {
  const c = r.ctx;
  if (["bolt", "harpoon"].includes(b.kind)) {
    c.save(); c.translate(b.x, b.y); c.rotate(Math.atan2(b.vy, b.vx));
    arrow(r, b.kind === "bolt" ? 27 : 34, b.kind === "bolt" ? "#e7d0a2" : "#7aeee1", b.kind === "harpoon");
    c.restore();
  } else if (b.weapon === "cryo") {
    c.save(); c.translate(b.x, b.y); c.rotate(time * 5); c.scale(.7, .7);
    drawExpandedWeapon(r, "cryo"); c.restore();
  } else if (b.kind === "spark") {
    const color = ["#ff95ce", "#8ef5d6", "#ffe294"][Math.floor(Math.abs(Math.atan2(b.vy,b.vx)) * 5) % 3];
    r.line([[b.x-b.vx*.055, b.y-b.vy*.055], [b.x, b.y]], color, 3);
    r.circle(b.x, b.y, 5, "#fff8e6");
  } else if (b.weapon === "firework") {
    c.save(); c.translate(b.x, b.y); c.rotate(Math.atan2(b.vy, b.vx));
    r.line([[-28, 0], [-9, 0]], "#ffe294", 4);
    r.line([[-9, 0], [8, 0]], "#ff95ce", 10);
    r.line([[6, -6], [14, 0], [6, 6]], "#fff3dc", 4); c.restore();
  } else if (b.weapon === "shrapnel") {
    r.line([[b.x-b.vx*.02, b.y-b.vy*.02], [b.x,b.y]], "#ffc48d", 3);
    r.circle(b.x,b.y,3,"#ffffff");
  } else return false;
  return true;
}

export function drawExpandedField(r, f) {
  const c = r.ctx;
  if (f.kind === "tether") {
    c.save(); c.globalAlpha *= Math.min(1, f.life / .08);
    r.line([[f.x, f.y], [f.ex, f.ey]], "#7aeee1", 2.5); c.restore();
  } else if (["cryo", "firework"].includes(f.kind)) {
    const ice = f.kind === "cryo", progress = 1 - f.life / (ice ? .55 : .45);
    c.save(); c.globalAlpha *= Math.max(0, 1 - progress);
    const radius = f.radius * (.2 + .8 * progress);
    c.strokeStyle = ice ? "#a2edff" : "#ff95ce"; c.lineWidth = 4;
    c.beginPath(); c.arc(f.x, f.y, radius, 0, Math.PI * 2); c.stroke();
    for (let n = 0; n < 12; n++) {
      const a = n * Math.PI / 6, x = f.x + Math.cos(a) * radius, y = f.y + Math.sin(a) * radius;
      r.line([[f.x+Math.cos(a)*radius*.65, f.y+Math.sin(a)*radius*.65], [x,y]], ice ? "#ecfcff" : "#ffe294", 3);
      if (ice) r.line([[x-4,y-4],[x+4,y+4]], "#ecfcff", 2);
    }
    c.restore();
  } else return false;
  return true;
}
