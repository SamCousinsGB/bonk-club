import { W, H } from "./scale.js";
export { drawHazards } from "./trap-art.js";
const polygon = (c, points, color) => {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = color;
  c.fill();
};
const circle = (c, x, y, r, color) => {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = color;
  c.fill();
};
const line = (c, points, color, width = 3) => {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
};
const noise = (i) => Math.sin(i * 43.17) * 0.5 + 0.5;
const MATERIALS = {
  grass: ["#446247", "#a3c876"],
  moss: ["#626c51", "#a7b788"],
  sand: ["#ae805c", "#e9c295"],
  wood: ["#715144", "#bc9168"],
  tile: ["#71888f", "#d4e2da"],
  ice: ["#5787a7", "#d3f6f7"],
  basalt: ["#625361", "#c18b76"],
  metal: ["#566875", "#a4bec4"],
};

export function drawEnvironment(c, a) {
  const t = a.theme;
  if (!t) return false;
  const desert = ["desert", "ruins"].includes(t),
    jungle = ["jungle", "temple"].includes(t);
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, a.color);
  sky.addColorStop(1, desert ? "#b98361" : jungle ? "#091f23" : "#142b3c");
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
  circle(
    c,
    desert ? 2050 : 2090,
    230,
    desert ? 104 : 70,
    desert ? "#efd19999" : "#d4dfcb2a",
  );
  if (jungle) {
    for (let layer = 0; layer < 3; layer++)
      for (let i = 0; i < 11; i++) {
        const x = i * 275 + noise(i + layer) * 120,
          y = 180 + noise(i * 3 + layer) * 540,
          w = 28 + layer * 15;
        c.fillStyle = ["#183c37", "#173932", "#102e2b"][layer];
        c.fillRect(x, y, w, H - y);
        for (let j = 0; j < 5; j++)
          circle(
            c,
            x + (j - 2) * 48,
            y + noise(i + j) * 80,
            90 + layer * 12,
            ["#244e3f", "#1c4936", "#153d32"][layer],
          );
        line(
          c,
          [
            [x + 25, y + 80],
            [x + 65, y + 190],
            [x + 32, y + 300],
            [x + 65, y + 440],
          ],
          "#76905c44",
          4,
        );
      }
    for (let i = 0; i < 24; i++) {
      const x = i * 112;
      polygon(
        c,
        [
          [x, H],
          [x - 30, H - 130],
          [x + 15, H - 70],
          [x + 70, H - 170],
          [x + 40, H],
        ],
        "#164536",
      );
    }
    if (t === "jungle") {
      c.fillStyle = "#649a9f25";
      c.fillRect(1150, 190, 160, H - 190);
      for (let i = 0; i < 9; i++)
        line(
          c,
          [
            [1160 + i * 17, 230],
            [1170 + i * 17, 820],
            [1155 + i * 17, H],
          ],
          "#b2ece529",
          3,
        );
    } else {
      for (let i = 0; i < 7; i++) {
        c.fillStyle = i % 2 ? "#475a46" : "#3c503e";
        c.fillRect(600 + i * 85, 1270 - i * 155, 1360 - i * 170, 160);
      }
      c.fillStyle = "#132c2a";
      c.fillRect(1120, 400, 300, 270);
      for (let i = 0; i < 8; i++)
        line(
          c,
          [
            [700 + i * 140, 1180],
            [725 + i * 140, 1150],
            [750 + i * 140, 1180],
          ],
          "#90a57b44",
          4,
        );
    }
  } else if (desert) {
    for (let l = 0; l < 3; l++) {
      const pts = [[0, H]];
      for (let i = 0; i <= 12; i++)
        pts.push([i * 230, 590 + l * 200 + Math.sin(i * 1.4 + l) * 130]);
      pts.push([W, H]);
      polygon(c, pts, ["#765143", "#99644c", "#b67e5766"][l]);
    }
    for (let i = 0; i < 13; i++) {
      const x = i * 210 + 40,
        y = 970 + noise(i) * 300;
      if (t === "desert") {
        line(
          c,
          [
            [x, y],
            [x, y - 140],
          ],
          "#384c3b",
          19,
        );
        line(
          c,
          [
            [x - 45, y - 120],
            [x - 45, y - 60],
            [x + 40, y - 60],
            [x + 40, y - 150],
          ],
          "#384c3b",
          13,
        );
      } else {
        c.fillStyle = "#96785277";
        c.fillRect(x, y - 350, 65, 350);
        c.fillRect(x - 12, y - 360, 89, 28);
        for (let k = 0; k < 3; k++)
          line(
            c,
            [
              [x + 12 + k * 18, y - 320],
              [x + 12 + k * 18, y],
            ],
            "#c7a17c33",
            4,
          );
      }
    }
    if (t === "ruins")
      polygon(
        c,
        [
          [750, 1340],
          [1280, 320],
          [1820, 1340],
        ],
        "#775b4388",
      );
  } else if (t === "arctic") {
    for (let i = 0; i < 8; i++) {
      const x = i * 390,
        y = 330 + noise(i) * 330;
      polygon(
        c,
        [
          [x - 300, H],
          [x, y],
          [x + 420, H],
        ],
        "#6987a066",
      );
      polygon(
        c,
        [
          [x - 95, y + 240],
          [x, y],
          [x + 130, y + 240],
          [x + 25, y + 200],
        ],
        "#cbe0e099",
      );
    }
    for (let i = 0; i < 10; i++)
      line(
        c,
        [
          [100, 100 + i * 9],
          [700, 220 + i * 7],
          [1440, 90 + i * 10],
          [2330, 300 + i * 5],
        ],
        "#80d4c40a",
        20,
      );
    c.fillStyle = "#93c3d51c";
    c.fillRect(0, 1350, W, 90);
    for (let i = 0; i < 65; i++)
      circle(c, noise(i) * W, noise(i + 20) * H, 2, "#e4f5f555");
  } else if (t === "volcano") {
    polygon(
      c,
      [
        [200, H],
        [1090, 350],
        [1440, 350],
        [2440, H],
      ],
      "#242b39",
    );
    polygon(
      c,
      [
        [1090, 350],
        [1230, 290],
        [1340, 300],
        [1440, 350],
        [1270, 420],
      ],
      "#e8884e66",
    );
    line(
      c,
      [
        [1270, 390],
        [1190, 620],
        [1390, 860],
        [1240, 1170],
      ],
      "#d1704744",
      18,
    );
    for (let i = 0; i < 12; i++)
      circle(
        c,
        1240 + Math.sin(i) * 100,
        280 - i * 28,
        45 + i * 9,
        "#171c2933",
      );
    c.fillStyle = "#d66e42";
    c.fillRect(630, 1405, 1320, 35);
    for (let i = 0; i < 40; i++)
      circle(c, 630 + i * 33, 1412 + noise(i) * 20, 10, "#ffc67588");
  } else if (["houses", "mansion", "hospital", "atrium"].includes(t)) {
    const medical = t === "hospital" || t === "atrium";
    for (let i = 0; i < 18; i++) {
      c.fillStyle = "#162b3c55";
      c.fillRect(i * 150, 710 + noise(i) * 220, 120, 730);
    }
    if (t === "atrium") {
      c.fillStyle = "#81c2d221";
      c.fillRect(770, 130, 1020, 1180);
      for (let x = 800; x < 1800; x += 170)
        line(
          c,
          [
            [x, 130],
            [x, 1320],
          ],
          "#9bbec333",
          5,
        );
      for (let y = 140; y < 1300; y += 220)
        line(
          c,
          [
            [770, y],
            [1790, y],
          ],
          "#9bbec333",
          4,
        );
    }
    for (const [x, y, w, h] of a.buildings || []) {
      c.fillStyle = medical
        ? "#adc7c220"
        : t === "mansion"
          ? "#ac82902a"
          : "#c5a8882a";
      c.fillRect(x, y, w, h);
      if (!medical)
        polygon(
          c,
          [
            [x - 25, y],
            [x + w / 2, y - 180],
            [x + w + 25, y],
          ],
          t === "mansion" ? "#73545f" : "#87664f",
        );
      for (let yy = y + 45; yy < y + h - 50; yy += medical ? 380 : 390) {
        for (let xx = x + 50; xx < x + w - 75; xx += 155) {
          c.fillStyle = medical ? "#87b9c630" : "#e5c99822";
          c.fillRect(xx, yy, 100, 150);
          line(
            c,
            [
              [xx + 50, yy],
              [xx + 50, yy + 150],
            ],
            "#adc9c440",
            3,
          );
        }
        if (medical) {
          c.fillStyle = "#e4f4db66";
          c.fillRect(x + 70, yy - 20, w - 140, 6);
        }
      }
      if (medical) {
        c.fillStyle = "#70c4bf77";
        c.fillRect(x + 20, y + 130, 65, 15);
        c.fillRect(x + 45, y + 105, 15, 65);
      } else
        for (let xx = x + 20; xx < x + w; xx += 24)
          line(
            c,
            [
              [xx, y + 10],
              [xx, y + h],
            ],
            "#ddbd9420",
            1,
          );
    }
    if (t === "houses")
      for (let i = 0; i < 20; i++) {
        c.fillStyle = "#54715555";
        c.fillRect(i * 135, 1240, 100, 80);
      }
  } else if (t === "port") {
    c.fillStyle = "#3f748733";
    c.fillRect(0, 1200, W, 240);
    for (const x of [420, 2000]) {
      line(
        c,
        [
          [x - 170, 1260],
          [x, 110],
          [x + 170, 1260],
        ],
        "#b5975544",
        18,
      );
      line(
        c,
        [
          [x - 330, 180],
          [x + 430, 180],
          [x, 100],
          [x - 330, 180],
        ],
        "#b5975566",
        14,
      );
      line(
        c,
        [
          [x + 280, 180],
          [x + 280, 560],
        ],
        "#c6c6a766",
        5,
      );
    }
    for (let i = 0; i < 18; i++) {
      const x = i * 170,
        y = 970 + noise(i) * 250;
      c.fillStyle = i % 2 ? "#80594b55" : "#4e718355";
      c.fillRect(x, y, 150, 230);
      for (let k = 0; k < 6; k++)
        line(
          c,
          [
            [x + k * 25, y],
            [x + k * 25, y + 230],
          ],
          "#c5c9bc22",
          3,
        );
    }
  } else if (t === "factory") {
    for (let i = 0; i < 9; i++) {
      const x = i * 310 + 20;
      c.fillStyle = "#141f2c";
      c.fillRect(x, 180, 80, H);
      line(
        c,
        [
          [x + 90, 130],
          [x + 90, 400 + (i % 3) * 90],
          [x + 235, 400 + (i % 3) * 90],
          [x + 235, H],
        ],
        "#75827a55",
        27,
      );
      for (let y = 140; y < 1300; y += 280) {
        c.fillStyle = "#d8b98533";
        c.fillRect(x + 110, y, 105, 130);
      }
    }
    for (let i = 0; i < 5; i++) {
      const x = 350 + i * 450;
      circle(c, x, 1160, 105, "#63746d33");
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        line(
          c,
          [
            [x, 1160],
            [x + Math.cos(a) * 130, 1160 + Math.sin(a) * 130],
          ],
          "#63746d44",
          18,
        );
      }
    }
  }
  return true;
}

