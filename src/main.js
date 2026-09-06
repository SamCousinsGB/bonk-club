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
const touchAvailable = touchDevice || navigator.maxTouchPoints > 0;
document.body.classList.toggle("touch-device", touchDevice);
let world = null,
  room = null,
  remote = null,
  previousRemote = null,
  remoteAt = 0,
  previousAt = 0,
  paused = false,
  playing = false,
  view = "",
  shownMatch = false,
  accumulator = 0,
  netClock = 0,
  hudClock = 0,
  last = performance.now(),
  toastTimer,
  returnFocus = null;
let playerCount = 2,
  devices = touchDevice
    ? ["touch", "gamepad0", "gamepad1", "gamepad2"]
    : ["keyboard1", "keyboard2", "gamepad0", "gamepad1"],
  target = 5,
  selectedArena = "city",
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
  keyboard2: {
    left: "ArrowLeft",
    right: "ArrowRight",
    jump: "ArrowUp",
    attack: "KeyK",
    block: "KeyL",
    throw: "KeyO",
    duck: "ArrowDown",
  },
};
const usedKeys = new Set([
  ...Object.values(keyboardMaps).flatMap(Object.values),
  "Space",
]);
const gamepads = () =>
  Array.from(navigator.getGamepads?.() || []).filter(Boolean);
