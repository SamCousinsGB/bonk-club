import { victoryMessage } from "./victory.js";
import { loadPreferences } from "./preferences.js";
import { ControllerMenu } from "./controller-menu.js";
import { version, releaseNotes } from "../package.json";
import { SLOT_MODES, SLOT_LABELS, activeSlots } from "./slots.js";
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
const roomOptions = () => ({ profile });

let selectedArena = ["city", "random", "survival"].includes(preferences.value.arena) || Number(preferences.value.arena) < ARENAS.length ? preferences.value.arena : "random",
  ping = 0;
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
  $("#panel").innerHTML = html;
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
  if (!value) { chatComposer.close(); soloChat.reset(); }
  document.body.classList.toggle("playing", value);
  $("#hud").classList.toggle("hidden", !value);
  $("#invite").classList.toggle("hidden", !value || !room);
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
function settingsHtml() {
  return `<div class="settings"><label>ARENAS<select id="arena"><option value="random" ${selectedArena === "random" ? "selected" : ""}>All ${ARENAS.length} arenas</option><option value="city" ${selectedArena === "city" ? "selected" : ""}>Skyscrapers</option><option value="survival" ${selectedArena === "survival" ? "selected" : ""}>Survival arenas</option>${ARENAS.map((a, i) => `<option value="${i}" ${selectedArena === String(i) ? "selected" : ""}>${a.name}</option>`).join("")}</select></label><label>AI DIFFICULTY<select id="difficulty">${["easy", "normal", "hard"].map(value => `<option value="${value}" ${difficulty === value ? "selected" : ""}>${value[0].toUpperCase() + value.slice(1)}</option>`).join("")}</select></label></div>`;
}
function wireSettings() {
  $("#difficulty")?.addEventListener("change", e => {
    difficulty = cleanDifficulty(e.target.value);
    void persist({ difficulty });
    if (world) world.difficulty = difficulty;
  });
  $("#arena")?.addEventListener(
    "change",
    (e) => { selectedArena = e.target.value; void persist({ arena: selectedArena }); },
  );
}
function arenaMenu() {
  showPanel(
    "arenas",
    heading("Settings") +
      settingsHtml() +
      `<div class="settings"><label>SOUND<select id="settings-sound"><option value="on" ${!sound.muted ? "selected" : ""}>On</option><option value="off" ${sound.muted ? "selected" : ""}>Off</option></select></label><label>REDUCED MOTION<select id="settings-motion"><option value="off" ${!renderer.reduced ? "selected" : ""}>Off</option><option value="on" ${renderer.reduced ? "selected" : ""}>On</option></select></label></div><button id="settings-fullscreen" class="button secondary">FULLSCREEN</button>` +
      '<button id="arena-close" class="button primary">CLOSE</button>',
  );
  wireSettings();
  $("#settings-sound").onchange = e => { if ((e.target.value === "off") !== sound.muted) $("#sound").click(); };
  $("#settings-motion").onchange = e => { renderer.reduced = e.target.value === "on"; void persist({ reducedMotion: renderer.reduced }); };
  $("#settings-fullscreen").onclick = toggleFullscreen;
  $("#back").onclick = hidePanel;
  $("#arena-close").onclick = hidePanel;
}
function startWorld(ids) {
  enterGameScreen();
  const pool = selectedArena === "city" ? CITY_ARENAS : selectedArena === "survival" ? ARENAS.flatMap((a,i)=>a.survival?[i]:[]) : ARENAS.map((_, i) => i);
  world = new World({
    players: room ? activeSlots(room.slots, room.roster).map(p => p.id) : [0, 1, 2, 3],
    bots: room ? activeSlots(room.slots, room.roster).filter(p => p.bot).map(p => p.id) : [0, 1, 2, 3].filter((id) => !ids.includes(id)),
    fillSolo: false,
    difficulty,
    arena: ["city", "random", "survival"].includes(selectedArena)
      ? pool[Math.floor(Math.random() * pool.length)]
      : Number(selectedArena),
    shuffle: ["city", "random", "survival"].includes(selectedArena),
    arenaPool: pool,
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
    button.title = button.getAttribute("aria-label") + (button.disabled ? " (in use)" : "");
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
  showPanel(
    "character",
    heading("Character") +
      characterHtml() +
      '<button id="character-close" class="button primary">SAVE</button>',
  );
  wireCharacter();
  const close = () => {
    submitProfile();
    hidePanel();
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
let openSlot = null;
function slotOptionsHtml() {
  if (!room.host || openSlot === null) return "";
  const id = openSlot, p = room.roster.find(q => q.id === id), mode = room.slots[id];
  return `<div class="slot-options" aria-label="Slot ${id + 1} mode">${SLOT_MODES.map(value => `<button type="button" data-slot-mode="${value}" data-slot-id="${id}" aria-pressed="${value === mode}">${SLOT_LABELS[value]}${p && ["ai", "closed"].includes(value) ? `<small>Remove ${esc(p.name)}</small>` : ""}</button>`).join("")}</div>`;
}
function updateLobby() {
  if (view !== "lobby" || !room) return;
  const roster = room.roster;
  $("#lobby-players").innerHTML = [0, 1, 2, 3].map(id => {
    const p = roster.find(q => q.id === id), mode = room.slots[id];
    const title = p ? esc(p.name) : mode === "closed" ? "Closed" : mode === "player" ? "Waiting for player" : "AI";
    const label = id === 0 ? "Host" : SLOT_LABELS[mode];
    const content = `${p ? `<canvas class="player-portrait" data-portrait="${id}" width="64" height="80" aria-hidden="true"></canvas>` : '<span class="player-dot" style="background:#73817b"></span>'}<span>${title}<small>${label}</small></span>`;
    const editable = room.host && id !== 0;
    return `<div class="lobby-slot">${editable ? `<button type="button" class="lobby-player ${p ? "" : "empty"}" data-slot="${id}" aria-label="Slot ${id + 1}: ${label}" aria-expanded="${openSlot === id}">${content}</button>` : `<div class="lobby-player ${p ? "" : "empty"}">${content}</div>`}</div>`;
  }).join("") + slotOptionsHtml();
  for (const canvas of $("#lobby-players").querySelectorAll("[data-portrait]")) {
    const p = roster.find(p => p.id === Number(canvas.dataset.portrait)), c = canvas.getContext("2d");
    c.translate(32, 40); c.scale(1.2, 1.2);
    const finish = materialPaint(c, p, 0, -10, 24, 38);
    c.strokeStyle = finish; c.lineWidth = 5; c.lineCap = "round";
    c.beginPath(); c.moveTo(0, 11); c.lineTo(0, 28); c.moveTo(-11, 24); c.lineTo(0, 14); c.lineTo(11, 24); c.stroke();
    c.fillStyle = finish; c.beginPath(); c.arc(0, 0, 10.5, 0, Math.PI * 2); c.fill();
    drawAppearance(c, p, 0, 0);
  }
  $("#lobby-players").querySelectorAll("[data-slot]").forEach(button => button.onclick = () => {
    const id = Number(button.dataset.slot);
    openSlot = openSlot === id ? null : id;
    updateLobby();
    $("#lobby-players").querySelector(`[data-slot="${id}"]`)?.focus();
  });
  $("#lobby-players").querySelectorAll("[data-slot-mode]").forEach(button => button.onclick = () => {
    const id = Number(button.dataset.slotId);
    openSlot = null;
    room.setSlot(id, button.dataset.slotMode);
    $("#lobby-players").querySelector(`[data-slot="${id}"]`)?.focus();
  });
  const capacity = room.slots.filter(mode => ["mixed", "player"].includes(mode)).length;
  $("#lobby-count").textContent = `${roster.length}/${capacity} players`;
  const start = $("#start-match");
  if (start) {
    start.disabled = activeSlots(room.slots, roster).length < 2;
    $("#start-status").textContent = start.disabled ? "Add AI or wait for another player to start." : "";
  }
  syncColourOptions(true);
}
function lobby() {
  if (!room || room.closed || room.running) return;
  setPlaying(false);
  openSlot = null;
  showPanel(
    "lobby",
    heading("Online lobby") +
      `<div class="lobby-invite"><div><label for="room-code">INVITE CODE</label><input id="room-code" class="room-input" value="${esc(room.code)}" readonly><span id="lobby-count"></span></div><div class="invite-actions"><button id="copy-code" class="button secondary">COPY CODE</button><button id="copy-link" class="button secondary">COPY LINK</button></div></div><div id="lobby-players" class="lobby-players"></div>` +
      characterHtml() +
      (room.host
        ? settingsHtml() +
          '<button id="start-match" class="button primary">START MATCH</button><p id="start-status" class="subtle" role="status"></p>'
        : '<p class="waiting-host" role="status">Waiting for the host to start.</p>') +
      '<p class="subtle">Friends can join open player slots after the match starts.</p><details class="join-other"><summary>Join another room</summary>' +
      joinHtml() +
      '<button id="quick-match" class="button secondary">QUICK MATCH</button></details><button id="connection-details" class="button secondary">CONNECTION DETAILS</button>',
  );
  $("#back").onclick = home;
  wireCharacter();
  wireJoin();
  wireSettings();
  $("#connection-details").onclick = () => connectionDetails(lobby);
  if ($("#quick-match")) $("#quick-match").onclick = quickMatch;
  $("#room-code").onclick = (e) => e.target.select();
  $("#copy-code").onclick = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      toast("Invite code copied.");
    } catch {
      $("#room-code").select();
      toast("Select and copy the invite code.");
    }
  };
  $("#copy-link").onclick = copyInvite;
  if ($("#start-match"))
    $("#start-match").onclick = () => {
      submitProfile();
      room.start();
    };
  updateLobby();
}
function onlineMenu(message = "") {
  unlock();
  if (!network.available) {
    showPanel("online", heading("Online multiplayer") + `<p role="status">${esc(network.reason)}</p>`);
    $("#back").onclick = home;
    return;
  }
  showPanel(
    "online",
    heading("Online multiplayer") +
      (message ? `<p class="error" role="alert">${esc(message)}</p>` : "") +
      '<button id="create-room" class="button primary">CREATE A ROOM</button>' +
      joinHtml() +
      '<button id="quick-match" class="button secondary">QUICK MATCH</button>' +
      (lastDiagnosticRoom
        ? '<button id="connection-details" class="button secondary">CONNECTION DETAILS</button>'
        : ""),
  );
  $("#back").onclick = home;
  $("#create-room").onclick = () => connectRoom();
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
  if (!network.available) return onlineMenu();
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
function help(back = hidePanel) {
  showPanel(
    "help",
    heading("Controls") +
      `<div class="touch-help"><h3>TOUCH</h3><p><b>Move:</b> drag the left side left or right. Release to stop. Swipe up to jump while moving; swipe up again for a second jump. Drag down and hold to lie down.</p><p><b>Aim / fire:</b> drag the right side in the direction you want to shoot. Hold to keep firing; release to stop. You can move and fire at the same time. The joystick guides hide while held and return when you lift your fingers.</p><p><b>Jump:</b> tap Jump, then tap again to double jump.</p><p><b>Throw:</b> double-tap the right side to throw your weapon or carried object.</p><p><b>Pick up / drop:</b> the action button picks up a nearby physical object or drops the object you hold. Aim and fire to throw it. Otherwise the button parries with empty hands or uses alternate fire. Weapon pickups are automatic.</p><p>Play with your phone sideways. Joining or starting requests fullscreen and landscape where supported. If fullscreen closes, open Game menu and tap Fullscreen. The game continues while you rotate or use menus.</p></div>` +
      `<details class="keyboard-help" ${touchDevice ? "" : "open"}><summary>Keyboard controls</summary><div class="controls-grid"><div><h3 style="color:${COLORS[0]}">KEYBOARD + MOUSE</h3><p><span class="key">A</span><span class="key">D</span> Move</p><p><span class="key">W</span> / Space · Jump twice</p><p>Left click / <span class="key">E</span> Punch / fire / throw object</p><p>Right click / <span class="key">G</span> Pick up / drop / parry / alternate fire</p><p><span class="key">F</span> Throw weapon / object</p><p><span class="key">S</span> Hold to lie down</p><p><span class="key">Enter</span> Chat · Enter to send · Esc to cancel</p><p>Mouse aims arms and weapons.</p></div></div></details><p><b>Controller:</b> left stick / D-pad move. A / cross jumps. X / square or RT attacks. B / circle or LT picks up or drops an object, otherwise parries with fists or uses alternate fire. Y / triangle throws the weapon or object. Right stick aims. Hold LB or D-pad down to lie down.</p><p><b>Physical objects:</b> right-click or press G to pick up the nearest object in front of you. Your weapon is set down with its ammunition. Right-click again to drop the object; left-click or F throws it towards your aim. Heavy objects slow movement and travel less far. Walls block pickup. Objects keep their collisions, damage, fire and fuses while held. You cannot punch, fire or parry while carrying.</p><p>With empty hands and no reachable object, press just before impact for a 0.16-second parry window. It stops one melee hit or reflects one bullet, then closes. The cooldown is 0.85 seconds from activation. Release before pressing again; holding does not guard or repeat. The bar under your fighter shows recovery. Explosions cannot be parried. Weapons, including bats and swords, prevent parrying.</p><p><b>Alternate fire:</b> right-click, G, B / circle, LT or the touch action button. Shotgun: double shot, using two shells. Plasma cannon: a larger charged orb, using two rounds. Both share the primary fire cooldown.</p><p><b>Melee:</b> keep attacking while unarmed for punch, kick, then a spinning finisher. Aim the attack to lunge in that direction; one air lunge is available before landing. Landing unarmed hits restores a little health and stamina. Bullets, shotgun pellets, fire and ice deal bonus damage up close. Each strike carries you forward even without holding movement. Early hits keep the opponent within reach; the finisher launches them.</p><p><b>Heavy weapons:</b> recoil pushes you opposite the firing direction, on the ground and in the air. Standing or lying down does not cancel the impulse. Aim downward to launch yourself upward; rapid minigun fire can sustain lift. Holding movement counters recoil gradually. The heavy machine gun requires lying down on a floor to fire and stays braced while deployed. Blue weapon glows indicate rare weapons; purple indicates the rarest. Fire burns for three seconds after the last exposure. Water and ice extinguish it immediately. Bubble shots lift opponents for 2.4 seconds. Expiry or a heavy hit pops the bubble for 32 damage. A lethal pop scatters the fighter’s limbs. Boomerangs return and can hit again on the way back. Rubber ducks bounce and explode on contact or when their fuse ends. Ice slows, sawblades and ricochet shots bounce, and Tesla shots chain between nearby opponents. Black holes pull in players, loose weapons and shots, including your own.</p><p><b>Grenades:</b> aim slightly upward for a longer throw, up to about half the arena where the arc is clear. Nuclear grenades are single-use pickups: attack or throw to launch one. Its 2.8-second fuse triggers a circular blast that removes nearby terrain and kills anyone inside, including you. Walls do not shield the nuclear flash. The mushroom cloud clears within 12 seconds; the hole remains until the next round. Leaving the arena also triggers detonation.</p><p>The last player alive wins the round. Walk near a weapon to pick it up automatically when unarmed. Throw the current weapon to collect another. Furniture, crates and rocks have weight. Push them, hit them or blast them apart; loose pieces can hit fighters. TNT barrels count down and explode. Gas cylinders leak flammable gas. Oil spills are slippery and flammable. Glue grips your feet; jump to escape. Tar slows movement and burns longer than oil. Water washes off glue and extinguishes fire. Shoot containers to release their contents. Bullets have a 30% chance to ignite gas, oil or tar on contact, including at the container. Elevators carry players between floors. Explosions hurt everyone, including you. Explosions carve holes in every platform, wall and lift. Repeated blasts dig further through terrain. Marked wood and glass panels can also be shot out; structural supports and lifts resist bullets. Destroyed floors drop players and loose objects. Cut lifts stop moving. Terrain resets each round. Traps are fixed parts of each map. Flame vents warn before a lethal eruption. Conveyors carry you toward their ends; jump clear. Swinging spike balls, crushers, moving saws and electrical traps guard different routes. Breaking a trap's mounting floor disables it.</p><p class="subtle">Rounds become sudden death after 120 seconds. Escape opens the menu while the game continues. Switching tabs does not pause the game. AI/Player slots use AI until a friend joins. AI only slots cannot be joined. Player only slots remain empty until someone joins. Closed slots are unused. Scores continue between rounds and reset when a slot changes player. Touch controls work in single player and online rooms. Each device controls one player.</p><button id="got-it" class="button primary">CLOSE</button>`,
  );
  $("#back").onclick = back;
  $("#got-it").onclick = back;
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
      `<p>The game continues while this menu is open.</p><button id="resume" class="button primary">BACK TO GAME</button>${room ? '<button id="menu-invite" class="button secondary">INVITE PLAYERS</button><button id="connection-details" class="button secondary">CONNECTION DETAILS</button>' : ""}<button id="edit-character" class="button secondary">CHARACTER</button><button id="pause-help" class="button secondary">CONTROLS</button><button id="leave" class="button secondary">${room ? "LEAVE ROOM" : "MAIN MENU"}</button>${room?.host ? '<p class="subtle">Closing the host’s game ends this room.</p>' : ""}`,
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
  $("#pause-help").insertAdjacentHTML("beforebegin", `<button id="game-sound" class="button secondary">${sound.muted ? "UNMUTE SOUND" : "MUTE SOUND"}</button>`);
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
  $("#pause-help").onclick = () => help(hidePanel);
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
$("#solo").onclick = () => {
  solo = true;
  startWorld([0]);
};
$("#arenas").onclick = arenaMenu;
$("#arenas").textContent = "SETTINGS";
$("#menu-controls").onclick = () => {
  unlock();
  help();
};
$("#online").onclick = () => connectRoom();
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
  $("#menu-controls").insertAdjacentHTML("afterend", '<button id="quit-game" class="button secondary">QUIT GAME</button>');
  $("#quit-game").onclick = () => { home(); void desktop.quit(); };
  $(".brand").onclick = event => { event.preventDefault(); home(); };
}
syncFullscreenUi();
window.addEventListener("keydown", (e) => {
  if (sound.context?.state === "suspended") unlock();
  if (chatComposer.handleKey(e)) return;
  if (e.code === "Escape") {
    if ($("#controller-keyboard")) { e.preventDefault(); controllerMenu.closeKeyboard(); return; }
    if (view === "connection-details") {
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