export function drawSurface(c, p) {
  const colors = MATERIALS[p.material];
  if (!colors || p.elevator) return false;
  c.fillStyle = "#07142133";
  c.fillRect(p.x + 10, p.y + 12, p.w, p.h + 15);
  c.fillStyle = colors[0];
  c.fillRect(p.x, p.y, p.w, p.h);
  c.fillStyle = colors[1];
  c.fillRect(p.x, p.y, p.w, 5);
  if (["grass", "moss"].includes(p.material))
    for (let x = p.x + 8; x < p.x + p.w; x += 29) {
      line(
        c,
        [
          [x, p.y + 1],
          [x - 4, p.y - 7],
          [x + 2, p.y - 3],
          [x + 8, p.y - 10],
        ],
        colors[1],
        2,
      );
      if (p.material === "grass")
        line(
          c,
          [
            [x, p.y + p.h],
            [x + 7, p.y + p.h + 25],
          ],
          "#759e5655",
          3,
        );
    }
  else if (p.material === "ice")
    for (let x = p.x + 20; x < p.x + p.w - 20; x += 95)
      line(
        c,
        [
          [x, p.y + 4],
          [x + 20, p.y + p.h / 2],
          [x + 12, p.y + p.h],
        ],
        "#daf5fa77",
        2,
      );
  else if (p.material === "wood")
    for (let x = p.x + 20; x < p.x + p.w; x += 36)
      line(
        c,
        [
          [x, p.y + 6],
          [x, p.y + p.h],
        ],
        "#3e332c88",
        2,
      );
  else if (p.material === "sand" || p.material === "basalt")
    for (let y = p.y + 10; y < p.y + p.h; y += 9)
      line(
        c,
        [
          [p.x, y],
          [p.x + p.w, y + 2],
        ],
        colors[1] + "44",
        2,
      );
  else
    for (let x = p.x + 15; x < p.x + p.w; x += 52) {
      c.fillStyle = colors[1];
      c.fillRect(x, p.y + 12, 3, 3);
    }
  return true;
}
export function drawCover(c, p) {
  if (p.kind === "table" || p.hp <= 0) return false;
  const { x, y, w, h } = p;
  c.save();
  c.fillStyle = "#06142455";
  c.fillRect(x + 5, y + h - 4, w, 8);
  if (p.kind === "stone") {
    polygon(
      c,
      [
        [x, y + h],
        [x + 4, y + 18],
        [x + 24, y],
        [x + w - 20, y + 3],
        [x + w, y + 25],
        [x + w - 5, y + h],
      ],
      "#8f8c7a",
    );
    polygon(
      c,
      [
        [x + 7, y + 17],
        [x + 24, y],
        [x + w - 20, y + 3],
        [x + w - 30, y + 19],
      ],
      "#bfbea4",
    );
  } else if (p.kind === "log") {
    c.fillStyle = "#78523e";
    c.fillRect(x, y + 3, w, h - 3);
    circle(c, x + 10, y + h / 2, h / 2, "#c59d6f");
    circle(c, x + 10, y + h / 2, h / 3, "#876443");
    for (let i = 0; i < 3; i++)
      line(
        c,
        [
          [x + 30, y + 10 + i * 11],
          [x + w - 4, y + 8 + i * 11],
        ],
        "#c4955e55",
        3,
      );
  } else if (p.kind === "sofa") {
    c.fillStyle = "#776377";
    c.fillRect(x, y, w, h - 5);
    c.fillStyle = "#a390a4";
    c.fillRect(x + 10, y + 17, w - 20, h - 27);
    c.fillStyle = "#56465e";
    c.fillRect(x, y + 10, 12, h - 10);
    c.fillRect(x + w - 12, y + 10, 12, h - 10);
    line(
      c,
      [
        [x + w / 2, y + 21],
        [x + w / 2, y + h - 10],
      ],
      "#635167",
      3,
    );
  } else if (p.kind === "bed") {
    c.fillStyle = "#95b5b7";
    c.fillRect(x, y + 8, w, h - 22);
    c.fillStyle = "#d8e1d2";
    c.fillRect(x + 5, y + 3, 28, 14);
    c.fillStyle = "#608f94";
    c.fillRect(x + 40, y + 3, w - 44, 20);
    line(
      c,
      [
        [x, y],
        [x, y + h - 5],
        [x + w, y + h - 5],
        [x + w, y + 3],
      ],
      "#b7cbd0",
      4,
    );
    circle(c, x + 13, y + h - 2, 5, "#152f3d");
    circle(c, x + w - 13, y + h - 2, 5, "#152f3d");
  } else if (p.kind === "cabinet") {
    c.fillStyle = "#7d9394";
    c.fillRect(x, y, w, h);
    for (let i = 0; i < 3; i++) {
      c.fillStyle = "#aebfba";
      c.fillRect(x + 4, y + 5 + i * 24, w - 8, 19);
      c.fillStyle = "#506a70";
      c.fillRect(x + w / 2 - 7, y + 13 + i * 24, 14, 3);
    }
  } else if (p.kind === "barrel") {
    c.fillStyle = "#84764f";
    c.fillRect(x + 3, y, w - 6, h);
    for (const yy of [y + 7, y + h - 14]) {
      c.fillStyle = "#c3bba0";
      c.fillRect(x, yy, w, 7);
    }
    c.fillStyle = "#3f4645";
    c.fillRect(x + w / 2 - 9, y + h / 2 - 9, 18, 18);
  } else {
    c.fillStyle = "#8f6d48";
    c.fillRect(x, y, w, h);
    line(
      c,
      [
        [x + 5, y + 5],
        [x + w - 5, y + h - 5],
        [x + w - 5, y + 5],
        [x + 5, y + h - 5],
        [x + 5, y + 5],
      ],
      "#c8a273",
      6,
    );
  }
  if (p.hp < p.maxHp * 0.65)
    line(
      c,
      [
        [x + w * 0.4, y + 2],
        [x + w * 0.55, y + h * 0.35],
        [x + w * 0.38, y + h * 0.65],
        [x + w * 0.6, y + h],
      ],
      "#15202a",
      3,
    );
  c.restore();
  return true;
}
