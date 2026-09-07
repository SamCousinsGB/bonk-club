import { SLOT_MODES, SLOT_LABELS, activeSlots } from "./slots.js";
import { cleanDifficulty } from "./bot-difficulty.js";
import { GuestFrames } from "./render-state.js";
import {
  PALETTE,
  HAIRSTYLES,
  defaultProfile,
  cleanProfile,
  drawHair,
} from "./identity.js";
import { secondaryAction } from "./arsenal.js";
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
import { Room, validCode } from "./network.js";
import { TouchControls, bindTouchZone, bindTouchButtons } from "./touch.js";
import { gameViewport, screenToWorld } from "./viewport.js";
import { SUDDEN_DEATH } from "./scale.js";

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
const renderer = new Renderer($("#game")),
  sound = new Sound(),
  keys = new Set(),
  touchControls = new TouchControls();
let touchInput = emptyInput();
let touchDevice = matchMedia("(pointer: coarse)").matches;
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
const guestFrames = new GuestFrames();
let difficulty = "easy";
try { difficulty = cleanDifficulty(localStorage.getItem("bonk-difficulty")); } catch { /* Private browsing. */ }
let solo = false;
let lastDiagnosticRoom = null;
let profile;
try {
  profile = cleanProfile(JSON.parse(localStorage.getItem("bonk-profile")), {
    name: "Player",
    color: COLORS[0],
    hair: "None",
  });
} catch {
  profile = { name: "Player", color: COLORS[0], hair: "None" };
}
function saveProfile(value) {
  profile = cleanProfile(value, profile);
  try {
    localStorage.setItem("bonk-profile", JSON.stringify(profile));
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
}
const roomOptions = () => ({ profile });

let selectedArena = "random",
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
  if (view || document.hidden) return emptyInput();
  if (device === "touch") return { ...touchInput };
  const i = emptyInput();
  if (device.startsWith("gamepad")) {
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
    const p = (world?.players || remote?.players || []).find(
      (p) => p.id === controlledId,
    );
    if (p && mouse.active)
      i.aim = Math.atan2(mouse.y - (p.y - 10), mouse.x - p.x);
  }
  return i;
}
function ownInput() {
  const i = readInput("keyboard1"),
    pad = gamepads()[0] ? readInput("gamepad0") : emptyInput();
  for (const k in i) if (k !== "aim") i[k] ||= pad[k] || touchInput[k];
  if (pad.aim !== null) i.aim = pad.aim;
  if (touchInput.aim !== null) i.aim = touchInput.aim;
  return i;
}
function clearInput() {
  keys.clear();
  mouse.attack = false;
  mouse.block = false;
  touchControls.reset();
  touchInput = emptyInput();
  if (room && !room.host) room.sendInput(emptyInput());
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.add("hidden"), 4200);
}
function unlock() {
  try {
    sound.unlock();
  } catch {
    sound.muted = true;
  }
}
function showPanel(name, html) {
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
  document.body.classList.toggle("playing", value);
  $("#hud").classList.toggle("hidden", !value);
  $("#invite").classList.toggle("hidden", !value || !room);
  setHtml($("#announcement"), "");
  syncTouchUi();
  $("#footer-hint").textContent = value
    ? "MOUSE AIM · LEFT CLICK ATTACK · RIGHT CLICK PARRY / ALT FIRE · S LIE DOWN · F THROW"
    : "";
}
function home() {
  searchId++;
  room?.close();
  room = null;
  world = null;
  remote = null;
  guestFrames.reset();
  setPlaying(false);
  hidePanel();
  history.replaceState(null, "", location.pathname);
}
function settingsHtml() {
  return `<div class="settings"><label>ARENAS<select id="arena"><option value="random" ${selectedArena === "random" ? "selected" : ""}>All ${ARENAS.length} arenas</option><option value="city" ${selectedArena === "city" ? "selected" : ""}>Skyscrapers</option>${ARENAS.map((a, i) => `<option value="${i}" ${selectedArena === String(i) ? "selected" : ""}>${a.name}</option>`).join("")}</select></label><label>AI DIFFICULTY<select id="difficulty">${["easy", "normal", "hard"].map(value => `<option value="${value}" ${difficulty === value ? "selected" : ""}>${value[0].toUpperCase() + value.slice(1)}</option>`).join("")}</select></label></div>`;
}
function wireSettings() {
  $("#difficulty")?.addEventListener("change", e => {
    difficulty = cleanDifficulty(e.target.value);
    try { localStorage.setItem("bonk-difficulty", difficulty); } catch { /* Private browsing. */ }
    if (world) world.difficulty = difficulty;
  });
  $("#arena")?.addEventListener(
    "change",
    (e) => (selectedArena = e.target.value),
  );
}
function arenaMenu() {
  showPanel(
    "arenas",
    heading("Settings") +
      settingsHtml() +
      '<button id="arena-close" class="button primary">CLOSE</button>',
  );
  wireSettings();
  $("#back").onclick = hidePanel;
  $("#arena-close").onclick = hidePanel;
}
function startWorld(ids) {
  const pool = selectedArena === "city" ? CITY_ARENAS : ARENAS.map((_, i) => i);
  world = new World({
    players: room ? activeSlots(room.slots, room.roster).map(p => p.id) : [0, 1, 2, 3],
    bots: room ? activeSlots(room.slots, room.roster).filter(p => p.bot).map(p => p.id) : [0, 1, 2, 3].filter((id) => !ids.includes(id)),
    fillSolo: false,
    difficulty,
    arena: ["city", "random"].includes(selectedArena)
      ? pool[Math.floor(Math.random() * pool.length)]
      : Number(selectedArena),
    shuffle: ["city", "random"].includes(selectedArena),
    arenaPool: pool,
  });
  world.setProfiles(room ? room.roster : [{ id: 0, ...profile }]);
  remote = null;
  guestFrames.reset();
  renderer.lastEvent = 0;
  renderer.particles = [];
  renderer.words = [];
  renderer.impacts = [];
  accumulator = 0;
  simulationLast = performance.now();
  hidePanel();
  setPlaying(true);
  unlock();
}
function characterHtml() {
  return `<div class="character-editor"><canvas id="character-preview" width="160" height="170" aria-label="Character preview"></canvas><div class="character-fields"><label>NAME<input id="player-name" maxlength="20" autocomplete="nickname" value="${esc(profile.name)}"></label><label>COLOUR<div id="colours" class="colour-options">${PALETTE.map((c) => `<button type="button" class="colour-option" data-colour="${c.value}" aria-label="${c.name}" aria-pressed="${profile.color === c.value}" style="--colour:${c.value}"></button>`).join("")}</div></label><label>HAIRSTYLE<select id="player-hair">${HAIRSTYLES.map((h) => `<option ${profile.hair === h ? "selected" : ""}>${h}</option>`).join("")}</select></label></div></div>`;
}
function drawPreview() {
  const canvas = $("#character-preview");
  if (!canvas) return;
  const c = canvas.getContext("2d");
  c.clearRect(0, 0, 160, 170);
  c.save();
  c.translate(80, 70);
  c.scale(1.7, 1.7);
  c.strokeStyle = profile.color;
  c.fillStyle = profile.color;
  c.lineWidth = 4;
  c.lineCap = "round";
  c.beginPath();
  c.arc(0, -15, 10, 0, Math.PI * 2);
  c.fill();
  for (const points of [
    [
      [0, -4],
      [0, 20],
    ],
    [
      [-15, 12],
      [0, 0],
      [14, 9],
    ],
    [
      [0, 20],
      [-11, 45],
    ],
    [
      [0, 20],
      [13, 44],
    ],
  ]) {
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
  }
  drawHair(c, profile.hair, 0, -15);
  c.restore();
}
function submitProfile() {
  if (!$("#player-name")) return;
  saveProfile({
    ...profile,
    name: $("#player-name").value,
    hair: $("#player-hair").value,
  });
  room?.setProfile(profile);
  if (!room && world) world.setProfiles([{ id: 0, ...profile }]);
  drawPreview();
}
function syncColourOptions() {
  const own = room?.roster.find((p) => p.id === room.id);
  if (own) saveProfile(own);
  for (const button of document.querySelectorAll("[data-colour]")) {
    button.disabled = !!room?.roster.some(
      (p) => p.id !== room.id && p.color === button.dataset.colour,
    );
    button.setAttribute(
      "aria-pressed",
      String(profile.color === button.dataset.colour),
    );
  }
  drawPreview();
}
function wireCharacter() {
  $("#player-name").onchange = submitProfile;
  $("#player-hair").onchange = submitProfile;
  for (const button of document.querySelectorAll("[data-colour]"))
    button.onclick = () => {
      saveProfile({ ...profile, color: button.dataset.colour });
      submitProfile();
      syncColourOptions();
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
    const content = `<span class="player-dot" style="background:${p?.color || "#73817b"}"></span><span>${title}<small>${label}</small></span>`;
    const editable = room.host && id !== 0;
    return `<div class="lobby-slot">${editable ? `<button type="button" class="lobby-player ${p ? "" : "empty"}" data-slot="${id}" aria-label="Slot ${id + 1}: ${label}" aria-expanded="${openSlot === id}">${content}</button>` : `<div class="lobby-player ${p ? "" : "empty"}">${content}</div>`}</div>`;
  }).join("") + slotOptionsHtml();
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
  syncColourOptions();
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
      "<p>Copy this report from both devices after a failed join. It excludes IP addresses, room codes and credentials.</p>" +
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
    let candidate = new Room(roomCallbacks(), undefined, roomOptions());
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
      candidate = new Room(roomCallbacks(), undefined, roomOptions());
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
  guestFrames.reset();
  renderer.lastEvent = 0;
  renderer.particles = [];
  renderer.words = [];
  renderer.impacts = [];
  hidePanel();
  setPlaying(true);
}
function roomCallbacks() {
  return {
    onRoster: (roster) => {
      if (room?.host && world) {
        world.syncSlots(room.slots, roster);
        room.sendState(world.snapshot());
      }
      const own = roster.find((p) => p.id === room?.id);
      if (own) saveProfile(own);
      updateLobby();
    },
    onLobby: lobby,
    onStatus: (status) => {
      if ($("#connection-status")) $("#connection-status").textContent = status;
    },
    onStart: () => {
      if (room.host) startWorld(room.roster.map((p) => p.id));
      else enterGuest();
    },
    onState: (s) => {
      remote = s;
      guestFrames.push(s, performance.now());
    },
    onError: (message) => {
      lastDiagnosticRoom = room;
      room?.close();
      room = null;
      world = null;
      remote = null;
      guestFrames.reset();
      setPlaying(false);
      onlineMenu(message);
    },
    onNotice: toast,
    onPing: (n) => (ping = n),
  };
}
async function connectRoom(code) {
  solo = false;
  if (code !== undefined && !validCode(code))
    return toast("Enter the six-character code from your friend.");
  room?.close();
  const next = new Room(roomCallbacks(), undefined, roomOptions());
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
      `<div class="touch-help"><h3>TOUCH</h3><p><b>Left side:</b> drag left or right to move. Release to stop. Swipe up to jump; swipe up again for a second jump. Drag down and hold to lie down.</p><p><b>Right side:</b> drag in any direction to aim and fire, or hold to fire in the current direction. Double-tap to throw your weapon.</p><p><b>Parry / alternate fire:</b> the button parries one hit with empty hands. With a shotgun or plasma cannon it fires the alternate shot. Other weapons have no secondary button. Weapons are picked up automatically. Landscape shows the full arena; portrait follows your player with an overview of the arena.</p></div>` +
      `<details class="keyboard-help" ${touchDevice ? "" : "open"}><summary>Keyboard controls</summary><div class="controls-grid"><div><h3 style="color:${COLORS[0]}">KEYBOARD + MOUSE</h3><p><span class="key">A</span><span class="key">D</span> Move</p><p><span class="key">W</span> / Space · Jump twice</p><p>Left click / <span class="key">E</span> Punch / fire</p><p>Right click / <span class="key">G</span> Parry / alternate fire</p><p><span class="key">F</span> Throw weapon</p><p><span class="key">S</span> Hold to lie down</p><p>Mouse aims arms and weapons.</p></div></div></details><p><b>Controller:</b> left stick / D-pad move. A / cross jumps. X / square or RT attacks. B / circle or LT parries with fists or uses alternate fire. Y / triangle throws the weapon. Right stick aims. Hold LB or D-pad down to lie down.</p><p>With empty hands, press just before impact for a 0.16-second parry window. It stops one melee hit or reflects one bullet, then closes. The cooldown is 0.85 seconds from activation. Release before pressing again; holding does not guard or repeat. The bar under your fighter shows recovery. Explosions cannot be parried. Weapons, including bats and swords, prevent parrying.</p><p><b>Alternate fire:</b> right-click, G, B / circle, LT or the touch action button. Shotgun: double shot, using two shells. Plasma cannon: a larger charged orb, using two rounds. Both share the primary fire cooldown.</p><p><b>Melee:</b> keep attacking while unarmed for punch, kick, then a spinning finisher. Aim the attack to lunge in that direction; one air lunge is available before landing. Landing unarmed hits restores a little health and stamina. Each strike carries you forward even without holding movement. Early hits keep the opponent within reach; the finisher launches them.</p><p><b>Heavy weapons:</b> recoil pushes you opposite the firing direction, on the ground and in the air. Standing or lying down does not cancel the impulse. Aim downward to launch yourself upward; rapid minigun fire can sustain lift. Holding movement counters recoil gradually. The heavy machine gun requires lying down on a floor to fire and stays braced while deployed. Blue weapon glows indicate rare weapons; purple indicates the rarest. Fire burns, ice slows, sawblades and ricochet shots bounce, and Tesla shots chain between nearby opponents. Black holes pull in players, loose weapons and shots, including your own.</p><p><b>Grenades:</b> aim slightly upward for a longer throw, up to about half the arena where the arc is clear. Nuclear grenades are single-use pickups: attack or throw to launch one. Its 2.8-second fuse triggers a large blast, a map-wide pressure wave and six marked secondary detonations. Breakable floors collapse as the wave arrives. Solid walls reduce nuclear damage but do not stop the pressure wave. The round waits for the 4.8-second sequence to finish. Leaving the arena also triggers detonation. The blast and shockwave can hurt you.</p><p>The last player alive wins the round. Walk near a weapon to pick it up automatically when unarmed. Throw the current weapon to collect another. Furniture, crates and rocks provide breakable cover. Elevators carry players between floors. Explosions hurt everyone, including you. Marked wooden and glass floor panels can be shot out, dropping anyone above them. Solid supports and lifts stay intact. Environmental hazards appear at random during a round. Hazards are marked for two seconds before activating. Wind pushes players; vents launch them; rocks, lightning, gas and electrical faults cause damage.</p><p class="subtle">Rounds become sudden death after 120 seconds. Escape opens the menu while the game continues. Switching tabs does not pause the game. AI/Player slots use AI until a friend joins. AI only slots cannot be joined. Player only slots remain empty until someone joins. Closed slots are unused. Scores continue between rounds and reset when a slot changes player. Touch controls work in single player and online rooms. Each device controls one player.</p><button id="got-it" class="button primary">CLOSE</button>`,
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
  $("#resume").onclick = hidePanel;
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
        `<div class="score ${leaders.some((q) => q.id === p.id) ? "leader" : ""}" style="opacity:${p.alive ? 1 : 0.4}"><div class="score-top" style="color:${p.color || COLORS[p.id]}"><span>${esc(p.name || NAMES[p.id])}<em>${p.bot ? "AI" : (room && p.id === room.id) || (solo && p.id === 0) ? "YOU" : ""}</em></span><b>${s.scores[p.id]}</b></div><div class="health"><i style="background:${p.color || COLORS[p.id]};width:${Math.max(0, Math.ceil(p.hp))}%"></i></div><small>${p.alive ? (p.weapon ? WEAPONS[p.weapon].name + " · " + p.ammo + (WEAPONS[p.weapon].proneOnly && (!p.prone || !p.ground) ? " · LIE DOWN TO FIRE" : "") : "FISTS · " + Math.ceil(p.hp) + " HP") : "ELIMINATED"}</small></div>`,
    )
    .join(""));
  $("#arena-name").textContent = ARENAS[s.arenaIndex].name;
  $("#round-label").textContent = `ROUND ${s.round}`;
  $("#leader-label").textContent = leaders.length
    ? `${leaders.length > 1 ? "TIED" : "LEADER"}: ${leaders.map((p) => (p.name || NAMES[p.id]) + (p.bot ? " AI" : "")).join(" / ")}`
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
    setHtml(a, `${s.phaseTime > 0.45 ? Math.ceil(s.phaseTime) : "FIGHT"}<small>${ARENAS[s.arenaIndex].name}</small>`);
  } else if (s.phase === "result") {
    setHtml(a, `${s.winner === null ? "DRAW" : esc(s.players.find((p) => p.id === s.winner)?.name || NAMES[s.winner]) + " WINS THE ROUND"}<small>Next arena in ${Math.max(1, Math.ceil(s.phaseTime))}</small>`);
  } else setHtml(a, "");
  if (room && !room.host)
    $("#footer-hint").textContent =
      `ONLINE · ${ping} MS · YOU ARE ${s.players.find((p) => p.id === room.id)?.name || NAMES[room.id]}`;
}
function interpolated(now) {
  return guestFrames.sample(now);
}
let simulationLast = performance.now();
function simulate(now) {
  const dt = Math.max(0, Math.min((now - simulationLast) / 1000, 1));
  simulationLast = now;
  touchInput =
    canUseTouch() && !view && !document.hidden
      ? touchControls.read(now)
      : emptyInput();
  netClock += dt;
  if (world) {
    accumulator += dt;
    while (accumulator >= STEP) {
      const inputs = room
        ? { ...room.getInputs(now), 0: ownInput() }
        : { 0: ownInput() };
      world.step(STEP, inputs);
      accumulator -= STEP;
    }
  }
  if (room && playing && netClock >= 1 / 30) {
    netClock %= 1 / 30;
    if (room.host && world) room.sendState(world.snapshot());
    else if (!room.host)
      room.sendInput(view || document.hidden ? emptyInput() : ownInput());
  }
}
// Simulation and WebRTC sends have their own clock; rendering may stop in a hidden tab.
const simulationClock = new Worker(
  new URL("./clock-worker.js", import.meta.url),
  { type: "module" },
);
simulationClock.onmessage = () => simulate(performance.now());
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  hudClock += dt;
  const state = world ? world.snapshot() : interpolated(now);
  if (state) {
    renderer.events(state.events, sound);
    if (hudClock > 0.07) {
      hudClock = 0;
      updateHud(state);
    }
  }
  renderer.draw(state, dt, renderer.reduced ? 0 : now / 1000);
  updateTouchView(state, dt);
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
$("#help").onclick = () => {
  unlock();
  if (playing) {
    help(hidePanel);
  } else help();
};
$("#pause").onclick = gameMenu;
$("#invite").onclick = copyInvite;
$("#sound").onclick = () => {
  unlock();
  sound.muted = !sound.muted;
  $("#sound").textContent = sound.muted ? "♩" : "♪";
  $("#sound").setAttribute(
    "aria-label",
    sound.muted ? "Unmute sound" : "Mute sound",
  );
  $("#sound").setAttribute("aria-pressed", String(sound.muted));
  toast(sound.muted ? "Sound off." : "Sound on.");
};
$("#fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("#app").requestFullscreen();
  } catch {
    toast(
      "Fullscreen isn’t available here. Try opening the game in its own browser tab.",
    );
  }
};
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
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
window.addEventListener("blur", clearInput);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearInput();
});
window.addEventListener("pagehide", () => room?.close());
const canvas = $("#game");
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") return;
  const rect = canvas.getBoundingClientRect();
  const point = screenToWorld(e.clientX, e.clientY, rect, currentViewport);
  mouse.x = point.x;
  mouse.y = point.y;
  mouse.active = true;
});
canvas.addEventListener("pointerdown", (e) => {
  if (!playing || view || e.pointerType === "touch") return;
  e.preventDefault();
  unlock();
  canvas.setPointerCapture(e.pointerId);
  if (e.button === 0) mouse.attack = true;
  if (e.button === 2) mouse.block = true;
});
window.addEventListener("pointerup", (e) => {
  if (e.button === 0) mouse.attack = false;
  if (e.button === 2) mouse.block = false;
});
canvas.addEventListener("pointercancel", () => {
  mouse.attack = false;
  mouse.block = false;
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
  $("#touch-controls").classList.toggle("hidden", !active || !!view);
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
]) {
  bindTouchZone($("#" + id), zone, touchControls, {
    enabled: () =>
      canUseTouch() &&
      !view &&
      (zone !== "block" || !!secondaryAction(ownPlayer())),
    wake: unlock,
  });
}
function updateTouchView(state, dt) {
  const active = canUseTouch(),
    follow = active && matchMedia("(orientation: portrait)").matches;
  $("#touch-controls").classList.toggle("hidden", !active || !!view);
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
    const p = touchControls[zone],
      el = $("#" + zone + "-stick");
    el.classList.toggle("active", !!p);
    if (p) {
      const rect = el.parentElement.getBoundingClientRect();
      el.style.left = `${p.ox - rect.left}px`;
      el.style.top = `${p.oy - rect.top}px`;
      const dx = p.x - p.ox,
        dy = p.y - p.oy,
        length = Math.hypot(dx, dy);
      const scale = length > 38 ? 38 / length : 1;
      el.firstElementChild.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    } else {
      el.style.left = "";
      el.style.top = "";
      el.firstElementChild.style.transform = "";
    }
  }
  const action = secondaryAction(ownPlayer(state));
  const actionKey =
    (ownPlayer(state)?.weapon || "fists") + ":" + (action?.label || "");
  if (actionKey !== touchSecondaryKey) {
    touchControls.blocks.clear();
    touchSecondaryKey = actionKey;
  }
  const actionButton = $("#touch-block");
  actionButton.classList.toggle("hidden", !action);
  actionButton.disabled = !action;
  const parryWait = !ownPlayer(state)?.weapon ? ownPlayer(state)?.parryCooldown || 0 : 0;
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
  for (const h of state.hazards || []) {
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
requestAnimationFrame(frame);
if (validCode(new URLSearchParams(location.search).get("room")?.toUpperCase()))
  connectRoom(new URLSearchParams(location.search).get("room").toUpperCase());
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
