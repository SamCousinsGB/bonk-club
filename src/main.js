import { victoryMessage } from "./victory.js";
import { loadPreferences } from "./preferences.js";
import { ControllerMenu } from "./controller-menu.js";
import { version, releaseNotes } from "../package.json";
import { SLOT_MODES, SLOT_LABELS, activeSlots } from "./slots.js";
import { defaultMatchOptions } from './match-options.js';
import { createOfflineRoom } from './offline-room.js';
import { defaultProfile } from './identity.js';
import { cleanDifficulty } from "./bot-difficulty.js";
import { GuestFrames } from "./render-state.js";
import { mergeMotion } from "./motion-stream.js";
import { GuestPrediction } from "./guest-prediction.js";
import {
  PALETTE,
  HAIRSTYLES,
  HAIR_COLOURS,
  FACIAL_HAIR,
  ACCESSORIES,
  randomProfile,
  cleanProfile,
  drawAppearance,
} from "./identity.js";
import { FINISHES, CAPES, TRAILS, AURAS, FINISH_SWATCHES } from "./cosmetics.js";
import { drawTrail, materialPaint } from "./cosmetic-art.js";
import { previewFighter } from "./cosmetic-preview.js";
import { secondaryAction } from "./arsenal.js";
import { pickupObjectCandidate } from "./object-carry.js";
import "./style.css";
import "@fontsource/barlow-condensed/latin-900.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-700.css";
import {
  World,
  W,
  H,
  STEP,
  ARENAS,
  CITY_ARENAS,
  COLORS,
  NAMES,
  WEAPONS,
  emptyInput,
} from "./engine.js";
import { Renderer } from "./renderer.js";
import { Sound } from "./audio.js";
import { RoomPresence } from "./room-presence.js";
import { createRoom, validCode, network } from "#bonk-platform";
import { FighterChat, ChatComposer } from "./chat.js";
import { BotChat } from "./bot-chat.js";
import { TouchControls, bindTouchZone, bindTouchButtons } from "./touch.js";
import { MobileScreen } from "./mobile-screen.js";
import { bindMouseControls } from "./mouse.js";
import { gameViewport, screenToWorld } from "./viewport.js";
import { SUDDEN_DEATH } from "./scale.js";

const preferences = await loadPreferences();
const desktop = globalThis.bonkDesktop;
document.body.classList.toggle('desktop-app', !!desktop);
const persist = patch => preferences.save(patch).catch(() => toast("Settings could not be saved. Check available disk space and folder permissions."));

const $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
$("#release-version").textContent = `v${version}`;
$("#release-summary").textContent = `— ${releaseNotes}`;
const renderer = new Renderer($("#game")),
  sound = new Sound(),
  keys = new Set(),
  touchControls = new TouchControls();
sound.muted = preferences.value.muted;
if (typeof preferences.value.reducedMotion === 'boolean') renderer.reduced = preferences.value.reducedMotion;
let touchInput = emptyInput();
let touchDevice = matchMedia("(pointer: coarse)").matches;
const mobileScreen = new MobileScreen();
const portraitScreen = matchMedia("(orientation: portrait)");
function enterGameScreen() {
  if (desktop) return;
  void mobileScreen.enter({ landscape: touchDevice });
}
async function requestGameFullscreen() {
  if (desktop) { await desktop.fullscreen(true); await syncFullscreenUi(); return; }
  await mobileScreen.enter({ landscape: touchDevice });
  if (!mobileScreen.fullscreen)
    toast("Fullscreen is unavailable in this browser. The game will use the available screen.");
}
async function toggleFullscreen() {
  try {
    if (desktop) { await desktop.fullscreen(!(await desktop.fullscreen())); await syncFullscreenUi(); return; }
    if (mobileScreen.fullscreen) await mobileScreen.exit();
    else await requestGameFullscreen();
  } catch {
    toast("Fullscreen is unavailable in this browser.");
  }
}
async function syncFullscreenUi(value) {
  const active = typeof value === 'boolean' ? value : desktop ? await desktop.fullscreen() : mobileScreen.fullscreen;
  $("#fullscreen").setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
  $("#fullscreen").setAttribute("aria-pressed", String(active));
  if ($("#game-fullscreen")) $("#game-fullscreen").textContent = active ? "EXIT FULLSCREEN" : "FULLSCREEN";
}
function needsRotation() {
  return playing && touchDevice && portraitScreen.matches;
}
document.body.classList.toggle("touch-device", touchDevice);
let world = null,
  room = null,
  remote = null,
  playing = false,
  view = "",
  accumulator = 0,
  netClock = 0,
  hudClock = 0,
  last = performance.now(),
  toastTimer,
  returnFocus = null;
const guestFrames = new GuestFrames("actors");
const guestWorldFrames = new GuestFrames("world");
const guestPrediction = new GuestPrediction();
let guestInputClock = 0;

const soloChat = new FighterChat();
const botChat = new BotChat();
const roomPresence = new RoomPresence();
const roomNoticeTimers = new Map();
let difficulty = preferences.value.difficulty;
let solo = false;
let lastDiagnosticRoom = null;
let profile = preferences.value.profile;
function saveProfile(value) {
  profile = cleanProfile(value, profile);
  void persist({ profile });
}
const roomOptions = () => ({ profile, difficulty });

let ping = 0;
let searchId = 0;
const mouse = { x: 640, y: 360, active: false, attack: false, block: false };
const keyboardMaps = {
  keyboard1: {
    left: "KeyA",
    right: "KeyD",
    jump: "KeyW",
    attack: "KeyE",
    block: "KeyG",
    throw: "KeyF",
    duck: "KeyS",
  },
};
const usedKeys = new Set([
  ...Object.values(keyboardMaps).flatMap(Object.values),
  "Space",
]);
const gamepads = () =>
  Array.from(navigator.getGamepads?.() || []).filter(Boolean);
