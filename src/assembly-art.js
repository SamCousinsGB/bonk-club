import { LINE_Y, LINE_CYCLE, LINE_DWELL, LINE_SPEED, STATIONS } from "./assembly-arena.js";
import { robotPose } from "./assembly.js";

const rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
const path = (c, points, color, width = 4) => {
  c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
  c.strokeStyle = color; c.lineWidth = width; c.lineJoin = "round"; c.stroke();
};
const disc = (c, x, y, r, color) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = color; c.fill(); };
function label(c, text, x, y, size = 22, color = "#a9c0c8") {
  c.font = `600 ${size}px "Barlow Condensed", sans-serif`; c.textAlign = "center"; c.fillStyle = color; c.fillText(text, x, y);
}
function stripes(c, x, y, w, h) {
  rect(c, x, y, w, h, "#e1ad48"); c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  for (let n = x - 30; n < x + w; n += 32) path(c, [{ x: n, y: y + h }, { x: n + 20, y }], "#29333a", 15);
  c.restore();
}

export function drawAssemblyHall(c) {
  rect(c, 0, 0, 2560, 1440, "#172630");
  const wash = c.createLinearGradient(0, 0, 0, 1300);
  wash.addColorStop(0, "#263e4b"); wash.addColorStop(1, "#111e28"); c.fillStyle = wash; c.fillRect(0, 0, 2560, 1440);
  for (let x = 40; x < 2560; x += 320) {
    rect(c, x, 110, 250, 160, "#354f5a"); rect(c, x + 6, 116, 238, 148, "#49616a");
    for (let i = 1; i < 4; i++) rect(c, x + i * 62, 115, 5, 150, "#293e48");
    rect(c, x, 184, 250, 5, "#293e48");
    rect(c, x + 273, 0, 18, 1290, "#30434c");
    path(c, [{ x: x + 275, y: 295 }, { x: x + 45, y: 420 }, { x: x + 275, y: 570 }], "#2b414b", 7);
  }
  for (const y of [305, 350]) { rect(c, 0, y, 2560, 13, "#10202b"); rect(c, 0, y, 2560, 3, "#56616a"); }
  for (let x = 150; x < 2560; x += 550) {
    path(c, [{ x, y: 0 }, { x, y: 340 }], "#101e28", 5);
    rect(c, x - 95, 337, 190, 20, "#526975"); rect(c, x - 80, 357, 160, 7, "#d5ded0");
    c.fillStyle = "#d8e4cb05"; c.beginPath(); c.moveTo(x - 75, 364); c.lineTo(x - 220, 1180); c.lineTo(x + 220, 1180); c.lineTo(x + 75, 364); c.fill();
  }
  // Rear safety fencing and supply racks are scenery, behind playable surfaces.
  for (let x = 0; x < 2560; x += 40) path(c, [{ x, y: 880 }, { x, y: 1160 }], "#33434c", 2);
  for (let y = 880; y < 1160; y += 40) rect(c, 0, y, 2560, 1, "#33434c");
  for (const x of [300, 920, 1510, 2130]) {
    rect(c, x - 40, 1285, 80, 155, "#223640");
    for (let y = 1300; y < 1440; y += 30) rect(c, x - 34, y, 68, 8, "#4a5356");
  }
  for (const [i, name] of ["STAMPING", "BODY WELD", "WHEELS / FINISH"].entries()) {
    rect(c, STATIONS[i] - 120, 650, 240, 46, "#0e1c26"); label(c, name, STATIONS[i], 681, 25);
  }
}

function carArt(c, car, clock) {
  const x = car.x, color = ["#e4af53", "#74b8b5", "#cb6e64", "#8f9fd4"][car.id % 4];
  rect(c, x - 125, 1158, 250, 18, "#728891"); rect(c, x - 118, 1165, 236, 5, "#263e49");
  for (let u = -90; u <= 90; u += 45) disc(c, x + u, 1167, 3, "#c3d2d3");
  if (car.stage >= 1) {
    rect(c, x - 125, 1120, 250, 38, car.stage === 3 ? color : "#a2b3b9");
    rect(c, x - 123, 1120, 246, 5, "#e4e6d7");
    rect(c, x - 118, 1137, 235, 3, car.stage === 3 ? "#ffffff30" : "#6e8794");
    path(c, [{ x: x + 73, y: 1120 }, { x: x + 73, y: 1157 }], "#48616d", 2);
    rect(c, x - 50, 1140, 15, 4, "#2d414b");
    rect(c, x - 125, 1128, 8, 12, "#f07b61"); rect(c, x + 117, 1127, 8, 14, "#eeecc6");
  }
  if (car.stage >= 2) {
    rect(c, x - 65, 1050, 140, 70, car.stage === 3 ? color : "#8eacb6");
    rect(c, x - 57, 1058, 53, 52, "#263f4d"); rect(c, x + 5, 1058, 62, 52, "#263f4d");
    path(c, [{ x: x - 52, y: 1085 }, { x: x - 26, y: 1064 }], "#94c6ce80", 5);
    path(c, [{ x: x + 15, y: 1085 }, { x: x + 43, y: 1064 }], "#94c6ce80", 5);
    rect(c, x - 65, 1050, 140, 4, "#d1dfd9");
  }
  if (car.stage === 3) for (const offset of [-81, 81]) {
    disc(c, x + offset, 1169, 21, "#121c25"); disc(c, x + offset, 1169, 13, "#a6b4b9");
    disc(c, x + offset, 1169, 6, "#3e505e");
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5 + clock * .8;
      disc(c, x + offset + Math.cos(a) * 9, 1169 + Math.sin(a) * 9, 2, "#425965");
    }
  }
}

