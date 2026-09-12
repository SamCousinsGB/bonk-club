import { cableLayout } from "./cable-layout.js";

const line = (c, a, b, color, width = 3) => {
  c.strokeStyle = color; c.lineWidth = width; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke();
};
const disc = (c, x, y, r, color) => {
  c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
};

export function drawTurbineHall(c) {
  const wall = c.createLinearGradient(0, 0, 0, 1440);
  wall.addColorStop(0, "#12252e"); wall.addColorStop(.65, "#29444a"); wall.addColorStop(1, "#0b161d");
  c.fillStyle = wall; c.fillRect(0, 0, 2560, 1440);
  for (let x = 70; x < 2560; x += 320) {
    c.fillStyle = "#183139"; c.fillRect(x, 80, 255, 1040);
    c.strokeStyle = "#3d5355"; c.lineWidth = 4; c.strokeRect(x, 80, 255, 1040);
    for (let y = 95; y < 1090; y += 26) line(c, [x + 8, y], [x + 247, y], "#213b41", 2);
    c.fillStyle = "#0e222c"; c.fillRect(x - 24, 0, 25, 1190);
    line(c, [x - 18, 0], [x - 18, 1190], "#466069", 5);
    for (let y = 300; y < 1050; y += 350) {
      line(c, [x - 12, y - 200], [x + 300, y], "#112b35", 13);
      line(c, [x - 12, y - 200], [x + 300, y], "#3a5359", 3);
    }
  }
  for (const y of [60, 103]) {
    line(c, [0, y], [2560, y], "#0c1d26", 23);
    line(c, [0, y - 7], [2560, y - 7], "#5d6c68", 3);
  }
  for (let x = 180; x < 2500; x += 440) {
    const glow = c.createRadialGradient(x, 128, 2, x, 128, 260);
    glow.addColorStop(0, "#ffd79122"); glow.addColorStop(1, "#ffd79100");
    c.fillStyle = glow; c.fillRect(x - 260, 0, 520, 400);
    line(c, [x, 103], [x, 122], "#82918a", 4);
    c.fillStyle = "#16262b"; c.fillRect(x - 57, 122, 114, 20);
    line(c, [x - 45, 137], [x + 45, 137], "#ffe2a2", 5);
  }
  // Recessed ducts and pipes stay visibly behind the playable steel ledges.
  for (const x of [25, 2515]) {
    line(c, [x, 200], [x, 1100], "#0a1c24", 30);
    line(c, [x - 3, 200], [x - 3, 1100], "#456069", 12);
    for (let y = 210; y < 1120; y += 110) line(c, [x - 19, y], [x + 19, y], "#637675", 6);
  }
  c.fillStyle = "#17262c"; c.fillRect(0, 1428, 2560, 12);
  c.fillStyle = "#687170"; c.fillRect(0, 1428, 2560, 4);
}

export function drawTurbineMounts(c, state) {
  for (const cable of state.cables || []) {
    const spec = cableLayout(cable.id);
    if (spec?.kind !== "turbine") continue;
    for (const [i, end] of [spec.a, spec.b].entries()) {
      if (!cable.attached[i]) continue;
      line(c, [end.x, end.supportY + 12], [end.x, end.y], "#24343b", 12);
      for (let y = end.supportY + 22; y < end.y - 4; y += 7) {
        line(c, [end.x - 17, y], [end.x + 17, y], "#b08c61", 6);
        line(c, [end.x - 14, y - 2], [end.x + 14, y - 2], "#ead0a0", 2);
      }
      disc(c, end.x, end.y, 7, "#afc3c2");
    }
  }
}

export function drawTurbine(c, h, reduced) {
  const radius = h.w / 2;
  c.save(); c.translate(h.bodyX, h.bodyY);
  disc(c, 0, 0, radius + 9, "#0b181f");
  c.strokeStyle = "#63777a"; c.lineWidth = 7;
  c.beginPath(); c.arc(0, 0, radius + 3, 0, Math.PI * 2); c.stroke();
  // Fixed casing teeth distinguish the stationary rim from the moving blades.
  for (let i = 0; i < 28; i++) {
    const a = i * Math.PI / 14;
    line(c, [Math.cos(a) * (radius - 2), Math.sin(a) * (radius - 2)],
      [Math.cos(a) * (radius + 9), Math.sin(a) * (radius + 9)], i % 2 ? "#1c292b" : "#d1a554", 9);
  }
  c.save(); c.rotate(h.age * (reduced ? 2 : 9) * h.dir + h.id * .7);
  for (let i = 0; i < 12; i++) {
    c.rotate(Math.PI / 6);
    const steel = c.createLinearGradient(35, -30, radius, 45);
    steel.addColorStop(0, "#36515c"); steel.addColorStop(.48, "#779696");
    steel.addColorStop(.75, "#c0cebc"); steel.addColorStop(1, "#4b686e");
    c.beginPath(); c.moveTo(37, -19); c.bezierCurveTo(90, -48, 167, -59, radius - 9, -21);
    c.lineTo(radius - 4, 12); c.bezierCurveTo(159, -10, 90, 8, 40, 20); c.closePath();
    c.fillStyle = steel; c.fill(); c.strokeStyle = "#102a35"; c.lineWidth = 3; c.stroke();
    line(c, [92, -27], [radius - 19, -9], "#dce5c8", 2);
  }
  disc(c, 0, 0, 49, "#102731"); disc(c, 0, 0, 39, "#809998");
  disc(c, 0, 0, 24, "#304a54"); disc(c, 0, 0, 11, "#b7c5b4");
  for (let i = 0; i < 6; i++) disc(c, Math.cos(i * Math.PI / 3) * 33, Math.sin(i * Math.PI / 3) * 33, 3, "#203943");
  c.restore();
  c.restore();
}
