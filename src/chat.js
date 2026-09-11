export const CHAT_LIMIT = 120;
export const CHAT_LIFETIME = 4000;
export const CHAT_COOLDOWN = 1000;

export function cleanChat(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, " ")
    .replace(/\s+/gu, " ").trim().slice(0, CHAT_LIMIT).replace(/[\ud800-\udbff]$/, "").trim();
}
const validId = id => Number.isInteger(id) && id >= 0 && id < 4;
const validRound = round => Number.isSafeInteger(round) && round > 0;
export function validChat(message) {
  return !!message && validId(message.id) && validRound(message.round) &&
    typeof message.text === "string" && message.text.length > 0 && message.text.length <= CHAT_LIMIT &&
    message.text === cleanChat(message.text) && Number.isFinite(message.life) &&
    message.life > 0 && message.life <= CHAT_LIFETIME;
}

// Speech travels reliably, independently of the replaceable physics frames.
// Wall-clock expiry also applies while a tab is hidden or reduced motion is on.
export class FighterChat {
  constructor(clock = () => performance.now()) {
    this.clock = clock;
    this.messages = new Map();
    this.cooldowns = new Map();
    this.round = null;
  }
  reset() {
    this.messages.clear(); this.cooldowns.clear(); this.round = null;
  }
  setRound(round) {
    if (!validRound(round) || (this.round !== null && round <= this.round)) return;
    this.messages.clear(); this.round = round;
  }
  retain(ids) {
    for (const map of [this.messages, this.cooldowns])
      for (const id of map.keys()) if (!ids.includes(id)) map.delete(id);
  }
  publish(id, value) {
    const text = cleanChat(value), now = this.clock();
    if (!validId(id) || !this.round || !text || now < (this.cooldowns.get(id) ?? -Infinity)) return null;
    const message = { id, text, round: this.round, life: CHAT_LIFETIME };
    this.cooldowns.set(id, now + CHAT_COOLDOWN);
    this.receive(message);
    return message;
  }
  receive(message) {
    if (!validChat(message) || (this.round !== null && message.round < this.round)) return false;
    this.setRound(message.round);
    this.messages.set(message.id, { ...message, expires: this.clock() + message.life });
    return true;
  }
  snapshot() {
    const now = this.clock(), messages = [];
    for (const [id, message] of this.messages) {
      const life = message.expires - now;
      if (life <= 0) this.messages.delete(id);
      else messages.push({ id, text: message.text, round: message.round, life });
    }
    return messages;
  }
}

export class ChatComposer {
  constructor(form, { enabled, clearInput, send }) {
    this.form = form; this.input = form.querySelector("input");
    this.enabled = enabled; this.clearInput = clearInput; this.send = send;
    this.isOpen = false; this.composing = false;
    this.input.maxLength = CHAT_LIMIT;
    this.input.addEventListener("compositionstart", () => { this.composing = true; });
    this.input.addEventListener("compositionend", () => { this.composing = false; });
    form.addEventListener("submit", event => { event.preventDefault(); if (!this.composing) this.submit(); });
  }
  open() {
    if (!this.enabled()) return;
    this.clearInput(); this.isOpen = true;
    this.form.classList.remove("hidden"); this.input.focus({ preventScroll: true });
  }
  close() {
    this.isOpen = false; this.composing = false;
    this.form.classList.add("hidden"); this.input.value = ""; this.input.blur(); this.clearInput();
  }
  submit() {
    if (!this.isOpen || !this.enabled()) return;
    const text = cleanChat(this.input.value);
    if (text && !this.send(text)) return;
    this.close();
  }
  handleKey(event) {
    if (this.isOpen) {
      if (event.isComposing || event.keyCode === 229) return true;
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        if (!event.repeat) event.key === "Escape" ? this.close() : this.submit();
      }
      return true;
    }
    if (event.key !== "Enter" || !this.enabled() || event.isComposing ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName) || event.target?.isContentEditable) return false;
    event.preventDefault();
    if (!event.repeat) this.open();
    return true;
  }
}
