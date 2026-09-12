import { FINISHES, CAPES, TRAILS, AURAS, COSMETIC_DEFAULTS } from "./cosmetics.js";
export const PALETTE = [
  { name: "Blue", value: "#55baff" },
  { name: "Yellow", value: "#f7d747" },
  { name: "Pink", value: "#ff7393" },
  { name: "Mint", value: "#81edb0" },
  { name: "Orange", value: "#ff9b58" },
  { name: "Purple", value: "#bc9bff" },
  { name: "White", value: "#f2f3df" },
  { name: "Red", value: "#ff565f" },
  { name: "Cyan", value: "#54e2ee" },
  { name: "Lime", value: "#c5ed53" },
  { name: "Coral", value: "#ff8b88" },
  { name: "Lavender", value: "#d8b9ff" },
  { name: "Teal", value: "#49c9ae" },
  { name: "Gold", value: "#eab75a" },
  { name: "Rose", value: "#ed91bf" },
  { name: "Sky", value: "#a3d9ff" },
  { name: "Peach", value: "#ffc49d" },
  { name: "Jade", value: "#60c994" },
  { name: "Periwinkle", value: "#939dff" },
  { name: "Magenta", value: "#ed62d2" },
  { name: "Silver", value: "#bbc9d6" },
  { name: "Sand", value: "#dbca98" },
  { name: "Apricot", value: "#edaa75" },
  { name: "Ice blue", value: "#c7f3f4" },
];
export const HAIRSTYLES = [
  "None",
  "Spikes",
  "Mohawk",
  "Bob",
  "Ponytail",
  "Afro",
  "Buzz cut", "Crew cut", "Side part", "Quiff", "Curls", "Braids",
  "Dreadlocks", "Bun", "Space buns", "Pigtails", "Long", "Shag",
];
export const HAIR_COLOURS = [
  { name: "Charcoal", value: "#26303d" },
  { name: "Black", value: "#141923" },
  { name: "Brown", value: "#634331" },
  { name: "Chestnut", value: "#976044" },
  { name: "Ginger", value: "#dc7b3e" },
  { name: "Blonde", value: "#f2d17a" },
  { name: "Platinum", value: "#f3edcf" },
  { name: "Grey", value: "#9aa8b8" },
  { name: "White", value: "#f1f5fa" },
  { name: "Pink", value: "#fb82bc" },
  { name: "Purple", value: "#af80f4" },
  { name: "Blue", value: "#5daaff" },
  { name: "Turquoise", value: "#59ded2" },
  { name: "Green", value: "#92dc6b" },
  { name: "Red", value: "#ee535f" },
  { name: "Peach", value: "#ffbca0" },
];
export const FACIAL_HAIR = ["None", "Stubble", "Moustache", "Goatee", "Short beard", "Full beard"];
export const ACCESSORIES = ["None", "Glasses", "Sunglasses", "Goggles", "Visor", "Eyepatch", "Headband", "Headphones", "Crown", "Halo", "Horns", "Cat ears", "Antenna"];
const APPEARANCE_CHOICES = {
  color: PALETTE.map(c => c.value), hair: HAIRSTYLES,
  hairColor: HAIR_COLOURS.map(c => c.value), facialHair: FACIAL_HAIR, accessory: ACCESSORIES,
  finish: FINISHES, cape: CAPES, capeColor: PALETTE.map(c => c.value), trail: TRAILS, aura: AURAS,
};
export function defaultProfile(id = 0) {
  const color = PALETTE[id % PALETTE.length];
  return { name: color.name.toUpperCase(), color: color.value, hair: "None",
    hairColor: HAIR_COLOURS[0].value, facialHair: "None", accessory: "None", ...COSMETIC_DEFAULTS };
}
export function cleanProfile(value, fallback = defaultProfile()) {
  const name =
    typeof value?.name === "string"
      ? Array.from(
          value.name
            .replace(
              /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
              "",
            )
            .trim()
            .replace(/\s+/g, " "),
        )
          .slice(0, 20)
          .join("")
      : fallback.name;
  return {
    name: name || fallback.name,
    ...Object.fromEntries(Object.entries(APPEARANCE_CHOICES).map(([key, choices]) =>
      [key, choices.includes(value?.[key]) ? value[key] :
        choices.includes(fallback?.[key]) ? fallback[key] : defaultProfile()[key]])),
  };
}
export function validProfile(p) {
  return (
    !!p &&
    typeof p.name === "string" &&
    p.name === cleanProfile(p).name &&
    validAppearance(p)
  );
}
export function validAppearance(p) {
  return !!p && Object.entries(APPEARANCE_CHOICES).every(([key, choices]) => choices.includes(p[key]));
}
export function randomProfile(value, others = [], random = Math.random) {
  const result = cleanProfile(value);
  for (const [key, choices] of Object.entries(APPEARANCE_CHOICES)) {
    const available = key === "color" ? choices.filter(c => !others.some(p => p.color === c)) : choices;
    if (available.length) result[key] = available[Math.floor(random() * available.length)];
  }
  return result;
}
const BOT_NAMES = [
  "Alex", "Amir", "Avery", "Blake", "Casey", "Charlie", "Cleo", "Dani",
  "Ellis", "Emery", "Ezra", "Felix", "Finn", "Frankie", "Harper", "Hayden",
  "Indie", "Iris", "Jamie", "Jesse", "Jordan", "Jules", "Kai", "Kit",
  "Leo", "Luca", "Max", "Mika", "Milo", "Morgan", "Nico", "Noah",
  "Parker", "Quinn", "Remy", "Riley", "Robin", "Rory", "Rowan", "Sage",
  "Sasha", "Sidney", "Sky", "Taylor", "Toby", "Val", "Wren", "Zara",
];
export function randomBotProfile(others = [], random = Math.random) {
  const names = BOT_NAMES.filter(name => !others.some(p => p.name === `${name} (BOT)`));
  const name = (names.length ? names : BOT_NAMES)[Math.floor(random() * (names.length || BOT_NAMES.length))];
  return randomProfile({ name: `${name} (BOT)` }, others, random);
}
export function availableProfile(value, others, fallback = defaultProfile()) {
  const profile = cleanProfile(value, fallback),
    used = new Set(others.map((p) => p.color));
  if (used.has(profile.color))
    profile.color =
      PALETTE.find((c) => !used.has(c.value))?.value || fallback.color;
  return profile;
}
export function drawHair(c, hair, x, y, angle = 0, facing = 1, color = HAIR_COLOURS[0].value) {
  if (!HAIRSTYLES.includes(hair) || hair === "None") return;
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(facing, 1);
  c.fillStyle = color;
  c.strokeStyle = "#c3ced4";
  c.lineWidth = 1.3;
  c.beginPath();
  if (hair === "Spikes") {
    c.moveTo(-11, -3);
    for (const [a, b] of [
      [-13, -15],
      [-7, -10],
      [-5, -20],
      [0, -11],
      [6, -20],
      [8, -9],
      [13, -13],
      [10, -2],
    ])
      c.lineTo(a, b);
  } else if (hair === "Mohawk") {
    c.moveTo(-5, -8);
    c.lineTo(-5, -24);
    c.lineTo(1, -20);
    c.lineTo(6, -23);
    c.lineTo(7, -8);
  } else if (hair === "Bob") {
    c.moveTo(-12, 9);
    c.bezierCurveTo(-21, -18, 13, -22, 13, -1);
    c.lineTo(2, -5);
    c.lineTo(-5, -2);
    c.lineTo(-5, 10);
  } else if (hair === "Ponytail") {
    c.moveTo(-8, -7);
    c.bezierCurveTo(-25, -14, -28, 10, -19, 22);
    c.bezierCurveTo(-20, 6, -10, 5, -8, -7);
    c.moveTo(-10, -4);
    c.bezierCurveTo(-14, -21, 14, -20, 11, -5);
    c.lineTo(3, -8);
    c.lineTo(-10, -4);
  } else if (hair === "Afro") {
    c.moveTo(-11, 6);
    c.bezierCurveTo(-23, 8, -23, -4, -18, -7);
    c.bezierCurveTo(-23, -17, -14, -22, -9, -19);
    c.bezierCurveTo(-7, -29, 5, -29, 8, -21);
    c.bezierCurveTo(18, -25, 24, -15, 18, -9);
    c.bezierCurveTo(26, -4, 19, 9, 11, 6);
    c.lineTo(9, -5); c.quadraticCurveTo(0, -11, -9, -5);
  } else if (hair === "Buzz cut") {
    c.arc(0, 0, 11, Math.PI, Math.PI * 2);
    c.quadraticCurveTo(1, -6, -11, 0);
  } else if (hair === "Crew cut") {
    c.moveTo(-11, -2); c.lineTo(-10, -14); c.lineTo(7, -15);
    c.lineTo(12, -8); c.lineTo(9, -5); c.lineTo(0, -9);
  } else if (hair === "Side part") {
    c.moveTo(-11, 2); c.bezierCurveTo(-18, -22, 12, -22, 14, -5);
    c.lineTo(6, -10); c.lineTo(3, -13); c.quadraticCurveTo(2, -2, -11, 2);
  } else if (hair === "Quiff") {
    c.moveTo(-11, -3); c.bezierCurveTo(-20, -17, 2, -13, 8, -25);
    c.bezierCurveTo(25, -19, 13, -8, 6, -7); c.lineTo(-3, -9);
  } else if (hair === "Curls") {
    c.moveTo(-11, 1); c.bezierCurveTo(-19, -1, -17, -11, -12, -11);
    c.bezierCurveTo(-17, -19, -6, -24, -2, -18);
    c.bezierCurveTo(3, -26, 14, -22, 12, -14);
    c.bezierCurveTo(21, -13, 17, -3, 11, -3);
    c.quadraticCurveTo(5, 1, 4, -7); c.quadraticCurveTo(-1, 0, -4, -6);
    c.quadraticCurveTo(-11, -2, -11, 1);
  } else if (hair === "Braids" || hair === "Dreadlocks") {
    const braided = hair === "Braids";
    c.moveTo(-11, -2); c.bezierCurveTo(-15, -22, 15, -22, 12, -3);
    c.lineTo(1, -8); c.closePath();
    for (let i = 0; i < (braided ? 2 : 4); i++) {
      const px = braided ? -13 + i * 25 : -16 + i * 4;
      if (!braided) {
        const length = 23 - i * 3;
        c.moveTo(px - 2, -8); c.bezierCurveTo(px - 6, 0, px - 1, 12, px - 4, length);
        c.quadraticCurveTo(px, length + 5, px + 2, length - 1);
        c.bezierCurveTo(px + 4, 7, px, 1, px + 2, -8); c.closePath();
      } else for (let j = 0; j < 4; j++) {
        const cx = px + (j % 2 ? 1.5 : -1), cy = -3 + j * 6;
        c.moveTo(cx + 3, cy); c.ellipse(cx, cy, 3.2, 4.2, -.2, 0, Math.PI * 2);
      }
    }
  } else if (hair === "Bun" || hair === "Space buns" || hair === "Pigtails") {
    c.moveTo(-11, -3); c.bezierCurveTo(-15, -22, 15, -22, 11, -3); c.lineTo(2, -8); c.closePath();
    if (hair === "Bun") { c.moveTo(6, -21); c.arc(0, -21, 7, 0, Math.PI * 2); }
    else for (const sign of [-1, 1]) {
      if (hair === "Space buns") { c.moveTo(sign * 13 + 6, -14); c.arc(sign * 13, -14, 6.5, 0, Math.PI * 2); }
      else {
        c.moveTo(sign * 9, -9); c.quadraticCurveTo(sign * 28, -11, sign * 21, 15);
        c.quadraticCurveTo(sign * 10, 7, sign * 9, -9);
      }
    }
  } else if (hair === "Long") {
    c.moveTo(-15, 23); c.bezierCurveTo(-24, -28, 17, -25, 14, 2);
    c.lineTo(17, 23); c.lineTo(10, 18); c.lineTo(7, -7); c.lineTo(1, -12);
    c.lineTo(-6, -4); c.lineTo(-7, 20);
  } else if (hair === "Shag") {
    c.moveTo(-14, 9); c.lineTo(-16, -5); c.lineTo(-13, -16);
    for (const [px, py] of [[-7,-13],[-4,-20],[2,-16],[9,-18],[15,-7],[9,-9],[11,1],[3,-6],[-3,-3],[-6,12],[-10,5]]) c.lineTo(px,py);
  }
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();
}