export function drawAssembly(c, state) {
  if (!state.assembly) return;
  const { clock, completed, cars } = state.assembly, phase = clock % LINE_CYCLE;
  const travel = Math.floor(clock / LINE_CYCLE) * 600 + Math.max(0, phase - LINE_DWELL) * LINE_SPEED;
  for (const b of state.platforms.filter(p => p.assemblyBelt && p.hp !== 0 && !p.wreckId)) {
    c.save(); c.beginPath(); c.rect(b.x, b.y, b.w, b.h); c.clip();
    rect(c, b.x, b.y, b.w, b.h, "#344956");
    for (let x = Math.floor((b.x - travel) / 25) * 25 + travel; x < b.x + b.w + 25; x += 25) {
      rect(c, x, LINE_Y, 3, 13, "#9aadac"); disc(c, x, LINE_Y + 26, 8, "#122733"); disc(c, x, LINE_Y + 26, 3, "#82969d");
    }
    rect(c, b.x, LINE_Y + 13, b.w, 4, "#c49c52"); c.restore();
  }
  for (const car of cars) {
    c.save(); c.beginPath();
    for (const p of state.platforms.filter(p => p.assemblyCar === car.id && p.hp !== 0 && !p.wreckId)) c.rect(p.x, p.y, p.w, p.h);
    c.clip(); carArt(c, car, clock); c.restore();
  }
  for (const h of state.hazards.filter(h => h.assemblyStation && !h.done)) {
    const signal = h.warning > 0 ? "#ffc05b" : h.active ? "#f27d5f" : "#70b6a0";
    if (h.assemblyStation === 1) {
      path(c, [{ x: h.x - 74, y: 788 }, { x: h.x - 74, y: h.bodyY - 14 }], "#3d5563", 28);
      path(c, [{ x: h.x + 74, y: 788 }, { x: h.x + 74, y: h.bodyY - 14 }], "#3d5563", 28);
      path(c, [{ x: h.x - 74, y: 813 }, { x: h.x - 74, y: h.bodyY - 14 }], "#b0c4c8", 14);
      path(c, [{ x: h.x + 74, y: 813 }, { x: h.x + 74, y: h.bodyY - 14 }], "#b0c4c8", 14);
      c.save(); c.beginPath(); for (const p of state.platforms.filter(p => p.assemblyHead && p.hp !== 0)) c.rect(p.x, p.y, p.w, p.h); c.clip();
      rect(c, h.x - 140, h.bodyY - 14, 280, 28, "#748991"); stripes(c, h.x - 140, h.bodyY - 14, 280, 13); c.restore();
      disc(c, h.x + 115, 723, 9, signal);
    } else {
      const pose = robotPose(h, phase);
      path(c, pose, "#172834", 37); path(c, pose, "#d28d42", 27);
      path(c, pose.map(p => ({ x: p.x - 4, y: p.y - 3 })), "#f0b867", 6);
      for (const p of pose.slice(0, 2)) { disc(c, p.x, p.y, 24, "#2b414e"); disc(c, p.x, p.y, 14, "#a4b3b1"); disc(c, p.x, p.y, 6, "#385366"); }
      const tip = pose[2]; disc(c, tip.x, tip.y, 10, "#cbd1b9");
      disc(c, h.x + 102, 823, 8, signal);
      const work = cars.find(car => Math.abs(car.x - h.x) < 3 && !car.damaged);
      if (h.active && phase < 1.55 && work?.stage === h.assemblyStation - 1) {
        if (h.assemblyStation === 2) {
          // The robot positions an open cabin shell before welding it in place.
          const y = 1050 - (1.55 - phase) * 100;
          c.strokeStyle = "#a5b7bd"; c.lineWidth = 7; c.strokeRect(work.x - 62, y + 3, 134, 64);
          path(c, [{ x: work.x, y: y + 3 }, { x: work.x, y: y + 67 }], "#a5b7bd", 6);
        } else {
          disc(c, tip.x, tip.y + 18, 21, "#14202a"); disc(c, tip.x, tip.y + 18, 12, "#b0bbc0");
          path(c, [{ x: tip.x - 20, y: tip.y }, { x: tip.x - 25, y: tip.y + 22 }], "#e1a354", 6);
          path(c, [{ x: tip.x + 20, y: tip.y }, { x: tip.x + 25, y: tip.y + 22 }], "#e1a354", 6);
        }
      }
      if (h.active) {
        disc(c, tip.x, tip.y, 16, "#a5e9ff25"); disc(c, tip.x, tip.y, 6, "#eeffff");
        for (let i = 0; i < 9; i++) {
          const a = i * 2.4 + clock * 7, len = 14 + (Math.sin(clock * 21 + i) + 1) * 13;
          path(c, [{ x: tip.x, y: tip.y }, { x: tip.x + Math.cos(a) * len, y: tip.y + Math.sin(a) * len }], i % 2 ? "#f8c768" : "#b9eeff", 2);
        }
      }
    }
  }
  rect(c, 2260, 790, 230, 80, "#10212a");
  label(c, `BUILT ${completed}`, 2375, 824, 25, "#95d4b7");
  label(c, phase < 3 ? "ASSEMBLING" : "CONVEYOR RUNNING", 2375, 853, 18);
}
