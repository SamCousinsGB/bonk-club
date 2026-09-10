import { weaponMuzzle } from "./weapon-mount.js";

export function drawPhaser(r, beam, time, player) {
  const c = r.ctx, length = Math.hypot(beam.ex - beam.x, beam.ey - beam.y);
  const angle = Math.atan2(beam.ey - beam.y, beam.ex - beam.x);
  // Hits happen at discharge. Attach the short afterglow to the recoiling hand
  // while keeping the full-width corridor at the fired path.
  const muzzle = player?.alive && player.weapon === "phaser" ? weaponMuzzle(player) : beam;
  const dx = muzzle.x - beam.x, dy = muzzle.y - beam.y;
  const tip = { x: dx * Math.cos(angle) + dy * Math.sin(angle), y: -dx * Math.sin(angle) + dy * Math.cos(angle) };
  const flare = beam.flare;
  c.save(); c.translate(beam.x, beam.y); c.rotate(angle);
  c.globalAlpha = Math.min(1, beam.life / .16);
  c.beginPath(); c.moveTo(tip.x, tip.y); c.lineTo(flare, -beam.radius);
  c.lineTo(length, -beam.radius); c.lineTo(length, beam.radius);
  c.lineTo(flare, beam.radius); c.closePath(); c.clip();
  const glow = c.createLinearGradient(0, -beam.radius, 0, beam.radius);
  glow.addColorStop(0, "#64ffd900"); glow.addColorStop(.12, "#4fffc655");
  glow.addColorStop(.4, "#a8ffe5cc"); glow.addColorStop(.5, "#f3fff5ee");
  glow.addColorStop(.6, "#a8ffe5cc"); glow.addColorStop(.88, "#4fffc655"); glow.addColorStop(1, "#64ffd900");
  c.fillStyle = glow;
  c.fillRect(Math.min(0, tip.x), -beam.radius, length + Math.abs(tip.x), beam.radius * 2);
  r.line([[tip.x, tip.y], [flare, 0], [length, 0]], "#e5fff6", 9);
  for (let n = 0; n < 4; n++) {
    const offset = (n - 1.5) * beam.radius * .42;
    c.strokeStyle = "#a0ffdd99"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(tip.x, tip.y); c.lineTo(flare, offset);
    for (let x = flare + 40; x <= length; x += 60)
      c.lineTo(x, offset + (r.reduced ? 0 : Math.sin(x * .02 - time * 35 + n) * 6));
    c.stroke();
  }
  c.restore();
}
