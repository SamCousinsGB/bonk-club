const line = (c, points, color, width = 3) => {
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = "round"; c.stroke();
};
const circle = (c, x, y, r, color) => {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = color; c.fill();
};

function carWashHall(c) {
  const wall = c.createLinearGradient(0, 0, 0, 1440);
  wall.addColorStop(0, "#17323b"); wall.addColorStop(1, "#31515a");
  c.fillStyle = wall; c.fillRect(0, 0, 2560, 1440);
  for (let y = 80; y < 1160; y += 105) {
    line(c, [[0, y], [2560, y]], "#91b5b43a", 3);
    for (let x = (Math.floor(y / 105) % 2) * 70; x < 2560; x += 140)
      line(c, [[x, y - 100], [x, y]], "#91b5b425", 2);
  }
  line(c, [[0, 210], [2560, 210]], "#a9bdba", 22);
  line(c, [[0, 225], [2560, 225]], "#405e67", 8);
  for (const x of [770, 1225, 1580, 2240]) {
    line(c, [[x, 210], [x, 790]], "#728b90", 12);
    circle(c, x, 210, 15, "#d0d7cb");
  }
  c.fillStyle = "#10252d"; c.fillRect(0, 1160, 2560, 280);
  for (let x = 0; x < 2560; x += 110) {
    c.fillStyle = x % 220 ? "#426975" : "#345762"; c.fillRect(x, 1160, 106, 52);
  }
  for (let x = 80; x < 2500; x += 155) {
    line(c, [[x, 1214], [x + 42, 1400]], "#112932", 10);
    line(c, [[x + 42, 1400], [x + 85, 1214]], "#587984", 5);
  }
  // Fixed rinse gantry and dryer housing; moving water and air draw separately.
  c.fillStyle = "#274954"; c.fillRect(990, 650, 470, 80);
  for (let x = 1030; x < 1440; x += 55) {
    c.fillStyle = "#a9c7c4"; c.fillRect(x, 720, 9, 54);
    circle(c, x + 4, 780, 8, "#467681");
  }
  c.fillStyle = "#18313b"; c.fillRect(2110, 610, 430, 300);
  c.strokeStyle = "#7b969a"; c.lineWidth = 12; c.strokeRect(2110, 610, 430, 300);
  for (let x = 2140; x < 2510; x += 42) line(c, [[x, 640], [x + 24, 880]], "#6c848855", 8);
  for (let x = 40; x < 2520; x += 220) {
    c.fillStyle = "#152f38"; c.fillRect(x, 1080, 135, 32);
    for (let n = 0; n < 4; n++) circle(c, x + 20 + n * 31, 1096, 8, "#78959b");
  }
}

export function drawCompactSetpieceHall(c, arena) {
  if (arena.compactSetpiece === "car-wash") carWashHall(c);
}

function brush(c, x, time, direction, reduced) {
  const angle = reduced ? 0 : time * 4.5 * direction;
  c.save(); c.translate(x, 995); c.rotate(angle);
  for (let i = 0; i < 14; i++) {
    const a = i * Math.PI * 2 / 14;
    line(c, [[Math.cos(a) * 18, Math.sin(a) * 18], [Math.cos(a) * 78, Math.sin(a) * 132]], i % 2 ? "#49a7bc" : "#e35c76", 17);
  }
  circle(c, 0, 0, 28, "#d0ddd5"); circle(c, 0, 0, 11, "#29434c"); c.restore();
  line(c, [[x, 210], [x, 865]], "#6f8589", 13);
  circle(c, x, 865, 20, "#b8c7c3");
}

export function drawCarWash(c, h, time, layer, reduced = false) {
  if (layer === "front") return;
  brush(c, 770, time, 1, reduced); brush(c, 1580, time, -1, reduced);
  const cycle = h.age % 16;
  const rinseWarning = cycle >= 3.8 && cycle < 5, rinse = cycle >= 5 && cycle < 7.2;
  const dryerWarning = cycle >= 9.5 && cycle < 10.8, dryer = cycle >= 10.8 && cycle < 14.3;
  for (const x of [1034, 1089, 1144, 1199, 1254, 1309, 1364, 1419]) {
    if (rinse) {
      const wave = reduced ? 0 : Math.sin(time * 18 + x) * 11;
      line(c, [[x, 780], [x + wave, 1150]], "#bceeff88", 10);
      line(c, [[x + 2, 780], [x + wave + 2, 1150]], "#efffff99", 3);
    }
    circle(c, x, 780, 6, rinse ? "#bdf7ff" : rinseWarning ? "#ffd36b" : "#527078");
  }
  if (dryer) for (let i = 0; i < 13; i++) {
    const y = 735 + i * 30, offset = reduced ? 0 : (time * 780 + i * 43) % 230;
    line(c, [[2525 - offset, y], [2450 - offset, y + Math.sin(i) * 8]], "#e6f4e966", 4);
  }
  circle(c, 2488, 640, 10, dryer ? "#ff765c" : dryerWarning ? "#ffd36b" : "#527078");
}