function readInput(device) {
  if (view) return emptyInput();
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
    const controlledId = room ? room.id : devices.indexOf("keyboard1");
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
  $("#announcement").textContent = "";
  syncTouchUi();
  $("#footer-hint").textContent = value
    ? "MOUSE AIM · LEFT CLICK ATTACK · RIGHT CLICK BLOCK · S LIE DOWN · F THROW"
    : "";
}
function home() {
  searchId++;
  room?.close();
  room = null;
  world = null;
  remote = null;
  previousRemote = null;
  paused = false;
  setPlaying(false);
  hidePanel();
  history.replaceState(null, "", location.pathname);
}
function settingsHtml() {
  return `<div class="settings"><label>ROUNDS TO WIN<select id="target">${[3, 5, 10].map((n) => `<option value="${n}" ${n === target ? "selected" : ""}>First to ${n}</option>`).join("")}</select></label><label>ARENAS<select id="arena"><option value="city" ${selectedArena === "city" ? "selected" : ""}>Skyscrapers</option><option value="random" ${selectedArena === "random" ? "selected" : ""}>All ${ARENAS.length} arenas</option>${ARENAS.map((a, i) => `<option value="${i}" ${selectedArena === String(i) ? "selected" : ""}>${a.name}</option>`).join("")}</select></label></div>`;
}
function wireSettings() {
  $("#target")?.addEventListener(
    "change",
    (e) => (target = Number(e.target.value)),
  );
  $("#arena")?.addEventListener(
    "change",
    (e) => (selectedArena = e.target.value),
  );
}
function localLobby() {
  unlock();
  showPanel(
    "local",
    heading("Local multiplayer") +
      `<div class="row spread"><p>Players</p><select id="player-count" aria-label="Number of players" style="background:#293233;color:white;border:1px solid #ffffff38;padding:8px;border-radius:4px">${[2, 3, 4].map((n) => `<option ${n === playerCount ? "selected" : ""}>${n}</option>`).join("")}</select></div>${Array.from({ length: playerCount }, (_, id) => `<div class="player-row"><span class="player-dot" style="background:${COLORS[id]}"></span><b>${NAMES[id]}</b><select data-device="${id}" aria-label="${NAMES[id]} controls">${[...(touchAvailable ? [["touch", "Touch controls"]] : []), ["keyboard1", "WASD + Mouse / E / G / F"], ["keyboard2", "Arrows + K / L / O"], ...Array.from({ length: 4 }, (_, n) => ["gamepad" + n, "Controller " + (n + 1)])].map(([value, label]) => `<option value="${value}" ${devices[id] === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>`).join("")}` +
      settingsHtml() +
      `<p class="subtle" id="pad-status"></p><p class="subtle">${touchDevice ? "One player can use touch on this device; other local players need controllers. For separate phones, choose Online multiplayer." : "Two people can share a keyboard. For more players, connect controllers and press a button. Use a different control set for each player."}</p><button id="start-local" class="button primary">START MATCH <span>↗</span></button><button id="local-help" class="button secondary">CONTROLS</button>`,
  );
  $("#back").onclick = hidePanel;
  $("#player-count").onchange = (e) => {
    playerCount = Number(e.target.value);
    localLobby();
  };
  document
    .querySelectorAll("[data-device]")
    .forEach(
      (el) =>
        (el.onchange = (e) =>
          (devices[Number(el.dataset.device)] = e.target.value)),
    );
  wireSettings();
  $("#start-local").onclick = () => {
    const active = devices.slice(0, playerCount);
    if (new Set(active).size !== active.length)
      return toast("Give each player their own control set.");
    for (const d of active)
      if (d.startsWith("gamepad") && !gamepads()[Number(d.slice(7))])
        return toast(
          "Connect the selected controllers and press a button first.",
        );
    startWorld(Array.from({ length: playerCount }, (_, i) => i));
  };
  $("#local-help").onclick = () => help(localLobby);
  updatePadStatus();
}
function updatePadStatus() {
  if ($("#pad-status"))
    $("#pad-status").textContent =
      `${gamepads().length} controller${gamepads().length === 1 ? "" : "s"} connected`;
}
function startWorld(ids) {
  const pool = selectedArena === "city" ? CITY_ARENAS : ARENAS.map((_, i) => i);
  world = new World({
    players: ids,
    target,
    arena: ["city", "random"].includes(selectedArena)
      ? pool[Math.floor(Math.random() * pool.length)]
      : Number(selectedArena),
    shuffle: ["city", "random"].includes(selectedArena),
    arenaPool: pool,
  });
  remote = null;
  previousRemote = null;
  paused = false;
  shownMatch = false;
  renderer.lastEvent = 0;
  renderer.particles = [];
  renderer.words = [];
  accumulator = 0;
  hidePanel();
  setPlaying(true);
  unlock();
}
function onlineMenu(message = "") {
  unlock();
  showPanel(
    "online",
    heading("Online multiplayer") +
      `<p>${touchDevice ? "Each player opens the game on their own phone or computer. Create a room and share the invite link." : "Create an invite room for friends, or find another player at a public table."}</p><button id="quick-match" class="button secondary">QUICK MATCH <span>↗</span></button>${message ? `<p class="error" role="alert">${esc(message)}</p>` : ""}<button id="create-room" class="button primary">CREATE A ROOM <span>↗</span></button><p style="text-align:center">Join a room</p><input id="join-code" class="room-input" aria-label="Six-character room code" placeholder="ABC234" maxlength="6" autocomplete="off" spellcheck="false" value="${validCode(new URLSearchParams(location.search).get("room")?.toUpperCase()) ? esc(new URLSearchParams(location.search).get("room").toUpperCase()) : ""}"><button id="join-room" class="button secondary">JOIN ROOM <span>↗</span></button><p class="subtle">Online connections depend on the room service and each player’s network.</p>`,
  );
  $("#back").onclick = home;
  $("#create-room").onclick = () => connectRoom();
  $("#quick-match").onclick = quickMatch;
  $("#join-room").onclick = () =>
    connectRoom($("#join-code").value.trim().toUpperCase());
  $("#join-code").onkeydown = (e) => {
    if (e.key === "Enter") $("#join-room").click();
  };
}
async function quickMatch() {
  room?.close();
  room = null;
  const search = ++searchId;
  showPanel(
    "connecting",
    heading("Finding players…") +
      '<p>Looking for an available room. The match needs at least two players.</p><p class="subtle">Waiting for at least two players.</p>',
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
    let candidate = new Room();
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
      candidate = new Room();
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
    roomLobby();
    if (!candidate.host) candidate.ready(true);
    return;
  }
  room = null;
  onlineMenu(
    "All eight public tables are playing right now. Try again shortly or create an invite room.",
  );
}
function roomCallbacks() {
  return {
    onRoster: () => {
      if (view === "room") roomLobby();
    },
    onStart: () => {
      world = null;
      remote = null;
      previousRemote = null;
      shownMatch = false;
      renderer.lastEvent = 0;
      paused = false;
      hidePanel();
      setPlaying(true);
    },
    onState: (s) => {
      if (s.paused && !remote?.paused) clearInput();
      previousRemote = remote;
      previousAt = remoteAt;
      remote = s;
      remoteAt = performance.now();
    },
    onEnd: (reason) => {
      world = null;
      remote = null;
      previousRemote = null;
      paused = false;
      setPlaying(false);
      roomLobby();
      toast(reason);
    },
    onError: (message) => {
      room?.close();
      room = null;
      world = null;
      remote = null;
      setPlaying(false);
      onlineMenu(message);
    },
    onNotice: toast,
    onPing: (n) => (ping = n),
  };
}
async function connectRoom(code) {
  if (code !== undefined && !validCode(code))
    return toast("Enter the six-character code from your friend.");
  room?.close();
  const next = new Room(roomCallbacks());
  room = next;
  showPanel(
    "connecting",
    heading(code ? "Joining room…" : "Opening room…") +
      `<p>Connecting your browser to the room service.</p><p class="subtle">This can take a few seconds.</p>`,
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
    roomLobby();
  } catch (e) {
    if (room !== next) return;
    next.close();
    room = null;
    onlineMenu(e.message);
  }
}
function roomLobby() {
  if (!room) return;
  const r = room;
  if (r.publicRoom) {
    // Public seats use the same visible lobby and ready rules as invite rooms.
    r.quickReadyAt =
      r.roster.length >= 2 && r.roster.every((p) => p.ready)
        ? r.quickReadyAt || performance.now() + 6000
        : null;
  }
  const canStart =
    r.host && r.roster.length >= 2 && r.roster.every((p) => p.ready);
  showPanel(
    "room",
    heading("Room") +
      `<div class="room-code">${esc(r.code)}</div><button id="copy-room" class="button secondary" style="margin:0 0 13px">COPY INVITE LINK</button>${Array.from(
        { length: 4 },
        (_, id) => {
          const p = r.roster.find((p) => p.id === id);
          return `<div class="player-row"><span class="player-dot" style="background:${COLORS[id]};opacity:${p ? 1 : 0.2}"></span><b>${p ? NAMES[id] + (id === r.id ? " · YOU" : "") : "EMPTY"}</b><small class="${p?.ready ? "good" : ""}">${p ? (id === 0 ? "HOST" : p.ready ? "READY" : "NOT READY") : "—"}</small></div>`;
        },
      ).join(
        "",
      )}${r.host ? settingsHtml() : ""}<p class="subtle">${touchDevice ? "Left side: drag to move, swipe up to jump, down to lie down. Right side: drag to aim, hold to fire, double-tap to throw." : "A / D move · W / Space jump · S lie down · Mouse aim · Left click attack · Right click block · F throw weapon."}</p>${r.host ? `<button id="start-online" class="button primary" ${canStart ? "" : "disabled"}>${r.roster.length < 2 ? "WAITING FOR AT LEAST 2 PLAYERS" : !canStart ? "WAITING FOR EVERYONE TO READY UP" : "START MATCH"} <span>↗</span></button>` : `<button id="ready" class="button primary">${r.roster.find((p) => p.id === r.id)?.ready ? "NOT READY" : "READY"}</button>`}<p class="subtle">${r.host ? "Keep this tab visible while hosting. Leaving ends the room." : "The host starts the match when everyone is ready."}</p>`,
  );
  if (r.publicRoom) {
    $("#panel-title").textContent = "Public table";
    const status = document.createElement("p");
    status.id = "quick-status";
    status.className = "good";
    status.textContent =
      r.roster.length < 2
        ? "Waiting for another player."
        : "Players found. The match starts shortly.";
    $("#panel").append(status);
  }
  $("#back").onclick = home;
  $("#copy-room").onclick = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast("Invite link copied. Send it to your friends.");
    } catch {
      toast("Room code: " + r.code + " — copy it from the room above.");
    }
  };
  if (r.host) {
    wireSettings();
    $("#start-online").onclick = () => {
      if (r.start()) startWorld(r.roster.map((p) => p.id));
    };
  } else
    $("#ready").onclick = () =>
      r.ready(!r.roster.find((p) => p.id === r.id)?.ready);
}
function help(back = hidePanel) {
  showPanel(
    "help",
    heading("Controls") +
      `<div class="touch-help"><h3>TOUCH</h3><p><b>Left side:</b> drag left or right to move. Release to stop. Swipe up to jump; swipe up again for a second jump. Drag down and hold to lie down.</p><p><b>Right side:</b> drag in any direction to aim and fire, or hold to fire in the current direction. Double-tap to throw your weapon.</p><p><b>Block:</b> hold the Block button. Weapons are picked up automatically. Landscape shows the full arena; portrait follows your player with an overview of the arena.</p></div>` +
      `<details class="keyboard-help" ${touchDevice ? "" : "open"}><summary>Keyboard controls</summary><div class="controls-grid"><div><h3 style="color:${COLORS[0]}">PLAYER 1 / ONLINE</h3><p><span class="key">A</span><span class="key">D</span> Move</p><p><span class="key">W</span> / Space · Jump twice</p><p>Left click / <span class="key">E</span> Punch / fire</p><p>Right click / <span class="key">G</span> Block / parry</p><p><span class="key">F</span> Throw weapon</p><p><span class="key">S</span> Hold to lie down</p><p>Mouse aims arms and weapons.</p></div><div><h3 style="color:${COLORS[1]}">PLAYER 2</h3><p><span class="key">←</span><span class="key">→</span> Move</p><p><span class="key">↑</span> Jump twice</p><p><span class="key">K</span> Punch / fire</p><p><span class="key">L</span> Block / parry</p><p><span class="key">O</span> Throw weapon</p><p><span class="key">↓</span> Hold to lie down</p></div></div></details><p><b>Controller:</b> left stick / D-pad move. A / cross jumps. X / square or RT attacks. B / circle or LT blocks. Y / triangle throws the weapon. Right stick aims. Hold LB or D-pad down to lie down.</p><p>Block just before a hit to parry and push the attacker back. Keep holding to guard, but watch your stamina. A parry can reflect bullets.</p><p>The last player alive wins the round. Walk near a weapon to pick it up automatically when unarmed. Throw the current weapon to collect another. Tables block shots and break under damage. Elevators carry players between floors. Explosions hurt everyone, including you.</p><p class="subtle">Rounds become sudden death after 120 seconds. Escape pauses a local match. Touch controls work in online rooms and as one local player alongside controllers.</p><button id="got-it" class="button primary">CLOSE</button>`,
  );
  $("#back").onclick = back;
  $("#got-it").onclick = back;
}
function pauseGame() {
  if (!playing) return;
  if (view === "pause") {
    resume();
    return;
  }
  if (!room || room.host) paused = true;
  clearInput();
  if (room?.host && world)
    room.sendState({ ...world.snapshot(), paused: true });
  showPanel(
    "pause",
    heading(room && !room.host ? "Match menu" : "Paused") +
      `${room && !room.host ? "<p>The match continues while this menu is open.</p>" : ""}<button id="resume" class="button primary">RESUME</button><button id="pause-help" class="button secondary">CONTROLS</button><button id="leave" class="button secondary">${room ? "LEAVE ROOM" : "END MATCH"}</button>`,
  );
  $("#back").onclick = resume;
  $("#resume").onclick = resume;
  $("#leave").onclick = home;
  $("#pause-help").onclick = () =>
    help(() => {
      view = "";
      pauseGame();
    });
}
function resume() {
  paused = false;
  hidePanel();
  accumulator = 0;
}
function matchOver(s) {
  shownMatch = true;
  showPanel(
    "match",
    heading(`${NAMES[s.winner]} WINS.`) +
      `<div class="match-scores">${s.players.map((p) => `<span style="color:${COLORS[p.id]}">${NAMES[p.id]}<b>${s.scores[p.id]}</b></span>`).join("")}</div>${!room || room.host ? '<button id="rematch" class="button primary">REMATCH <span>↗</span></button>' : '<p class="good" style="text-align:center">Waiting for the host to start a rematch.</p>'}<button id="finish" class="button secondary">${room ? "LEAVE ROOM" : "MAIN MENU"}</button>`,
  );
  $("#back").onclick = home;
  $("#finish").onclick = home;
  if ($("#rematch"))
    $("#rematch").onclick = () => {
      if (room) {
        room.broadcast({ t: "start" });
        startWorld(room.roster.map((p) => p.id));
      } else startWorld(world.ids);
    };
}
function updateHud(s) {
  $("#scoreboard").innerHTML = s.players
    .map(
      (p) =>
        `<div class="score" style="opacity:${p.alive ? 1 : 0.4}"><div class="score-top" style="color:${COLORS[p.id]}"><span>${NAMES[p.id]}${room && p.id === room.id ? " •" : ""}</span><b>${s.scores[p.id]}</b></div><div class="health"><i style="background:${COLORS[p.id]};width:${Math.max(0, p.hp)}%"></i></div><small>${p.alive ? (p.weapon ? WEAPONS[p.weapon].name + " · " + p.ammo : "FISTS · " + Math.ceil(p.hp) + " HP") : "ELIMINATED"}</small></div>`,
    )
    .join("");
  $("#arena-name").textContent = ARENAS[s.arenaIndex].name;
  $("#round-label").textContent = `ROUND ${s.round} · FIRST TO ${s.target}`;
  const status = $("#round-status");
  const warning =
    s.phase === "fight" && s.elapsed >= SUDDEN_DEATH - 10
      ? s.elapsed >= SUDDEN_DEATH
        ? "Sudden death\nHealth draining"
        : `Sudden death in ${Math.ceil(SUDDEN_DEATH - s.elapsed)}`
      : "";
  if (status.textContent !== warning) status.textContent = warning;
  status.classList.toggle("hidden", !warning);
  const a = $("#announcement");
  if (s.paused) {
    a.innerHTML = "PAUSED<small>The host paused the match.</small>";
  } else if (s.phase === "countdown") {
    a.innerHTML = `${s.phaseTime > 0.45 ? Math.ceil(s.phaseTime) : "FIGHT"}<small>${ARENAS[s.arenaIndex].name}</small>`;
  } else if (s.phase === "result") {
    a.innerHTML = `${s.winner === null ? "DRAW" : NAMES[s.winner] + " WINS THE ROUND"}<small>Next arena in ${Math.max(1, Math.ceil(s.phaseTime))}</small>`;
  } else a.textContent = "";
  if (room && !room.host)
    $("#footer-hint").textContent =
      `ONLINE · ${ping} MS · YOU ARE ${NAMES[room.id]}`;
}
function interpolated(now) {
  if (!remote) return null;
  if (!previousRemote || previousRemote.round !== remote.round) return remote;
  const f = Math.max(
    0,
    Math.min(1, (now - 50 - previousAt) / Math.max(1, remoteAt - previousAt)),
  );
  return {
    ...remote,
    platforms: remote.platforms.map((p, i) => {
      const old = previousRemote.platforms[i];
      return old
        ? { ...p, x: old.x + (p.x - old.x) * f, y: old.y + (p.y - old.y) * f }
        : p;
    }),
    players: remote.players.map((p) => {
      const old = previousRemote.players.find((q) => q.id === p.id);
      if (!old || old.alive !== p.alive) return p;
      return {
        ...p,
        x: old.x + (p.x - old.x) * f,
        y: old.y + (p.y - old.y) * f,
        walk: old.walk + (p.walk - old.walk) * f,
        rig:
          p.rig?.map((q, i) =>
            old.rig?.[i]
              ? {
                  ...q,
                  x: old.rig[i].x + (q.x - old.rig[i].x) * f,
                  y: old.rig[i].y + (q.y - old.rig[i].y) * f,
                }
              : q,
          ) ?? null,
      };
    }),
  };
}
function frame(now) {
  touchInput =
    canUseTouch() && !view && !paused && !remote?.paused
      ? touchControls.read(now)
      : emptyInput();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  netClock += dt;
  hudClock += dt;
  if (world && !paused) {
    accumulator += dt;
    let n = 0;
    while (accumulator >= STEP && n++ < 7) {
      const inputs = room
        ? { ...room.getInputs(now), 0: ownInput() }
        : Object.fromEntries(
            world.ids.map((id) => [id, readInput(devices[id])]),
          );
      world.step(STEP, inputs);
      accumulator -= STEP;
    }
  }
  if (room && playing && netClock >= 1 / 30) {
    netClock = 0;
    if (room.host && world) room.sendState({ ...world.snapshot(), paused });
    else if (!room.host) room.sendInput(view ? emptyInput() : ownInput());
  }
  const state = world ? world.snapshot() : interpolated(now);
  if (state) {
    renderer.events(state.events, sound);
    if (hudClock > 0.07) {
      hudClock = 0;
      updateHud(state);
    }
    if (state.phase === "match" && !shownMatch) matchOver(state);
  }
  renderer.draw(state, dt, renderer.reduced ? 0 : now / 1000);
  updateTouchView(state, dt);
  requestAnimationFrame(frame);
}
$("#local").onclick = localLobby;
$("#menu-controls").onclick = () => {
  unlock();
  help();
};
$("#online").onclick = () => onlineMenu();
$("#help").onclick = () => {
  unlock();
  if (playing) {
    pauseGame();
    help(() => {
      view = "";
      pauseGame();
    });
  } else help();
};
$("#pause").onclick = pauseGame;
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
    if (playing) {
      e.preventDefault();
      if (view === "help") {
        view = "";
        pauseGame();
      } else if (view !== "match") pauseGame();
    } else if (view && !["room", "connecting"].includes(view)) hidePanel();
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
window.addEventListener("blur", () => {
  clearInput();
  if (playing && !paused && (!room || room.host) && view !== "match")
    pauseGame();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearInput();
    if (playing && !paused && (!room || room.host) && view !== "match")
      pauseGame();
  }
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
  return (
    playing &&
    (room ? touchDevice : devices.slice(0, playerCount).includes("touch"))
  );
}
function syncTouchUi() {
  const active = canUseTouch();
  document.body.classList.toggle("touch-playing", active);
  $("#touch-controls").classList.toggle(
    "hidden",
    !active || !!view || paused || !!remote?.paused,
  );
  $("#overview").classList.toggle("hidden", !active || !!view);
}
function measureGame() {
  clearInput();
  gameRect = canvas.getBoundingClientRect();
  const follow = canUseTouch() && matchMedia("(orientation: portrait)").matches;
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
    enabled: () => canUseTouch() && !view && !paused && !remote?.paused,
    wake: unlock,
  });
}
function updateTouchView(state, dt) {
  const active = canUseTouch(),
    follow = active && matchMedia("(orientation: portrait)").matches;
  if (state?.paused && (touchControls.move || touchControls.aim)) clearInput();
  $("#touch-controls").classList.toggle(
    "hidden",
    !active || !!view || paused || !!state?.paused,
  );
  if (!active) {
    currentViewport = gameViewport(gameRect.width, gameRect.height);
    canvas.style.objectPosition = "50% 50%";
    return;
  }
  const controlledId = room ? room.id : devices.indexOf("touch");
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
  $("#touch-block").classList.toggle("pressed", touchInput.block);
  if (!state || !follow) return;
  const c = $("#overview").getContext("2d"),
    scale = 240 / W;
  c.clearRect(0, 0, 240, 135);
  c.fillStyle = "#0b1724dd";
  c.fillRect(0, 0, 240, 135);
  c.fillStyle = "#9eafb0";
  for (const p of state.platforms)
    c.fillRect(p.x * scale, p.y * scale, p.w * scale, 2);
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
      c.fillStyle = COLORS[p.id];
      c.fill();
      if (p.id === controlledId) {
        c.strokeStyle = "#fff";
        c.stroke();
      }
    }
}
setInterval(() => {
  updatePadStatus();
  if (room && !room.host) room.ping();
  if (
    room?.publicRoom &&
    room.host &&
    !room.running &&
    view === "room" &&
    room.quickReadyAt
  ) {
    const seconds = Math.max(
      0,
      Math.ceil((room.quickReadyAt - performance.now()) / 1000),
    );
    if ($("#quick-status"))
      $("#quick-status").textContent = `Match starts in ${seconds}…`;
    if (seconds === 0 && room.start()) startWorld(room.roster.map((p) => p.id));
  }
}, 2000);
requestAnimationFrame(frame);
if (validCode(new URLSearchParams(location.search).get("room")?.toUpperCase()))
  onlineMenu();
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    room?.close();
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
      mode: room ? "online" : "local",
      players: world?.ids || room?.roster.map((p) => p.id) || [],
      round: world?.round || remote?.round || null,
    }),
  });
  register({
    name: "configure_couch_lobby",
    description:
      "Open and configure the local multiplayer lobby. Does not start a match.",
    inputSchema: {
      type: "object",
      properties: { players: { type: "integer", minimum: 2, maximum: 4 } },
      required: ["players"],
      additionalProperties: false,
    },
    execute: (input) => {
      if (
        !input ||
        !Number.isInteger(input.players) ||
        input.players < 2 ||
        input.players > 4 ||
        playing ||
        room
      )
        throw new Error("Choose 2–4 players from the main menu.");
      playerCount = input.players;
      localLobby();
      return { view: "local", players: playerCount };
    },
  });
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}
