const line = (c, points, color, width = 3) => {
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = "round"; c.stroke();
};
const circle = (c, x, y, r, color) => {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = color; c.fill();
};

function cargoPlaneHall(c) {
  const wall = c.createLinearGradient(0, 0, 0, 1440);
  wall.addColorStop(0, "#14232f"); wall.addColorStop(.68, "#304550"); wall.addColorStop(1, "#17242c");
  c.fillStyle = wall; c.fillRect(0, 0, 2560, 1440);
  for (let x = 40; x < 2560; x += 205) {
    line(c, [[x, 0], [x + 20, 1160]], "#71828a44", 22);
    line(c, [[x + 8, 0], [x + 28, 1160]], "#c3d0cb22", 3);
  }
  c.fillStyle = "#0c1821"; c.fillRect(0, 0, 2560, 115);
  for (let x = 100; x < 2350; x += 270) {
    c.fillStyle = "#31434b"; c.fillRect(x, 105, 150, 32);
    line(c, [[x + 18, 121], [x + 132, 121]], "#d8ddc777", 4);
  }
  for (const x of [310, 900, 1480, 2070]) {
    c.strokeStyle = "#9aa9a566"; c.lineWidth = 7; c.strokeRect(x, 330, 260, 300);
    for (let n = -160; n < 300; n += 42) line(c, [[x, 330 + n], [x + 260, 590 + n]], "#b0a37544", 4);
    for (let n = -160; n < 300; n += 42) line(c, [[x + 260, 330 + n], [x, 590 + n]], "#b0a37533", 4);
  }
  c.fillStyle = "#101b22"; c.fillRect(0, 1160, 2560, 280);
  for (let x = 0; x < 2560; x += 80) {
    c.fillStyle = x % 160 ? "#40515a" : "#2b3c45"; c.fillRect(x, 1160, 76, 50);
    line(c, [[x + 8, 1182], [x + 68, 1182]], "#a6b6b155", 3);
  }
  c.strokeStyle = "#91a3a8"; c.lineWidth = 18; c.strokeRect(2220, 250, 340, 940);
  for (const y of [300, 1130]) line(c, [[2180, y], [2560, y]], "#d6a957", 9);
}

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
  if (arena.compactSetpiece === "cargo-plane") cargoPlaneHall(c);
  else if (arena.compactSetpiece === "car-wash") carWashHall(c);
}

export function drawAirflow(c, h, time, layer, reduced = false) {
  if (layer === "front") return;
  const cycle = h.age % 18, opening = h.active ? 1 : h.warning > 0 ? 1 - h.warning / 1.8 : cycle >= 10.8 && cycle < 12 ? 1 - (cycle - 10.8) / 1.2 : 0;
  const top = 270, bottom = 1160, doorBottom = top + (bottom - top) * (1 - opening);
  c.save(); c.beginPath(); c.rect(2230, top, 330, bottom - top); c.clip();
  if (opening > 0) {
    const sky = c.createLinearGradient(2230, top, 2560, bottom);
    sky.addColorStop(0, "#8bb8cf"); sky.addColorStop(.55, "#d7e2dc"); sky.addColorStop(1, "#536f7c");
    c.fillStyle = sky; c.fillRect(2230, top, 330, bottom - top);
    const speed = reduced ? 0 : time * 900;
    for (let i = 0; i < 16; i++) {
      const x = 2240 + ((i * 71 + speed) % 400), y = 330 + (i * 83) % 760;
      line(c, [[x - 90, y], [x, y]], "#eef7f088", 3);
    }
  }
  c.fillStyle = "#293c47"; c.fillRect(2230, top, 330, Math.max(0, doorBottom - top));
  for (let y = top + 35; y < doorBottom; y += 70) line(c, [[2240, y], [2550, y]], "#91a4a755", 5);
  c.restore();
  const alert = h.warning > 0 && (reduced || Math.sin(time * 12) > 0);
  for (const y of [330, 1080]) circle(c, 2200, y, 11, h.active ? "#ff6a55" : alert ? "#ffd16c" : "#47646b");
  if (h.active) for (let i = 0; i < 22; i++) {
    const y = 360 + (i * 47) % 740, x = 1100 + ((i * 137 + (reduced ? 0 : time * 1500)) % 1420);
    line(c, [[x - 110 - (i % 3) * 30, y], [x, y]], "#d9eef044", 3);
  }
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
