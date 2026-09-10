export function drawPhaser(r, beam, time) {
  const c = r.ctx, length = Math.hypot(beam.ex - beam.x, beam.ey - beam.y);
  const fade = Math.min(1, beam.life / .16);
  c.save();
  c.translate(beam.x, beam.y);
  c.rotate(Math.atan2(beam.ey - beam.y, beam.ex - beam.x));
  c.globalAlpha = fade;
  const glow = c.createLinearGradient(0, -beam.radius, 0, beam.radius);
  glow.addColorStop(0, "#64ffd900"); glow.addColorStop(.12, "#4fffc655");
  glow.addColorStop(.4, "#a8ffe5cc"); glow.addColorStop(.5, "#f3fff5ee");
  glow.addColorStop(.6, "#a8ffe5cc"); glow.addColorStop(.88, "#4fffc655"); glow.addColorStop(1, "#64ffd900");
  c.fillStyle = glow;
  c.fillRect(0, -beam.radius, length, beam.radius * 2);
  c.fillStyle = "#e5fff6";
  c.fillRect(0, -5, length, 10);
  c.strokeStyle = "#a0ffdd99"; c.lineWidth = 2;
  for (let n = 0; n < 4; n++) {
    const offset = (n - 1.5) * beam.radius * .42;
    c.beginPath(); c.moveTo(0, offset);
    for (let x = 40; x < length; x += 60)
      c.lineTo(x, offset + (r.reduced ? 0 : Math.sin(x * .02 - time * 35 + n) * 6));
    c.stroke();
  }
  c.restore();
}
