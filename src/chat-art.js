import { W, H } from "./scale.js";

export function chatLines(context, text, width) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && context.measureText(line + " " + word).width > width) {
      lines.push(line); line = "";
    }
    for (const letter of (line ? " " : "") + word) {
      if (line && context.measureText(line + letter).width > width) {
        lines.push(line); line = "";
      }
      line += letter;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawChat(context, state, messages) {
  for (const message of messages) {
    const player = state.players.find(p => p.id === message.id);
    if (!player || message.round !== state.round) continue;
    const rag = !player.alive && state.ragdolls?.findLast(r => r.color === player.color && r.points?.length);
    const head = rag?.points?.[0] || player.rig?.[0] || { x: player.x, y: player.y - 40 };
    if (!Number.isFinite(head.x) || !Number.isFinite(head.y) || head.y > H + 80) continue;
    context.save();
    context.font = "500 25px 'DM Sans',sans-serif";
    const lines = chatLines(context, message.text, 350);
    const width = Math.max(56, ...lines.map(line => context.measureText(line).width + 32));
    const height = lines.length * 31 + 20;
    const x = Math.max(8, Math.min(W - width - 8, head.x - width / 2));
    const y = Math.max(8, Math.min(H - height - 16, head.y - height - 65));
    const tip = Math.max(x + 15, Math.min(x + width - 15, head.x));
    context.globalAlpha = Math.min(1, message.life / 450);
    context.fillStyle = "#f7f6ed";
    context.strokeStyle = "#14212e"; context.lineWidth = 3;
    context.beginPath(); context.roundRect(x, y, width, height, 12); context.fill(); context.stroke();
    context.beginPath(); context.moveTo(tip - 9, y + height - 1);
    context.lineTo(tip, y + height + 12); context.lineTo(tip + 9, y + height - 1);
    context.fill(); context.stroke();
    context.fillStyle = "#14212e"; context.textAlign = "center"; context.textBaseline = "middle";
    lines.forEach((line, index) => context.fillText(line, x + width / 2, y + 10 + 31 * (index + .5)));
    context.restore();
  }
}
