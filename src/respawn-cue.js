export class RespawnCue {
  update(state, localId) {
    const p = state?.players.find(p => p.id === localId);
    if (!p || state.phase === 'result') { this.key = null; this.until = 0; return null; }
    const key = `${state.round}:${state.arenaIndex}:${p.id}:${p.occupant}:${p.lifeId}`;
    if (this.key !== key || state.time < this.time) {
      this.key = key;
      this.until = p.alive ? state.time + 2.8 : 0;
    }
    this.time = state.time;
    if (!p.alive || state.time >= this.until) return null;
    return { player: p, age: Math.max(0, 2.8 - (this.until - state.time)) };
  }
}

export function drawRespawnCue(c, cue, reduced) {
  if (!cue) return;
  const p = cue.player;
  const x = p.rig?.[0]?.x ?? p.x, head = p.rig?.[0]?.y ?? p.y - 30;
  const pulse = reduced ? 1 : .68 + .32 * Math.cos(cue.age * Math.PI * 4);
  const y = head - 62 - (reduced ? 0 : 5 * Math.sin(cue.age * Math.PI * 4));
  c.save(); c.translate(x, y); c.globalAlpha = pulse;
  c.lineJoin = 'round'; c.lineWidth = 6; c.strokeStyle = '#171d28'; c.fillStyle = '#ff4c59';
  c.beginPath(); c.moveTo(-9,-22); c.lineTo(9,-22); c.lineTo(9,-5);
  c.lineTo(21,-5); c.lineTo(0,17); c.lineTo(-21,-5); c.lineTo(-9,-5); c.closePath();
  c.stroke(); c.fill(); c.lineWidth = 2; c.strokeStyle = '#ffd7da'; c.stroke();
  c.globalAlpha = 1; c.font = "800 18px 'DM Sans',sans-serif"; c.textAlign = 'center';
  c.lineWidth = 5; c.strokeStyle = '#171d28'; c.strokeText('YOU',0,-34);
  c.fillStyle = '#fff1f2'; c.fillText('YOU',0,-34); c.restore();
}
