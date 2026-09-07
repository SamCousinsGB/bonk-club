export const PALETTE = [
  { name: "Blue", value: "#55baff" },
  { name: "Yellow", value: "#f7d747" },
  { name: "Pink", value: "#ff7393" },
  { name: "Mint", value: "#81edb0" },
  { name: "Orange", value: "#ff9b58" },
  { name: "Purple", value: "#bc9bff" },
  { name: "White", value: "#f2f3df" },
  { name: "Red", value: "#ff565f" },
];
export const HAIRSTYLES = [
  "None",
  "Spikes",
  "Mohawk",
  "Bob",
  "Ponytail",
  "Afro",
];
export function defaultProfile(id = 0) {
  const color = PALETTE[id % PALETTE.length];
  return { name: color.name.toUpperCase(), color: color.value, hair: "None" };
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
    color: PALETTE.some((c) => c.value === value?.color)
      ? value.color
      : fallback.color,
    hair: HAIRSTYLES.includes(value?.hair) ? value.hair : fallback.hair,
  };
}
export function validProfile(p) {
  return (
    !!p &&
    typeof p.name === "string" &&
    p.name === cleanProfile(p).name &&
    PALETTE.some((c) => c.value === p.color) &&
    HAIRSTYLES.includes(p.hair)
  );
}
export function availableProfile(value, others, fallback = defaultProfile()) {
  const profile = cleanProfile(value, fallback),
    used = new Set(others.map((p) => p.color));
  if (used.has(profile.color))
    profile.color =
      PALETTE.find((c) => !used.has(c.value))?.value || fallback.color;
  return profile;
}
export function drawHair(c, hair, x, y, angle = 0, facing = 1) {
  if (!HAIRSTYLES.includes(hair) || hair === "None") return;
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(facing, 1);
  c.fillStyle = "#26303d";
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
  } else {
    for (let n = 0; n < 9; n++) {
      const a = Math.PI + (n * Math.PI) / 8,
        px = Math.cos(a) * 11,
        py = Math.sin(a) * 11 - 3;
      c.moveTo(px + 7, py);
      c.arc(px, py, 7, 0, Math.PI * 2);
    }
  }
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();
}