// Use the same head artwork in the editor, living rig and physical death bodies.
export function drawAppearance(c, p, x, y, angle = 0, facing = 1) {
  drawHair(c, p.hair, x, y, angle, facing, p.hairColor);
  c.save(); c.translate(x, y); c.rotate(angle); c.scale(facing, 1);
  c.lineCap = "round"; c.lineJoin = "round";
  const line = (points, color, width = 2) => {
    c.beginPath(); points.forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py));
    c.strokeStyle = color; c.lineWidth = width; c.stroke();
  };
  c.fillStyle = p.hairColor || HAIR_COLOURS[0].value;
  c.strokeStyle = "#c3ced4"; c.lineWidth = .8;
  c.beginPath();
  if (p.facialHair === "Stubble") {
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI / 6;
      c.moveTo(Math.cos(a) * 8 + .9, Math.sin(a) * 7 + 2);
      c.arc(Math.cos(a) * 8, Math.sin(a) * 7 + 2, .9, 0, Math.PI * 2);
    }
  } else if (p.facialHair === "Moustache") {
    c.moveTo(2, 2); c.bezierCurveTo(-2, -1, -1, 7, -8, 4);
    c.quadraticCurveTo(-6, 10, 2, 5); c.quadraticCurveTo(12, 9, 11, 3);
    c.quadraticCurveTo(7, 6, 5, 2);
  } else if (p.facialHair === "Goatee") {
    c.moveTo(-2, 7); c.lineTo(8, 6); c.lineTo(5, 16); c.lineTo(0, 14);
  } else if (p.facialHair === "Short beard" || p.facialHair === "Full beard") {
    const full = p.facialHair === "Full beard";
    c.moveTo(-10, 0); c.quadraticCurveTo(-4, 8, 1, 5); c.lineTo(6, 5); c.lineTo(10, 0);
    c.quadraticCurveTo(13, full ? 23 : 14, 0, full ? 22 : 13);
    c.quadraticCurveTo(-12, 12, -10, 0);
  }
  c.closePath(); c.fill();
  if (p.facialHair !== "Stubble") c.stroke();
  const dark = "#17212e", pale = "#e5edf4";
  if (["Glasses", "Sunglasses", "Goggles"].includes(p.accessory)) {
    const goggles = p.accessory === "Goggles";
    line([[-12,-2],[12,-2]], dark, goggles ? 4 : 2);
    for (const px of [-7, 5]) {
      c.beginPath(); c.roundRect(px - 4, -5, 9, 7, goggles ? 2 : 3);
      c.fillStyle = p.accessory === "Sunglasses" ? dark : goggles ? "#65d9e5" : "#b7eafa66";
      c.fill(); c.strokeStyle = goggles ? "#cbb580" : dark; c.lineWidth = 2; c.stroke();
      if (p.accessory !== "Glasses") line([[px-2,-3],[px,0]], pale, 1);
    }
  } else if (p.accessory === "Visor") {
    c.fillStyle = "#72ebd4"; c.strokeStyle = dark; c.lineWidth = 2;
    c.beginPath(); c.roundRect(-11,-6,24,8,3); c.fill(); c.stroke();
    line([[-6,-4],[7,-4]], pale, 1);
  } else if (p.accessory === "Eyepatch") {
    line([[-10,-8],[10,5]], dark, 2);
    c.fillStyle = dark; c.beginPath(); c.ellipse(5,-1,5,4,.2,0,Math.PI*2); c.fill();
  } else if (p.accessory === "Headband") {
    line([[-11,-7],[10,-7]], "#f5eddc", 4);
    line([[-11,-7],[-18,-3],[-21,-6]], "#f5eddc", 3);
    line([[-12,-6],[-16,4]], "#f5eddc", 3);
  } else if (p.accessory === "Headphones") {
    c.beginPath(); c.arc(0,-2,13,Math.PI,Math.PI*2); c.strokeStyle=dark; c.lineWidth=4; c.stroke();
    for (const px of [-12,12]) {
      c.fillStyle=dark; c.beginPath(); c.roundRect(px-3,-5,6,12,3); c.fill();
      line([[px,-1],[px,3]], "#acd5e7", 2);
    }
  } else if (p.accessory === "Crown") {
    const gold=c.createLinearGradient(-12,-22,10,-7);gold.addColorStop(0,"#a76a22");gold.addColorStop(.4,"#fff1b0");gold.addColorStop(.55,"#d29d36");gold.addColorStop(1,"#ffe2a0");
    c.fillStyle=gold;c.strokeStyle="#714b26";c.lineWidth=1.1;
    c.beginPath();c.moveTo(-11,-8);c.lineTo(-14,-22);c.lineTo(-5,-16);c.lineTo(0,-26);c.lineTo(5,-16);c.lineTo(14,-22);c.lineTo(11,-8);c.closePath();c.fill();c.stroke();
    line([[-9,-10],[9,-10]],"#fff3c9",1);
    for(const x of [-7,0,7]) {c.fillStyle=x?p.color:"#f36c9d";c.beginPath();c.arc(x,x?-13:-16,1.8,0,Math.PI*2);c.fill();}
  } else if (p.accessory === "Halo") {
    c.beginPath();c.ellipse(0,-23,14,4,-.12,0,Math.PI*2);c.strokeStyle="#f6da8260";c.lineWidth=6;c.stroke();c.strokeStyle="#fff1b8";c.lineWidth=2;c.stroke();
  } else if (p.accessory === "Horns") {
    for(const sign of [-1,1]) {c.fillStyle="#6e355c";c.strokeStyle="#ffc4d8";c.lineWidth=1;
      c.beginPath();c.moveTo(sign*5,-9);c.quadraticCurveTo(sign*20,-13,sign*12,-28);c.quadraticCurveTo(sign*11,-18,sign*1,-12);c.closePath();c.fill();c.stroke();}
  } else if (p.accessory === "Cat ears") {
    for(const sign of [-1,1]) {c.fillStyle=p.hairColor;c.strokeStyle="#cbd4e3";c.lineWidth=1.2;c.beginPath();c.moveTo(sign*3,-10);c.lineTo(sign*13,-25);c.lineTo(sign*15,-5);c.closePath();c.fill();c.stroke();line([[sign*7,-11],[sign*12,-19],[sign*12,-9]],"#f3a1bd",1.8);}
  } else if (p.accessory === "Antenna") {
    line([[0,-10],[-3,-22],[3,-29]],"#cad6df",1.8);c.fillStyle=p.color;c.beginPath();c.arc(3,-29,4,0,Math.PI*2);c.fill();c.fillStyle="#fff";c.beginPath();c.arc(2,-30,1.3,0,Math.PI*2);c.fill();
  }
  c.restore();
}
