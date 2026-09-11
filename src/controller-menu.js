// Standard Gamepad API mapping also accepts Steam Input's gamepad emulation.
// Poll edges even during gameplay so holding A while a menu opens cannot click.
export class ControllerEdges {
  constructor() { this.held = new Set(); this.direction = null; this.nextRepeat = 0; }
  poll(pad, now) {
    const current = new Set();
    const pressed = n => pad?.buttons?.[n]?.pressed === true;
    if (pressed(0)) current.add('accept');
    if (pressed(1)) current.add('back');
    if (pressed(9)) current.add('menu');
    const x = pad?.axes?.[0] || 0, y = pad?.axes?.[1] || 0;
    if (pressed(12) || y < -.6) current.add('up');
    else if (pressed(13) || y > .6) current.add('down');
    else if (pressed(14) || x < -.6) current.add('left');
    else if (pressed(15) || x > .6) current.add('right');
    const result = [...current].filter(k => !this.held.has(k));
    const direction = [...current].find(k => ['up', 'down', 'left', 'right'].includes(k));
    if (direction !== this.direction) this.nextRepeat = now + 400;
    else if (direction && now >= this.nextRepeat) { result.push(direction); this.nextRepeat = now + 150; }
    this.direction = direction; this.held = current;
    return [...new Set(result)];
  }
}

export class ControllerMenu {
  constructor({ root, back, menu, wake, document = globalThis.document }) {
    Object.assign(this, { root, back, menu, wake, document });
    this.edges = new ControllerEdges(); this.suppressGameplay = false;
  }
  update(pad, now) {
    const actions = this.edges.poll(pad, now);
    if (!this.edges.held.size) this.suppressGameplay = false;
    for (const action of actions) {
      const root = this.document.querySelector('#controller-keyboard') || this.root();
      if (action === 'menu' || (action === 'back' && root)) {
        this.suppressGameplay = true;
        if (this.document.querySelector('#controller-keyboard')) this.closeKeyboard();
        else if (action === 'menu') this.menu(); else this.back();
        continue;
      }
      if (!root) continue;
      this.suppressGameplay = true; this.wake();
      const items = [...root.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary')]
        .filter(e => e.getClientRects().length && !e.closest('.hidden'));
      if (!items.length) continue;
      let index = items.indexOf(this.document.activeElement);
      if (index < 0) { items[0].focus(); if (action !== 'accept') continue; index = 0; }
      const item = items[index];
      if (item.tagName === 'SELECT' && ['left', 'right', 'accept'].includes(action)) {
        const step = action === 'left' ? -1 : 1;
        item.selectedIndex = (item.selectedIndex + step + item.options.length) % item.options.length;
        item.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (action === 'accept') {
        if (item.tagName === 'INPUT' && !item.readOnly) this.keyboard(item);
        else item.click();
      } else if (['up', 'down', 'left', 'right'].includes(action)) {
        const stride = root.id === 'controller-keyboard' && ['up', 'down'].includes(action) ? 10 : 1;
        const step = (['up', 'left'].includes(action) ? -1 : 1) * stride;
        items[(index + step + items.length) % items.length].focus();
      }
      this.document.activeElement?.scrollIntoView?.({ block: 'nearest' });
    }
  }
  closeKeyboard() {
    this.document.querySelector('#controller-keyboard')?.remove();
    this.keyboardTarget?.focus(); this.keyboardTarget = null;
  }
  keyboard(target) {
    this.closeKeyboard(); this.keyboardTarget = target;
    const box = this.document.createElement('section');
    box.id = 'controller-keyboard'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'On-screen keyboard');
    const output = this.document.createElement('output'); output.textContent = target.value;
    box.append(output);
    const grid = this.document.createElement('div'); grid.className = 'controller-keys'; box.append(grid);
    let value = target.value;
    const labels = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 'Space', 'Delete', 'Apply', 'Cancel'];
    for (const label of labels) {
      const button = this.document.createElement('button'); button.type = 'button'; button.textContent = label;
      button.onclick = () => {
        if (label === 'Cancel') { this.closeKeyboard(); return; }
        if (label === 'Apply') {
          target.value = value; target.dispatchEvent(new Event('input', { bubbles: true }));
          target.dispatchEvent(new Event('change', { bubbles: true })); this.closeKeyboard(); return;
        }
        value = label === 'Delete' ? Array.from(value).slice(0, -1).join('') : value + (label === 'Space' ? ' ' : label);
        value = Array.from(value).slice(0, target.maxLength > 0 ? target.maxLength : 20).join('');
        output.textContent = value;
      };
      grid.append(button);
    }
    this.document.body.append(box); grid.firstElementChild.focus();
  }
}