function readInput(device) {
  if (view || chatComposer.isOpen || needsRotation() || document.hidden || !document.hasFocus()) return emptyInput();
  if (device === "touch") return { ...touchInput };
  const i = emptyInput();
  if (device.startsWith("gamepad")) {
    if (controllerMenu.suppressGameplay) return i;
    const pad = gamepads()[Number(device.slice(7))];
    if (!pad) return i;
    i.left = pad.axes[0] < -0.25 || pad.buttons[14]?.pressed === true;
    i.right = pad.axes[0] > 0.25 || pad.buttons[15]?.pressed === true;
    i.jump = pad.buttons[0]?.pressed === true;
    i.attack =
      pad.buttons[2]?.pressed === true || pad.buttons[7]?.pressed === true;
    i.block =
      pad.buttons[1]?.pressed === true || pad.buttons[6]?.pressed === true;
    i.throw = pad.buttons[3]?.pressed === true;
    i.duck =
      pad.buttons[13]?.pressed === true || pad.buttons[4]?.pressed === true;
    if (Math.hypot(pad.axes[2] || 0, pad.axes[3] || 0) > 0.3)
      i.aim = Math.atan2(pad.axes[3], pad.axes[2]);
    return i;
  }
  for (const [action, key] of Object.entries(
    keyboardMaps[device] || keyboardMaps.keyboard1,
  ))
    i[action] = keys.has(key);
  if (device === "keyboard1") {
    i.jump ||= keys.has("Space");
    i.attack ||= mouse.attack;
    i.block ||= mouse.block;
    const controlledId = room ? room.id : 0;
    const p = (!world && guestPrediction.player) || (world?.players || remote?.players || []).find(
      (p) => p.id === controlledId,
    );
    if (p && mouse.active)
      i.aim = Math.atan2(mouse.y - (p.y - 10), mouse.x - p.x);
  }
  return i;
}
function ownInput() {
  if (chatComposer.isOpen) return emptyInput();
  const i = readInput("keyboard1"),
    pad = gamepads()[0] ? readInput("gamepad0") : emptyInput();
  for (const k in i) if (k !== "aim") i[k] ||= pad[k] || touchInput[k];
  if (pad.aim !== null) i.aim = pad.aim;
  if (touchInput.aim !== null) i.aim = touchInput.aim;
  return i;
}
function clearInput() {
  keys.clear();
  mouseControls.reset();
  touchControls.reset();
  touchInput = emptyInput();
  if (room && !room.host) room.sendInput(emptyInput());
}
const chatComposer = new ChatComposer($("#chat-form"), {
  enabled: () => playing && !view,
  clearInput,
  send: text => {
    const sent = room ? room.sendChat(text) : !!soloChat.publish(0, text);
    if (!sent) toast("Wait a moment before sending another message.");
    return sent;
  },
});
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.add("hidden"), 4200);
}
function clearRoomNotices() {
  for (const timer of roomNoticeTimers.values()) clearTimeout(timer);
  roomNoticeTimers.clear();
  $("#room-notifications").replaceChildren();
  roomPresence.reset();
}
function roomNotice({ type, name, message }) {
  const list = $("#room-notifications");
  while (list.children.length >= 3) {
    const oldest = list.firstElementChild;
    clearTimeout(roomNoticeTimers.get(oldest));
    roomNoticeTimers.delete(oldest);
    oldest.remove();
  }
  const notice = document.createElement("div");
  notice.className = `room-notice room-notice-${type}`;
  const icon = document.createElement("span");
  icon.className = "room-notice-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = type === "join" ? "+" : "−";
  const label = document.createElement("span");
  label.textContent = message || `${name} ${type === "join" ? "joined" : "left"}`;
  notice.append(icon, label);
  list.append(notice);
  roomNoticeTimers.set(notice, setTimeout(() => {
    notice.remove();
    roomNoticeTimers.delete(notice);
  }, 4000));
  sound.play(type === "join" ? "player-join" : "player-leave");
}
function unlock() {
  try {
    sound.unlock();
  } catch {
    sound.muted = true;
  }
}
function showPanel(name, html) {
  if (chatComposer.isOpen) chatComposer.close();
  if ($("#panel").classList.contains("hidden"))
    returnFocus = document.activeElement;
  view = name;
  $("#menu").inert = true;
  $("#panel").dataset.view = name;
  $("#panel").innerHTML = html;
  $("#panel").scrollTop = 0;
  $("#panel").classList.remove("hidden");
  $("#panel").setAttribute("role", "dialog");
  $("#panel").setAttribute("aria-modal", "true");
  $("#panel")
    .querySelector("button,input,select")
    ?.focus({ preventScroll: true });
  clearInput();
  syncTouchUi();
}
function hidePanel() {
  controllerMenu.closeKeyboard();
  view = "";
  $("#menu").inert = playing;
  delete $("#panel").dataset.view;
  $("#panel").classList.add("hidden");
  $("#panel").innerHTML = "";
  $("#panel").removeAttribute("role");
  $("#panel").removeAttribute("aria-modal");
  returnFocus?.focus?.({ preventScroll: true });
  syncTouchUi();
}
const heading = (title) =>
  `<div class="dialog-head"><div><h2 id="panel-title">${title}</h2></div><button id="back" class="icon-button" aria-label="Back">×</button></div>`;
