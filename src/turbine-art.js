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
}

export function drawTurbine(c, h, reduced, time = h.age) {
  const radius = h.w / 2;
  c.save(); c.translate(h.bodyX, h.bodyY);
  disc(c, 0, 0, radius + 9, "#0b181f");
  c.strokeStyle = "#45595c"; c.lineWidth = 7;
  c.beginPath(); c.arc(0, 0, radius + 3, 0, Math.PI * 2); c.stroke();
  // Fixed casing teeth distinguish the stationary rim from the moving blades.
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    line(c, [Math.cos(a) * (radius - 2), Math.sin(a) * (radius - 2)],
      [Math.cos(a) * (radius + 9), Math.sin(a) * (radius + 9)], i % 3 ? "#1c292b" : "#947749", 9);
  }
  c.save(); c.rotate(time * (reduced ? .35 : 1.8) * h.dir + h.id * .7);
  for (let i = 0; i < 6; i++) {
    c.rotate(Math.PI / 3);
    const steel = c.createLinearGradient(35, -30, radius, 45);
    steel.addColorStop(0, "#273d46"); steel.addColorStop(.48, "#354b51");
    steel.addColorStop(.75, "#4b6061"); steel.addColorStop(1, "#30474e");
    c.beginPath(); c.moveTo(37, -19); c.bezierCurveTo(90, -48, 167, -59, radius - 9, -21);
    c.lineTo(radius - 4, 12); c.bezierCurveTo(159, -10, 90, 8, 40, 20); c.closePath();
    c.fillStyle = steel; c.fill(); c.strokeStyle = "#102a35"; c.lineWidth = 3; c.stroke();
    line(c, [92, -27], [radius - 19, -9], "#536768", 2);
  }
  disc(c, 0, 0, 49, "#102731"); disc(c, 0, 0, 39, "#4c6367");
  disc(c, 0, 0, 24, "#304a54"); disc(c, 0, 0, 11, "#72817a");
  for (let i = 0; i < 6; i++) disc(c, Math.cos(i * Math.PI / 3) * 33, Math.sin(i * Math.PI / 3) * 33, 3, "#203943");
  c.restore();
  c.restore();
}
