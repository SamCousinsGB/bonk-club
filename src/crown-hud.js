import { CROWN_TARGET } from './crown.js';

export const crownRemaining = total => Math.max(0, CROWN_TARGET - total);
// Round up so the display never says zero before the host declares a winner.
export const crownSeconds = seconds => (Math.ceil(Math.max(0, seconds) * 10 - 1e-7) / 10).toFixed(1);

export function crownFocus(state) {
  const c = state?.crown;
  if (!c) return null;
  const holder = state.players.find(p => p.id === c.holder && p.alive);
  const leader = [...state.players].sort((a,b) => c.times[b.id] - c.times[a.id] || a.id - b.id)[0];
  const player = holder || (leader && c.times[leader.id] > 0 ? leader : null);
  const total = player ? c.times[player.id] : 0;
  const remaining = crownRemaining(total);
  const won = state.phase === 'result' && state.winner === player?.id;
  return { player, holder, total, remaining, urgent: !!holder && remaining <= 5 && state.phase === 'fight',
    name: player?.name || 'Claim the crown',
    status: won ? 'CROWN WINNER' : holder ? 'HOLDING CROWN' : !c.available ? 'CROWN UNAVAILABLE' : player ? 'LEADER · CROWN LOOSE' : 'CROWN LOOSE',
    value: won ? crownSeconds(total) : crownSeconds(remaining),
    label: won ? 'SECONDS HELD' : holder ? 'TO WIN' : player ? 'MORE TO WIN' : 'TOTAL TO WIN' };
}

const crownIcon = '<svg viewBox="0 0 40 36" aria-hidden="true"><path d="M5 28 2 9 12 16 20 3 28 16 38 9 35 28Z"/><path d="M5 33H35"/></svg>';
export function updateCrownHud(element, state, localId) {
  const focus = crownFocus(state);
  element.classList.toggle('hidden', !focus);
  if (!focus) return;
  if (!element.firstElementChild) element.innerHTML = `${crownIcon}<div class="crown-focus-person"><small></small><b></b><span></span></div><div class="crown-focus-clock"><strong></strong><small></small></div><div class="crown-focus-track"><i></i></div>`;
  const person = element.querySelector('.crown-focus-person');
  person.querySelector('small').textContent = focus.status;
  person.querySelector('b').textContent = focus.name;
  person.querySelector('span').textContent = focus.player?.id === localId ? 'YOU' : `CROWN · ROUND ${state.round}`;
  element.querySelector('strong').textContent = focus.value + 's';
  element.querySelector('.crown-focus-clock small').textContent = focus.label;
  element.querySelector('i').style.width = focus.total / CROWN_TARGET * 100 + '%';
  element.style.setProperty('--holder-color', focus.player?.color || '#ffe396');
  element.classList.toggle('crown-urgent', focus.urgent);
  element.classList.toggle('crown-held', !!focus.holder);
  // Keep this DOM stable so the pulse and progress transition survive timer updates.
  element.setAttribute('aria-label', `${focus.name}. ${focus.status}. ${focus.value} seconds ${focus.label.toLowerCase()}.`);
}

// One short cue per final second actually crossed. Joining, stale snapshots and
// resuming after a stall establish a baseline instead of replaying a countdown.
export class CrownCountdown {
  update(state) {
    const focus = crownFocus(state);
    if (!focus?.holder || state.phase !== 'fight') { this.previous = null; return null; }
    const second = Math.ceil(focus.remaining - 1e-7);
    const key = `${state.round}:${state.arenaIndex}:${focus.holder.id}:${focus.holder.occupant}:${focus.holder.lifeId}`;
    const old = this.previous;
    this.previous = { key, second, time: state.time };
    return old?.key === key && state.time > old.time && state.time - old.time < .5 &&
      second >= 1 && second <= 5 && second < old.second ? second : null;
  }
}