function setPlaying(value) {
  playing = value;
  $("#menu").inert = value || !!view;
  if (!value) { chatComposer.close(); soloChat.reset(); }
  document.body.classList.toggle("playing", value);
  $("#hud").classList.toggle("hidden", !value);
  $("#invite").classList.toggle("hidden", !value || !room || room.offline);
  setHtml($("#announcement"), "");
  syncTouchUi();
}
function home() {
  sound.stopAlarm();
  clearRoomNotices();
  mobileScreen.release();
  searchId++;
  room?.close();
  room = null;
  world = null;
  remote = null;
  guestFrames.reset(); guestWorldFrames.reset(); guestPrediction.reset(); guestInputClock = 0;
  setPlaying(false);
  hidePanel();
  history.replaceState(null, "", location.pathname);
}
function matchOptionsHtml() {
  const options = room.options;
  const count = (key, total) => options[key].length === total ? 'All' : options[key].length + ' selected';
  return `<div class="match-options"><h3>Match options</h3><button id="choose-weapons" class="option-row"><span>Weapons</span><b id="weapon-count">${count('weapons', Object.keys(WEAPONS).length)}</b><span aria-hidden="true">↗</span></button><button id="choose-maps" class="option-row"><span>Maps</span><b id="map-count">${count('maps', ARENAS.length)}</b><span aria-hidden="true">↗</span></button><label class="difficulty-row" for="difficulty">AI difficulty<select id="difficulty" ${room.host ? '' : 'disabled'}>${['easy','normal','hard'].map(value=>`<option value="${value}" ${options.difficulty === value ? 'selected' : ''}>${value[0].toUpperCase()+value.slice(1)}</option>`).join('')}</select></label></div>`;
}
function selectionMenu(kind) {
  if (!room || room.running) return;
  const current = room, draft = new Set(room.options[kind]);
  const weapons = kind === 'weapons', title = weapons ? 'Weapons' : 'Maps';
  const entries = weapons ? Object.entries(WEAPONS).map(([id,w])=>({id,name:w.name})) : ARENAS.map((a,id)=>({id,name:a.name}));
  showPanel('selection', heading(title) + `<div class="selection-toolbar"><span id="selection-count" role="status"></span>${room.host ? '<div><button id="select-all" class="text-button">All</button><button id="select-none" class="text-button">None</button></div>' : '<span>Chosen by host</span>'}</div><div class="selection-grid ${weapons ? 'weapon-selection' : 'map-selection'}">${entries.map(entry=>`<label class="selection-card"><input type="checkbox" data-choice="${entry.id}" ${room.options[kind].includes(entry.id) ? 'checked' : ''} ${room.host ? '' : 'disabled'}>${weapons ? '' : `<canvas data-map-preview="${entry.id}" width="220" height="124" aria-hidden="true"></canvas>`}<span>${esc(entry.name)}</span></label>`).join('')}</div><div class="selection-footer"><p id="selection-status" role="status">${room.host ? 'Choose at least one. Changes apply to this room.' : ''}</p><button id="selection-done" class="button primary">DONE</button></div>`);
  const sync = () => { $('#selection-count').textContent = draft.size + ' / ' + entries.length + ' selected'; $('#selection-done').disabled = !draft.size; };
  for (const input of document.querySelectorAll('[data-choice]')) input.onchange = () => {
    if (room !== current || !current.host) return;
    const id = weapons ? input.dataset.choice : Number(input.dataset.choice);
    if (input.checked) draft.add(id); else draft.delete(id); sync();
  };
  if ($('#select-all')) $('#select-all').onclick = () => { for (const e of entries) draft.add(e.id); for (const input of document.querySelectorAll('[data-choice]')) input.checked=true; sync(); };
  if ($('#select-none')) $('#select-none').onclick = () => { draft.clear(); for (const input of document.querySelectorAll('[data-choice]')) input.checked=false; sync(); };
  for (const canvas of document.querySelectorAll('[data-map-preview]')) {
    const arena=ARENAS[Number(canvas.dataset.mapPreview)], c=canvas.getContext('2d');
    c.fillStyle='#101d25'; c.fillRect(0,0,220,124); c.scale(220/W,124/H);
    c.fillStyle='#839aa4'; for(const p of arena.platforms || []) c.fillRect(p.x,p.y,p.w,Math.max(18,p.h));
    c.fillStyle='#d5fa43'; for(const [x,y] of arena.spawns || []) { c.beginPath();c.arc(x,y-20,28,0,Math.PI*2);c.fill(); }
  }
  $('#back').onclick = lobby; $('#selection-done').onclick = () => { if(current.host) current.setOptions({...current.options,[kind]:[...draft]}); lobby(); }; sync();
}
function offlineLobby(reason = network.reason) {
  home(); solo = true;
  room = createOfflineRoom(roomCallbacks(), roomOptions(), reason);
  lobby();
}
function startWorld(ids) {
  enterGameScreen();
  const options = room?.options || defaultMatchOptions(difficulty), pool = options.maps;
  world = new World({
    players: room ? activeSlots(room.slots, room.roster).map(p => p.id) : [0, 1, 2, 3],
    bots: room ? activeSlots(room.slots, room.roster).filter(p => p.bot).map(p => p.id) : [1, 2, 3],
    fillSolo: false, difficulty: options.difficulty,
    arena: pool[Math.floor(Math.random() * pool.length)],
    shuffle: pool.length > 1, arenaPool: pool, weaponPool: options.weapons,
  });
  world.setProfiles(room ? room.roster : [{ id: 0, ...profile }]);
  botChat.attach(world);
  remote = null;
  guestFrames.reset(); guestWorldFrames.reset(); guestPrediction.reset(); guestInputClock = 0;
  renderer.lastEvent = 0;
  renderer.particles = [];
  renderer.words = [];
  renderer.impacts = [];
  renderer.deathCues.reset();
  accumulator = 0;
  simulationLast = performance.now();
  hidePanel();
  setPlaying(true);
  unlock();
}
let previewRenderer = null, previewPose = "Run", previewLast = 0;
function characterHtml() {
  const swatches = (choices, key, title) => `<fieldset class="appearance-swatches"><legend>${title}</legend><div class="colour-options">${choices.map(c => `<button type="button" class="colour-option" data-appearance="${key}" data-value="${c.value}" aria-label="${title}: ${c.name}" title="${c.name}" aria-pressed="${profile[key] === c.value}" style="--colour:${c.value}"></button>`).join("")}</div></fieldset>`;
  const select = (key, title, choices) => `<label>${title}<select id="player-${key}" data-profile-field="${key}">${choices.map(value => `<option ${profile[key] === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>`;
  const choices = (values, key, title) => `<fieldset class="appearance-swatches"><legend>${title}</legend><div class="cosmetic-options">${values.map(value => `<button type="button" class="cosmetic-option" data-appearance="${key}" data-value="${value}" aria-pressed="${profile[key] === value}" ${key === "finish" ? `style="--finish:${FINISH_SWATCHES[value]}"` : ""}>${key === "finish" ? '<span class="finish-swatch" aria-hidden="true"></span>' : ""}<span>${value}</span></button>`).join("")}</div></fieldset>`;
  return `<div class="character-editor"><div class="character-portrait"><canvas id="character-preview" width="520" height="560" role="img" aria-label="Character preview"></canvas><div class="preview-controls" role="group" aria-label="Preview movement">${["Stand","Run","Jump"].map(pose=>`<button type="button" data-preview-pose="${pose}" aria-pressed="${previewPose === pose}">${pose}</button>`).join("")}</div><button type="button" id="random-character" class="button secondary">RANDOMISE</button></div><div class="character-fields"><label>NAME<input id="player-name" maxlength="20" autocomplete="nickname" value="${esc(profile.name)}"></label><div class="character-tabs" role="tablist" aria-label="Customisation">${["Body","Hair","Gear","Effects"].map((tab,i)=>`<button type="button" role="tab" id="character-tab-${tab}" aria-controls="character-section-${tab}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-character-tab="${tab}">${tab}</button>`).join("")}</div><section id="character-section-Body" class="character-section" role="tabpanel" aria-labelledby="character-tab-Body">${swatches(PALETTE,"color","Body colour")}${choices(FINISHES,"finish","Finish")}</section><section id="character-section-Hair" class="character-section" role="tabpanel" aria-labelledby="character-tab-Hair" hidden>${select("hair","Hairstyle",HAIRSTYLES)}${swatches(HAIR_COLOURS,"hairColor","Hair colour")}${select("facialHair","Facial hair",FACIAL_HAIR)}</section><section id="character-section-Gear" class="character-section" role="tabpanel" aria-labelledby="character-tab-Gear" hidden>${choices(CAPES,"cape","Cape")}${swatches(PALETTE,"capeColor","Cape colour")}${select("accessory","Headwear",ACCESSORIES)}</section><section id="character-section-Effects" class="character-section" role="tabpanel" aria-labelledby="character-tab-Effects" hidden>${choices(TRAILS,"trail","Movement trail")}${choices(AURAS,"aura","Aura")}</section></div></div>`;
}
function drawPreview(now = performance.now()) {
  const canvas = $("#character-preview");
  if (!canvas) { previewRenderer = null; previewLast = 0; return; }
  if (previewRenderer?.canvas !== canvas) { previewRenderer = new Renderer(canvas); previewLast = now; }
  const r = previewRenderer, c = r.ctx, time = renderer.reduced ? 0 : now / 1000;
  const dt = Math.max(0, Math.min(.05, (now - previewLast) / 1000)); previewLast = now;
  const p = previewFighter(profile, renderer.reduced ? "Stand" : previewPose, time);
  r.reduced = renderer.reduced;
  r.cosmetics.update({round: 0, time, players: [p]}, dt, renderer.reduced);
  c.setTransform(1,0,0,1,0,0); c.clearRect(0,0,canvas.width,canvas.height);
  const glow=c.createRadialGradient(260,275,15,260,275,250);glow.addColorStop(0,profile.color+"22");glow.addColorStop(1,profile.color+"00");c.fillStyle=glow;c.fillRect(0,0,520,560);
  c.save(); c.translate(270,290); c.scale(4.6,4.6);
  c.strokeStyle="#c5e8e21f";c.lineWidth=.3;c.beginPath();c.ellipse(0,38,41,6,0,0,Math.PI*2);c.stroke();
  drawTrail(c,p,r.cosmetics.entries.get(0)); r.fighter(p,time,1,false); c.restore();
  canvas.setAttribute("aria-label", `${profile.name}: ${profile.finish} finish, ${profile.cape} cape, ${profile.trail} trail, ${profile.aura} aura, ${profile.hair}, ${profile.facialHair}, ${profile.accessory}`);
}
function submitProfile(overrides = {}) {
  if (!$("#player-name")) return;
  saveProfile({
    ...profile,
    name: $("#player-name").value,
    ...Object.fromEntries([...document.querySelectorAll("[data-profile-field]")].map(el => [el.dataset.profileField, el.value])),
    ...overrides,
  });
  syncColourOptions();
  room?.setProfile(profile);
  if (!room && world) world.setProfiles([{ id: 0, ...profile }]);
  drawPreview();
}
function syncColourOptions(acceptRoster = false) {
  const own = room?.roster.find((p) => p.id === room.id);
  if (own && acceptRoster) saveProfile(own);
  for (const button of document.querySelectorAll("[data-appearance]")) {
    const key = button.dataset.appearance;
    button.disabled = key === "color" && !!room?.roster.some(
      (p) => p.id !== room.id && p.color === button.dataset.value,
    );
    button.setAttribute(
      "aria-pressed",
      String(profile[key] === button.dataset.value),
    );
    button.title = (button.getAttribute("aria-label") || button.dataset.value) + (button.disabled ? " (in use)" : "");
  }
  for (const el of document.querySelectorAll("[data-profile-field]")) el.value = profile[el.dataset.profileField];
  drawPreview();
}
function wireCharacter() {
  $("#player-name").onchange = () => submitProfile();
  for (const el of document.querySelectorAll("[data-profile-field]")) el.onchange = () => submitProfile();
  for (const button of document.querySelectorAll("[data-appearance]"))
    button.onclick = () => {
      submitProfile({ [button.dataset.appearance]: button.dataset.value });
    };
  $("#random-character").onclick = () => submitProfile(randomProfile(
    { ...profile, name: $("#player-name").value }, room?.roster.filter(p => p.id !== room.id) || [],
  ));
  const tabs = [...document.querySelectorAll("[data-character-tab]")];
  const activate = tab => {
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected)); item.tabIndex = selected ? 0 : -1;
      document.getElementById(`character-section-${item.dataset.characterTab}`).hidden = !selected;
    }
  };
  for (const [i, tab] of tabs.entries()) {
    tab.onclick = () => activate(tab);
    tab.onkeydown = e => {
      const index = e.key === "ArrowRight" ? (i+1)%tabs.length : e.key === "ArrowLeft" ? (i+tabs.length-1)%tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length-1 : -1;
      if(index < 0)return; e.preventDefault(); activate(tabs[index]); tabs[index].focus();
    };
  }
  for(const button of document.querySelectorAll("[data-preview-pose]"))button.onclick = () => {
    previewPose = button.dataset.previewPose;
    for(const other of document.querySelectorAll("[data-preview-pose]")) other.setAttribute("aria-pressed", String(other === button));
  };
  syncColourOptions();
}
function characterMenu() {
  const fromLobby = !!room && !room.running;
  if (fromLobby && !room.host) room.setReady(false);
  showPanel(
    "character",
    heading("Customise") +
      characterHtml() +
      '<button id="character-close" class="button primary">SAVE</button>',
  );
  wireCharacter();
  const close = () => {
    submitProfile();
    if (fromLobby && room && !room.running) lobby(); else hidePanel();
  };
  $("#back").onclick = close;
  $("#character-close").onclick = close;
}
function joinHtml() {
  return '<div class="join-row"><input id="join-code" class="room-input" aria-label="Six-character room code" maxlength="6" placeholder="ABC234" autocomplete="off" spellcheck="false"><button id="join-room" class="button secondary">JOIN ROOM</button></div>';
}
function wireJoin() {
  $("#join-room").onclick = () => {
    submitProfile();
    connectRoom($("#join-code").value.trim().toUpperCase());
  };
  $("#join-code").onkeydown = (e) => {
    if (e.key === "Enter") $("#join-room").click();
  };
}
function updateLobby() {
  if (view !== 'lobby' || !room) return;
  const roster=room.roster, options=room.options;
  $('#lobby-players').innerHTML = [0,1,2,3].map(id=>{
    const p=roster.find(q=>q.id===id), mode=room.slots[id], bot=!p && ['mixed','ai'].includes(mode);
    const title=p ? p.name : bot ? 'Bot' : mode==='closed' ? 'Closed' : 'Open place';
    const status=id===0 ? 'Host' : p ? room.ready.has(id) ? 'Ready' : 'Not ready' : bot ? options.difficulty[0].toUpperCase()+options.difficulty.slice(1) : mode==='closed' ? 'Unused slot' : 'Waiting for player';
    const color=p?.color || (bot ? COLORS[id] : '#73818a');
    return `<article class="fighter-card ${p ? 'human' : bot ? 'bot' : 'vacant'}" style="--fighter:${color}"><div class="fighter-card-top"><span>${String(id+1).padStart(2,'0')}</span><span class="fighter-status ${id===0 || room.ready.has(id) ? 'is-ready' : ''}">${status}</span></div>${p || bot ? `<canvas data-portrait="${id}" width="240" height="220" aria-hidden="true"></canvas>` : '<div class="empty-portrait" aria-hidden="true">+</div>'}<h4>${esc(title)}${p?.id===room.id ? '<small>You</small>' : ''}</h4>${room.host && id!==0 ? `<select data-slot="${id}" aria-label="Slot ${id+1} type">${SLOT_MODES.map(value=>`<option value="${value}" ${value===mode?'selected':''}>${SLOT_LABELS[value]}</option>`).join('')}</select>` : `<span class="slot-label">${id===0?'Player':SLOT_LABELS[mode]}</span>`}</article>`;
  }).join('');
  for(const canvas of $('#lobby-players').querySelectorAll('[data-portrait]')) {
    const id=Number(canvas.dataset.portrait), p=roster.find(p=>p.id===id) || defaultProfile(id);
    const r=new Renderer(canvas), c=r.ctx; r.reduced=true;
    c.translate(120,103);c.scale(2.4,2.4);r.fighter(previewFighter(p,'Stand',0),0,1,false);
  }
  for(const select of $('#lobby-players').querySelectorAll('[data-slot]')) select.onchange=()=>{
    const id=select.dataset.slot; room.setSlot(Number(id),select.value);
    $('#lobby-players').querySelector('[data-slot="'+id+'"]').focus();
  };
  $('#lobby-count').textContent=roster.length+' / '+room.slots.filter(mode=>['mixed','player'].includes(mode)).length+' players';
  $('#weapon-count').textContent=options.weapons.length===Object.keys(WEAPONS).length?'All':options.weapons.length+' selected';
  $('#map-count').textContent=options.maps.length===ARENAS.length?'All':options.maps.length+' selected';
  $('#difficulty').value=options.difficulty;
  const start=$('#start-match');
  if(start) {
    start.disabled=!room.canStart();
    const waiting=roster.filter(p=>p.id!==0 && !room.ready.has(p.id)).length;
    $('#start-status').textContent=waiting ? 'Waiting for '+waiting+' player'+(waiting===1?'':'s')+' to ready up.' : activeSlots(room.slots,roster).length<2 ? 'Add a bot or wait for another player.' : 'Everyone is ready.';
  } else {
    const ready=room.ready.has(room.id);
    $('#ready-up').textContent=ready?'NOT READY':'READY UP';
    $('#ready-up').setAttribute('aria-pressed',String(ready));
    $('#start-status').textContent=ready?'Ready. Waiting for the host to start.':'Customise your character, then ready up.';
  }
}
function lobby() {
  if(!room || room.closed || room.running) return;
  setPlaying(false);
  showPanel('lobby', heading('Play') +
    `<div class="lobby-invite"><div class="invite-code-block"><label for="room-code">Invite code</label><input id="room-code" value="${esc(room.code)}" readonly aria-label="Invite code"><span id="lobby-count"></span></div><div class="invite-actions"><button id="copy-code" class="text-button" ${room.offline?'disabled':''}>Copy code</button><button id="copy-link" class="text-button" ${room.offline?'disabled':''}>Copy link</button></div></div>${room.offline ? `<p class="offline-status" role="status">${esc(room.offlineReason)} Invites are unavailable offline.</p>` : ''}<div class="lobby-layout"><section class="fighters-section" aria-label="Players"><div class="section-heading"><h3>Players</h3></div><div id="lobby-players" class="lobby-players"></div></section><aside class="lobby-sidebar">${matchOptionsHtml()}${room.host ? '' : '<button id="lobby-customise" class="button secondary">CUSTOMISE</button>'}${!room.offline ? '<details class="join-other"><summary>Join another room</summary>'+joinHtml()+'</details>' : ''}</aside></div><div class="lobby-footer"><div><p id="start-status" role="status" aria-live="polite"></p><button id="leave-lobby" class="text-button">Leave room</button></div>${room.host ? '<button id="start-match" class="button primary">START MATCH <span aria-hidden="true">→</span></button>' : '<button id="ready-up" class="button primary" aria-pressed="false">READY UP</button>'}</div>`);
  $('#back').onclick=home; $('#leave-lobby').onclick=home;
  if($('#join-room')) wireJoin();
  $('#choose-weapons').onclick=()=>selectionMenu('weapons');
  $('#choose-maps').onclick=()=>selectionMenu('maps');
  $('#difficulty').onchange=e=>{ if(!room.host)return; difficulty=cleanDifficulty(e.target.value); void persist({difficulty}); room.setOptions({...room.options,difficulty}); };
  if($('#lobby-customise')) $('#lobby-customise').onclick=characterMenu;
  if($('#ready-up')) $('#ready-up').onclick=()=>room.setReady(!room.ready.has(room.id));
  $('#room-code').onclick=e=>e.target.select();
  $('#copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);toast('Invite code copied.');}catch{$('#room-code').select();toast('Select and copy the invite code.');}};
  $('#copy-link').onclick=copyInvite;
  if($('#start-match')) $('#start-match').onclick=()=>{enterGameScreen();room.start();};
  updateLobby();
}
function onlineMenu(message = "") {
  unlock();
  if (!network.available) {
    return offlineLobby();
  }
  showPanel(
    "online",
    heading("Join room") +
      (message ? `<p class="error" role="alert">${esc(message)}</p>` : "") +
      '<button id="create-room" class="button primary">CREATE A ROOM</button>' +
      joinHtml() +
      '<button id="quick-match" class="button secondary">QUICK MATCH</button><button id="play-offline" class="button secondary">PLAY OFFLINE</button>' +
      (lastDiagnosticRoom
        ? '<button id="connection-details" class="button secondary">CONNECTION DETAILS</button>'
        : ""),
  );
  $("#back").onclick = home;
  $("#create-room").onclick = () => connectRoom();
  $("#play-offline").onclick = () => offlineLobby("The room service could not be reached.");
  $("#quick-match").onclick = quickMatch;
  if ($("#connection-details"))
    $("#connection-details").onclick = () =>
      connectionDetails(() => onlineMenu(message));
  wireJoin();
  const code = new URLSearchParams(location.search).get("room");
  if (validCode(code)) $("#join-code").value = code;
}
function connectionDetails(back) {
  const source = room || lastDiagnosticRoom;
  if (!source) return;
  const report = JSON.stringify(source.connectionReport(), null, 2);
  showPanel(
    "connection-details",
    heading("Connection details") +
      "<p>Copy this report from both devices after connection trouble or freezing. It excludes IP addresses, room codes and credentials.</p>" +
      `<textarea id="connection-report" class="connection-report" aria-label="Connection report" readonly rows="14">${esc(report)}</textarea>` +
      '<button id="copy-connection-report" class="button primary">COPY REPORT</button><button id="connection-back" class="button secondary">BACK</button>',
  );
  $("#back").onclick = back;
  $("#connection-back").onclick = back;
  const reportField = $("#connection-report");
  // Open from retained evidence immediately; a stalled/closed browser connection
  // must not block the panel. Only update this particular instance of the view.
  void source.diagnostics
    .refresh()
    .then(() => {
      if (reportField.isConnected && document.activeElement !== reportField)
        reportField.value = JSON.stringify(source.connectionReport(), null, 2);
    })
    .catch(() => {
      /* Keep the retained report if browser statistics fail. */
    });
  $("#copy-connection-report").onclick = async () => {
    try {
      await navigator.clipboard.writeText(reportField.value);
      toast("Connection report copied.");
    } catch {
      $("#connection-report").select();
      toast("Select and copy the report.");
    }
  };
}
async function quickMatch() {
  if (!network.available) return onlineMenu();
  unlock();
  clearRoomNotices();
  enterGameScreen();
  solo = false;
  room?.close();
  room = null;
  const search = ++searchId;
  showPanel(
    "connecting",
    heading("Finding players…") + "<p>Looking for an available room.</p>",
  );
  $("#back").onclick = () => {
    searchId++;
    room?.close();
    room = null;
    onlineMenu();
  };
  const codes = "ABCDEFGH".split("").map((letter) => "PUB" + letter + "AA");
  for (const code of codes) {
    if (search !== searchId) return;
    let candidate = createRoom(roomCallbacks(), roomOptions());
    room = candidate;
    try {
      await candidate.create(code);
    } catch (error) {
      candidate.close();
      if (search !== searchId) return;
      if (error.type !== "unavailable-id") {
        room = null;
        onlineMenu(error.message);
        return;
      }
      candidate = createRoom(roomCallbacks(), roomOptions());
      room = candidate;
      try {
        await candidate.join(code);
      } catch (joinError) {
        candidate.close();
        if (search !== searchId) return;
        if (
          ["room-full", "room-busy", "peer-unavailable"].includes(
            joinError.type,
          )
        )
          continue;
        room = null;
        onlineMenu(joinError.message);
        return;
      }
    }
    if (search !== searchId) {
      candidate.close();
      return;
    }
    candidate.publicRoom = true;
    candidate.callbacks = roomCallbacks();
    room = candidate;
    history.replaceState(
      null,
      "",
      location.pathname + "?room=" + candidate.code,
    );
    if (candidate.running && !playing) enterGuest();
    else if (!candidate.running) lobby();
    return;
  }
  room = null;
  onlineMenu(
    "All public rooms are full. Try again shortly or create an invite room.",
  );
}
function enterGuest() {
  world = null;
  remote = null;
  guestFrames.reset(); guestWorldFrames.reset(); guestPrediction.reset(); guestInputClock = 0;
  renderer.lastEvent = 0;
  renderer.particles = [];
  renderer.words = [];
  renderer.impacts = [];
  renderer.deathCues.reset();
  hidePanel();
  setPlaying(true);
}
function roomCallbacks() {
  return {
    onRoster: (roster) => {
      if (room) for (const change of roomPresence.update(room, roster)) roomNotice(change);
      if (room?.host && world) {
        world.syncSlots(room.slots, roster);
        room.sendState(world.snapshot());
      }
      const own = roster.find((p) => p.id === room?.id);
      if (own) saveProfile(own);
      updateLobby();
      if (view === "character") syncColourOptions();
    },
    onLobby: lobby,
    onStatus: (status) => {
      if ($("#connection-status")) $("#connection-status").textContent = status;
    },
    onStart: () => {
      if (room.host) startWorld(room.roster.map((p) => p.id));
      else enterGuest();
    },
    onWorldState: (s) => guestWorldFrames.push(s, performance.now()),
    onState: (s) => {
      remote = s;
      const now = performance.now();
      guestFrames.push(s, now);
      guestPrediction.receive(s, room.id, now);
    },
    onError: (message) => {
      const wasConnected = room?.roster.some(p => p.id === room.id);
      clearRoomNotices();
      if (wasConnected) roomNotice({ type: "leave", message: "Disconnected from room" });
      lastDiagnosticRoom = room;
      room?.close();
      room = null;
      world = null;
      remote = null;
      guestFrames.reset(); guestWorldFrames.reset(); guestPrediction.reset(); guestInputClock = 0;
      setPlaying(false);
      onlineMenu(message);
    },
    onNotice: toast,
    onPing: (n) => (ping = n),
  };
}
async function connectRoom(code) {
  if (!network.available) return offlineLobby();
  solo = false;
  if (code !== undefined && !validCode(code))
    return toast("Enter the six-character code from your friend.");
  unlock();
  clearRoomNotices();
  enterGameScreen();
  room?.close();
  const next = createRoom(roomCallbacks(), roomOptions());
  room = next;
  lastDiagnosticRoom = next;
  showPanel(
    "connecting",
    heading(code ? "Joining room…" : "Opening room…") +
      `<p id="connection-status" role="status">Connecting to the room service…</p>`,
  );
  $("#back").onclick = () => {
    next.close();
    room = null;
    onlineMenu();
  };
  try {
    if (code) await next.join(code);
    else await next.create();
    if (room !== next || next.closed) return;
    history.replaceState(null, "", location.pathname + "?room=" + next.code);
    if (!next.running) lobby();
  } catch (e) {
    if (room !== next) return;
    next.close();
    room = null;
    onlineMenu(e.message);
  }
}
async function copyInvite() {
  if (!room) return;
  const link = new URL(location.pathname, location.origin);
  link.searchParams.set("room", room.code);
  try {
    await navigator.clipboard.writeText(link.href);
    toast("Invite link copied.");
  } catch {
    if (view === "lobby") {
      $("#room-code").select();
      toast("Copy the invite code and send it to your friend.");
    } else showInvite(link.href);
  }
}
function showInvite(link = location.href) {
  if (!room) return;
  showPanel(
    "invite",
    heading("Invite players") +
      `<p>Room ${esc(room.code)} · ${room.roster.length}/${room.slots.filter(mode => ["mixed", "player"].includes(mode)).length} players</p><input id="invite-link" class="room-input" aria-label="Invite link" readonly value="${esc(link)}"><button id="copy-link" class="button primary">COPY LINK</button><p>The game continues. Friends can join open player slots.</p><button id="invite-close" class="button secondary">BACK TO GAME</button>`,
  );
  $("#back").onclick = hidePanel;
  $("#invite-close").onclick = hidePanel;
  $("#copy-link").onclick = copyInvite;
  $("#invite-link").onclick = (e) => e.target.select();
}
function gameMenu(forceOpen = false) {
  if (!playing) return;
  if (view && forceOpen !== true) {
    hidePanel();
    return;
  }
  showPanel(
    "game-menu",
    heading("Game menu") +
      `<p>The game continues while this menu is open.</p><button id="resume" class="button primary">BACK TO GAME</button>${room && !room.offline ? '<button id="menu-invite" class="button secondary">INVITE PLAYERS</button><button id="connection-details" class="button secondary">CONNECTION DETAILS</button>' : ""}<button id="edit-character" class="button secondary">CUSTOMISE</button><button id="leave" class="button secondary">${room ? "LEAVE ROOM" : "MAIN MENU"}</button>${room?.host ? '<p class="subtle">Closing the host’s game ends this room.</p>' : ""}`,
  );
  $("#back").onclick = hidePanel;
  $("#resume").onclick = () => {
    if (touchDevice) enterGameScreen();
    hidePanel();
  };
  if (desktop || mobileScreen.supported) {
    $("#resume").insertAdjacentHTML("afterend", '<button id="game-fullscreen" class="button secondary">FULLSCREEN</button>');
    $("#game-fullscreen").onclick = toggleFullscreen;
  }
  $("#edit-character").insertAdjacentHTML("beforebegin", `<button id="game-sound" class="button secondary">${sound.muted ? "UNMUTE SOUND" : "MUTE SOUND"}</button>`);
  $("#game-sound").onclick = () => $("#sound").click();
  if (room && !room.host) {
    const currentRoom = room;
    $("#resume").insertAdjacentHTML("beforebegin", `<p id="network-status" class="subtle">Round-trip delay: ${ping} ms</p>`);
    void room.diagnostics.refresh().then(() => {
      if (room !== currentRoom || !$("#network-status")) return;
      const pair = room.connectionReport().connections.find(c => c.direction === "outgoing" && c.selectedPair)?.selectedPair;
      const route = pair ? [pair.local, pair.remote].includes("relay") ? "Relay" : "Direct" : "Connecting";
      $("#network-status").textContent = `${route} · Round-trip delay: ${ping} ms`;
    });
  }
  syncFullscreenUi();
  $("#leave").onclick = home;
  $("#edit-character").onclick = characterMenu;
  if ($("#menu-invite")) $("#menu-invite").onclick = () => showInvite();
  if ($("#connection-details"))
    $("#connection-details").onclick = () =>
      connectionDetails(() => gameMenu(true));
}
function setHtml(element, value) {
  if (element._lastHtml === value) return;
  element._lastHtml = value;
  element.innerHTML = value;
}
function updateHud(s) {
  const high = Math.max(...s.scores);
  const leaders =
    high > 0 ? s.players.filter((p) => s.scores[p.id] === high) : [];
  setHtml($("#scoreboard"), s.players
    .map(
      (p) =>
        `<div class="score ${leaders.some((q) => q.id === p.id) ? "leader" : ""}" style="opacity:${p.alive ? 1 : 0.4}"><div class="score-top" style="color:${p.color || COLORS[p.id]}"><span>${esc(p.name || NAMES[p.id])}<em>${!p.bot && ((room && p.id === room.id) || (solo && p.id === 0)) ? "YOU" : ""}</em></span><b>${s.scores[p.id]}</b></div><div class="health"><i style="background:${p.color || COLORS[p.id]};width:${Math.max(0, Math.ceil(p.hp))}%"></i></div>${equipmentInfo(p)}</div>`,
    )
    .join(""));
  $("#arena-name").textContent = ARENAS[s.arenaIndex].name;
  $("#round-label").textContent = `ROUND ${s.round}`;
  $("#leader-label").textContent = leaders.length
    ? `${leaders.length > 1 ? "TIED" : "LEADER"}: ${leaders.map((p) => p.name || NAMES[p.id]).join(" / ")}`
    : "";
  const status = $("#round-status");
  const warning =
    s.fields.some(f => f.kind === "shockwave") ? "Nuclear blast" :
    s.players.length < 2 ? "Waiting for another player" :
    s.phase === "fight" && s.elapsed >= SUDDEN_DEATH - 10
      ? s.elapsed >= SUDDEN_DEATH
        ? "Sudden death\nHealth draining"
        : `Sudden death in ${Math.ceil(SUDDEN_DEATH - s.elapsed)}`
      : "";
  if (status.textContent !== warning) status.textContent = warning;
  status.classList.toggle("hidden", !warning);
  const a = $("#announcement");
  if (s.phase === "countdown") {
    setHtml(a, `${s.phaseTime > 0.45 ? Math.ceil(s.phaseTime) : "FIGHT"}<small>${ARENAS[s.arenaIndex].name}</small>${ARENAS[s.arenaIndex].instruction ? `<small class="arena-instruction">${ARENAS[s.arenaIndex].instruction}</small>` : ""}`);
  } else if (s.phase === "result") {
    const message = victoryMessage(s, s.players.find((p) => p.id === s.winner)?.name || NAMES[s.winner] || "Player");
    setHtml(a, `<span class="victory-title" style="--victory-title-size:${Math.min(7, 110 / [...message.title].length)}vw">${esc(message.title)}</span>${message.detail ? `<span class="victory-detail">${esc(message.detail)}</span>` : ""}<small>Next arena in ${Math.max(1, Math.ceil(s.phaseTime))}</small>`);
  } else setHtml(a, "");
}
function objectAction(state = world || remote) {
  const player = ownPlayer(state);
  if (player?.carryId) return { label: "DROP", description: "Drop the carried object. Aim and fire, or use throw, to throw it" };
  if (state && pickupObjectCandidate(state, player)) return { label: "PICK UP", description: "Pick up the physical object in front of you" };
  return secondaryAction(player);
}
function equipmentInfo(p) {
  if (!p.alive) return '<small>ELIMINATED</small>';
  const weapon=p.weapon && WEAPONS[p.weapon];
  const name=p.carryId ? 'CARRYING' : weapon?.name || 'FISTS';
  const detail=weapon ? `${p.ammo} · ${weapon.proneOnly && (!p.prone || !p.ground) ? 'LIE DOWN TO FIRE' : Math.ceil(p.hp)+' HP'}` : Math.ceil(p.hp)+' HP';
  return `<small title="${esc(name+' · '+detail)}"><span class="held-weapon">${esc(name)}</span><span class="weapon-state">${esc(detail)}</span></small>`;
}
function interpolated(now) {
  const actors = guestFrames.sample(now), world = guestWorldFrames.sample(now);
  const state = actors && world && actors.round === world.round && actors.arenaIndex === world.arenaIndex
    ? mergeMotion(world, actors, true) : actors;
  return guestPrediction.sample(state, now);
}
let simulationLast = performance.now();
function simulate(now) {
  const dt = Math.max(0, Math.min((now - simulationLast) / 1000, STEP * 8));
  simulationLast = now;
  touchInput =
    canUseTouch() && !view && !chatComposer.isOpen && !needsRotation() && !document.hidden
      ? touchControls.read(now)
      : emptyInput();
  netClock += dt;
  if (world) {
    accumulator += dt;
    while (accumulator >= STEP) {
      const inputs = room
        ? { ...room.getInputs(now, world.hitstop <= 0), 0: ownInput() }
        : { 0: ownInput() };
      world.step(STEP, inputs);
      accumulator -= STEP;
    }
  }
  if (world && playing) {
    (room?.chat || soloChat).setRound(world.round);
    botChat.update(world, (id, text) => room ? room.sendBotChat(id, text) : !!soloChat.publish(id, text));
  }
  if (room && playing && !room.host) {
    guestInputClock += dt;
    while (guestInputClock >= 1 / 60) {
      const input = view || document.hidden ? emptyInput() : ownInput();
      const sequence = room.sendInput(input);
      guestPrediction.advance(input, sequence, now);
      guestInputClock -= 1 / 60;
    }
  }
  if (room?.host && playing && netClock >= 1 / 30) {
    netClock %= 1 / 30;
    if (world) room.sendState(world.snapshot());
  }
  if (document.hidden) sound.update(playing ? world || remote : null);
}
// Simulation and WebRTC sends have their own clock; rendering may stop in a hidden tab.
const simulationClock = new Worker(
  new URL("./clock-worker.js", import.meta.url),
  { type: "module" },
);
simulationClock.onmessage = () => {
  simulate(performance.now());
  simulationClock.postMessage(null);
};
function frame(now) {
  controllerMenu.update(document.hasFocus() ? gamepads()[0] : null, now);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  hudClock += dt;
  const state = world ? world.snapshot() : interpolated(now);
  const chat = room?.chat || soloChat;
  if (state) chat.setRound(state.round);
  renderer.chatMessages = playing ? chat.snapshot() : [];

  sound.update(playing ? state : null);
  renderer.localId = room ? room.id : solo ? 0 : null;
  if (state) {
    const weapons = !world && room ? guestPrediction.weapons : null;
    renderer.events(state.events, sound, state.time, false, weapons ? e=>weapons.acceptEvent(e) : null);
    if (weapons) renderer.events(weapons.takeEvents(), sound, state.time, true);
    if (hudClock > 0.07) {
      hudClock = 0;
      updateHud(state);
    }
  }
  renderer.draw(state, dt, renderer.reduced ? 0 : now / 1000);
  updateTouchView(state, dt);
  drawPreview(now);
  requestAnimationFrame(frame);
}
$("#play").onclick = () => connectRoom();
$("#character").onclick = characterMenu;
$("#pause").onclick = gameMenu;
$("#invite").onclick = copyInvite;
$("#sound").onclick = () => {
  unlock();
  sound.muted = !sound.muted;
  void persist({ muted: sound.muted });
  $("#sound").textContent = sound.muted ? "♩" : "♪";
  $("#sound").setAttribute(
    "aria-label",
    sound.muted ? "Unmute sound" : "Mute sound",
  );
  $("#sound").setAttribute("aria-pressed", String(sound.muted));
  if ($("#game-sound")) $("#game-sound").textContent = sound.muted ? "UNMUTE SOUND" : "MUTE SOUND";
  toast(sound.muted ? "Sound off." : "Sound on.");
};
$("#fullscreen").onclick = toggleFullscreen;
$("#sound").textContent = sound.muted ? "♩" : "♪";
$("#sound").setAttribute("aria-label", sound.muted ? "Unmute sound" : "Mute sound");
$("#sound").setAttribute("aria-pressed", String(sound.muted));
if (desktop) {
  desktop.onFullscreenChange(syncFullscreenUi);
  $("#character").insertAdjacentHTML("afterend", '<button id="quit-game" class="button secondary">QUIT GAME</button>');
  $("#quit-game").onclick = () => { home(); void desktop.quit(); };
  $(".brand").onclick = event => { event.preventDefault(); home(); };
}
syncFullscreenUi();
window.addEventListener("keydown", (e) => {
  if (sound.context?.state === "suspended") unlock();
  if (chatComposer.handleKey(e)) return;
  if (e.code === "Escape") {
    if ($("#controller-keyboard")) { e.preventDefault(); controllerMenu.closeKeyboard(); return; }
    if (["connection-details", "character", "selection"].includes(view)) {
      e.preventDefault();
      $("#back").click();
      return;
    }
    if (playing) {
      e.preventDefault();
      gameMenu();
    } else if (view && !["room", "connecting", "lobby"].includes(view))
      hidePanel();
    return;
  }
  if (e.code === "Tab" && view) {
    const focusable = Array.from(
      $("#panel").querySelectorAll("button:not(:disabled),input,select"),
    );
    if (!focusable.length) return;
    const first = focusable[0],
      last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if (playing && usedKeys.has(e.code)) {
    e.preventDefault();
    if (!view) keys.add(e.code);
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
// An automatically opened invite cannot play audio until the first user gesture.
window.addEventListener("pointerdown", () => {
  if (sound.context?.state === "suspended") unlock();
});
window.addEventListener("blur", clearInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearInput();
});
window.addEventListener("pagehide", () => room?.close());
const canvas = $("#game");
const mouseControls = bindMouseControls(canvas, mouse, {
  enabled: () => playing && !view && !chatComposer.isOpen && !needsRotation() && !document.hidden,
  wake: unlock,
  aim: (e) => {
    const rect = canvas.getBoundingClientRect();
    const point = screenToWorld(e.clientX, e.clientY, rect, currentViewport);
    mouse.x = point.x;
    mouse.y = point.y;
    mouse.active = true;
  },
});
canvas.addEventListener("contextmenu", (e) => {
  if (playing) e.preventDefault();
});
let currentViewport = gameViewport(W, H),
  cameraX = W / 2,
  cameraRound = null;
let gameRect = canvas.getBoundingClientRect();
function canUseTouch() {
  return playing && touchDevice;
}
function ownPlayer(state = world || remote) {
  return state?.players.find((p) => p.id === (room ? room.id : 0));
}
let touchSecondaryKey = "";
function syncTouchUi() {
  const active = canUseTouch();
  document.body.classList.toggle("touch-playing", active);
  $("#touch-controls").classList.toggle("hidden", !active || !!view || needsRotation());
  $("#rotate-screen").classList.toggle("hidden", !needsRotation() || !!view);
  $("#rotate-fullscreen").classList.toggle("hidden", !mobileScreen.supported || mobileScreen.fullscreen);
  $("#overview").classList.toggle("hidden", !active || !!view);
}
function measureGame() {
  clearInput();
  gameRect = canvas.getBoundingClientRect();
  const follow = canUseTouch() && matchMedia("(orientation: portrait)").matches;
  renderer.resize(gameRect.width, gameRect.height, follow);
  currentViewport = gameViewport(
    gameRect.width,
    gameRect.height,
    cameraX,
    follow,
  );
}
bindTouchButtons(document);
const resizeGame = new ResizeObserver(measureGame);
resizeGame.observe(canvas);
window.addEventListener("orientationchange", clearInput);
portraitScreen.addEventListener("change", () => { clearInput(); syncTouchUi(); });
document.addEventListener("fullscreenchange", () => { clearInput(); syncTouchUi(); syncFullscreenUi(); });
document.addEventListener("webkitfullscreenchange", () => { clearInput(); syncTouchUi(); syncFullscreenUi(); });
$("#rotate-fullscreen").onclick = () => { void requestGameFullscreen(); };
$("#rotate-menu").onclick = gameMenu;
window.addEventListener(
  "pointerdown",
  (e) => {
    if (e.pointerType === "touch" && !touchDevice) {
      touchDevice = true;
      document.body.classList.add("touch-device");
      syncTouchUi();
    }
  },
  { capture: true },
);
for (const [id, zone] of [
  ["move-zone", "move"],
  ["aim-zone", "aim"],
  ["touch-block", "block"],
  ["touch-jump", "jump"],
]) {
  bindTouchZone($("#" + id), zone, touchControls, {
    enabled: () =>
      canUseTouch() &&
      !view &&
      !needsRotation() &&
      (zone !== "block" || !!objectAction()),
    wake: unlock,
  });
}
function updateTouchView(state, dt) {
  const active = canUseTouch(),
    follow = active && matchMedia("(orientation: portrait)").matches;
  $("#touch-controls").classList.toggle("hidden", !active || !!view || needsRotation());
  if (!active) {
    currentViewport = gameViewport(gameRect.width, gameRect.height);
    canvas.style.objectPosition = "50% 50%";
    return;
  }
  const controlledId = room ? room.id : 0;
  const player =
    state?.players.find((p) => p.id === controlledId && p.alive) ||
    state?.players.find((p) => p.alive);
  if (player) {
    if (cameraRound !== state.round) {
      cameraX = player.x;
      cameraRound = state.round;
    }
    cameraX += (player.x - cameraX) * Math.min(1, dt * 12);
  }
  renderer.resize(gameRect.width, gameRect.height, follow);
  currentViewport = gameViewport(
    gameRect.width,
    gameRect.height,
    cameraX,
    follow,
  );
  canvas.style.objectPosition = `${currentViewport.position}% 50%`;
  for (const zone of ["move", "aim"]) {
    $("#" + zone + "-stick").classList.toggle("active", !!touchControls[zone]);
  }
  const action = objectAction(state);
  $("#touch-jump").classList.toggle("pressed", !!touchInput.jump);
  const actionKey =
    (ownPlayer(state)?.weapon || "fists") + ":" + (action?.label || "");
  if (actionKey !== touchSecondaryKey) {
    touchControls.blocks.clear();
    touchSecondaryKey = actionKey;
  }
  const actionButton = $("#touch-block");
  actionButton.classList.toggle("hidden", !action);
  actionButton.disabled = !action;
  const parryWait = action?.label === "PARRY" ? ownPlayer(state)?.parryCooldown || 0 : 0;
  const actionLabel = parryWait > 0 ? `PARRY ${parryWait.toFixed(1)}` : action?.label || "";
  if (actionButton.textContent !== actionLabel) actionButton.textContent = actionLabel;
  actionButton.classList.toggle("recharging", parryWait > 0);
  actionButton.setAttribute(
    "aria-label",
    action?.description || "No secondary action",
  );
  actionButton.classList.toggle("pressed", !!action && touchInput.block);
  if (!state || !follow) return;
  const c = $("#overview").getContext("2d"),
    scale = 240 / W;
  c.clearRect(0, 0, 240, 135);
  c.fillStyle = "#0b1724dd";
  c.fillRect(0, 0, 240, 135);
  c.fillStyle = "#9eafb0";
  for (const p of state.platforms.filter((p) => p.hp !== 0))
    c.fillRect(p.x * scale, p.y * scale, p.w * scale, 2);
  for (const h of (state.hazards || []).filter(h=>!h.done&&(h.active||h.warning>0))) {
    c.fillStyle = h.warning > 0 ? "#ffd078bb" : "#ff836bbb";
    c.fillRect(
      (h.x - h.w / 2) * scale,
      (h.y - h.h) * scale,
      Math.max(2, h.w * scale),
      Math.max(2, h.h * scale),
    );
  }
  c.strokeStyle = "#ffffff77";
  c.lineWidth = 1;
  c.strokeRect(
    currentViewport.left * scale,
    1,
    currentViewport.width * scale,
    133,
  );
  for (const p of state.players)
    if (p.alive) {
      c.beginPath();
      c.arc(
        p.x * scale,
        p.y * scale,
        p.id === controlledId ? 4 : 3,
        0,
        Math.PI * 2,
      );
      c.fillStyle = p.color || COLORS[p.id];
      c.fill();
      if (p.id === controlledId) {
        c.strokeStyle = "#fff";
        c.stroke();
      }
    }
}
setInterval(() => {
  if (room && !room.host) room.ping();
}, 2000);
const controllerMenu = new ControllerMenu({
  root: () => view ? $("#panel") : playing ? null : $("#menu"),
  back: () => $("#back")?.click(),
  menu: () => playing ? gameMenu() : $("#back")?.click(),
  wake: unlock,
});
if (preferences.warning) toast(preferences.warning);
requestAnimationFrame(frame);
const inviteCode = new URLSearchParams(location.search).get("room")?.toUpperCase();
if (validCode(inviteCode)) {
  // The click supplies fullscreen activation before asynchronous room discovery.
  showPanel("invite", heading("Join room") + `<p>Room <b>${esc(inviteCode)}</b></p><button id="join-invite" class="button primary">JOIN ROOM</button>`);
  $("#join-invite").onclick = () => { unlock(); connectRoom(inviteCode); };
  $("#back").onclick = home;
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    room?.close();
    simulationClock.terminate();
  });

// Optional agent access uses the same setup flow; no network room is opened implicitly.
const context = document.modelContext;
if (context?.registerTool) {
  const lifecycle = new AbortController();
  const register = (tool) => {
    try {
      Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {}
  };
  register({
    name: "get_bonk_club_state",
    description: "Read the visible Bonk Club lobby or match summary.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: () => ({
      view,
      playing,
      mode: playing ? (room ? "online" : "solo") : "menu",
      players: world?.ids || room?.roster.map((p) => p.id) || [],
      round: world?.round || remote?.round || null,
    }),
  });
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}
