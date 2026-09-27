import { playerBox } from './collision.js';
import { liquidBounds } from './liquid-geometry.js';
import { liquidTouches } from './liquid.js';

const overlap = (a, b, pad = 0) => a.x < b.x + b.w + pad && a.x + a.w > b.x - pad &&
  a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;

// Read the same authoritative actor state used by the scene, including guests.
// Contact hides an expiry while a source is continuously refreshing it.
export function fighterStatuses(state, player) {
  if (!player?.alive || state?.phase !== 'fight' || player.bot) return [];
  const result = [], box = playerBox(player);
  const spills = (state.spills || []).filter(q => q.life > 0 && q.h > 0 && overlap(box, liquidBounds(q), 2));
  const add = (id, label, seconds = null) => result.push({ id, label, seconds });
  if (player.capturedBy && state.fields?.some(f => f.kind === 'blackhole' && f.riftId === player.capturedBy && f.life > 0))
    add('spaghetti', 'Spaghetti-fied');
  if (player.freeze > 0) add('frozen', 'Frozen', player.freeze);
  else if (player.chill > 0) add('chilled', 'Chilled', player.chill);
  if (player.burn > 0) add('burning', 'Burning', spills.some(q => q.fire > 0) ? null : player.burn);
  if (player.glued > 0) add('glued', 'Glued');
  if (player.tarred > 0 || player.oiled > 0) {
    const fed = spills.some(q => q.kind === 'oil' || q.kind === 'tar');
    add('flammable', 'Flammable', fed ? null : Math.max(player.tarred || 0, player.oiled || 0));
  }
  if (player.soaked > 0) {
    const fed = player.swimming || (state.water || []).some(q => !q.frozen && q.h > 0 && liquidTouches(q, box));
    add('wet', 'Wet', fed ? null : player.soaked);
  }
  if (player.bubble > 0) add('bubble', 'Bubbled', player.bubble);
  if (player.morphTime > 0 && ['jelly', 'gold', 'tangle'].includes(player.morph))
    add(player.morph, { jelly: 'Jelly', gold: 'Gold', tangle: 'Tangled' }[player.morph], player.morphTime);
  if (player.submerged) add('air', player.oxygen > 0 ? 'Air left' : 'Drowning', Math.max(0, player.oxygen || 0));
  return result;
}

const icons = {
  spaghetti: '<circle cx="7" cy="7" r="3"/><path d="M9 10c6 3 0 8 7 10s4 4 10 7M11 13c5-3 7 1 12-2M11 14c-5 3-5 7-8 9M17 21c-5 1-2 6-6 8"/><ellipse cx="26" cy="26" rx="4" ry="2.5" transform="rotate(-35 26 26)" fill="currentColor" fill-opacity=".4"/>',
  frozen: '<path d="m16 4 10 6v12l-10 6-10-6V10Z" fill="#7dcde866"/><path d="m6 10 10 6 10-6M16 16v12M10 9l6-3 5 3M9 14v5"/>',
  chilled: '<path d="M16 4v24M6 10l20 12M6 22 26 10M12 6l4 4 4-4M12 26l4-4 4 4M6 14l6-1-1-6M21 25l-1-6 6-1M6 18l6 1-1 6M21 7l-1 6 6 1"/>',
  burning: '<path d="M18 3c2 8-6 9-3 15 3-1 5-4 5-7 8 7 8 18-4 18S2 17 10 10c-1 6 2 7 2 7S11 8 18 3Z" fill="currentColor" stroke="none"/>',
  glued: '<path d="M5 22c4-1 3-10 7-10s3 7 6 7 3-5 6-3 1 6 4 6v5H4v-5ZM12 12V5m6 14V8" fill="currentColor" fill-opacity=".3"/><path d="M8 5h8m-2 3h8"/>',
  flammable: '<path d="M16 3C14 9 6 14 6 20a10 10 0 0 0 20 0C26 14 18 9 16 3Z" fill="currentColor" fill-opacity=".4"/><path d="M11 18c-2 4 1 7 4 7"/><circle class="status-drip" cx="24" cy="25" r="2" fill="currentColor" stroke="none"/>',
  wet: '<path d="M16 3C13 10 7 15 7 21a9 9 0 0 0 18 0c0-6-6-11-9-18Z" fill="currentColor" fill-opacity=".25"/><path d="M11 20c0 4 2 5 5 5"/>',
  bubble: '<circle cx="16" cy="17" r="11" fill="currentColor" fill-opacity=".18"/><path d="M9 15c0-3 2-5 5-5"/><circle cx="25" cy="5" r="3"/>',
  jelly: '<path d="M6 23C6 3 26 3 26 23l-4 4-6-3-6 3Z" fill="currentColor" fill-opacity=".3"/><path d="M11 15v3m10-3v3"/>',
  gold: '<path d="m8 10 16 0 5 15H3Z" fill="currentColor" fill-opacity=".5"/><path d="m8 10 4 11h16M12 21l-9 4M18 3v3m7-2-2 3"/>',
  tangle: '<path d="M7 9c15-12 23 10 11 17S0 11 15 11s15 19 4 17S8 0 23 8s-2 19-15 13"/>',
  air: '<path d="M14 5v11c-5-11-10-4-10 5s8 8 10 2V16m4-11v11c5-11 10-4 10 5s-8 8-10 2V16M14 10h4" fill="currentColor" fill-opacity=".2"/>',
};

export function statusMarkup(statuses) {
  return statuses.map(({ id, label, seconds }) => {
    const timer = seconds === null ? '' : `${(Math.ceil(seconds * 10) / 10).toFixed(1)}s`;
    return `<li class="fighter-effect effect-${id}"><span class="effect-circle"><svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[id]}</svg></span><span class="effect-label">${label}</span><span class="effect-timer">${timer}</span></li>`;
  }).join('');
}

export function updateStatusHud(element, statuses) {
  const key = statuses.map(e => `${e.id}:${e.label}`).join('|');
  if (element.dataset.effects !== key) {
    element.innerHTML = statusMarkup(statuses);
    element.dataset.effects = key;
  } else {
    // Preserve the icons and their animation while only countdown text changes.
    statuses.forEach((effect, index) => {
      const timer = effect.seconds === null ? '' : `${(Math.ceil(effect.seconds * 10) / 10).toFixed(1)}s`;
      const label = element.children[index].lastElementChild;
      if (label.textContent !== timer) label.textContent = timer;
    });
  }
}
