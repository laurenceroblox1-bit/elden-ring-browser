// Appearance (pause menu): the Unbound's cloak colour, armour finish and helm ornament. Changes show at
// once on your knight and, in a shared Vale, on everyone else's screen. Kept as a preference, so a new
// journey starts in the same colours.
import { CLOAKS, ARMOURS, ORNAMENTS, cleanLook } from '../models/look.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

export class AppearancePanel {
  constructor(hudRoot, game) {
    this.game = game;
    const el = document.createElement('section');
    el.className = 'screen look-screen';
    el.hidden = true;
    el.innerHTML = `
      <div class="panel look-panel" role="dialog" aria-label="Appearance">
        <div class="panel-head"><h2>Appearance</h2><span class="close-hint"><kbd data-glyph="close" data-key="Esc">Esc</kbd> Close</span></div>
        <h3 class="look-h">Cloak</h3>
        <div class="look-row look-cloak"></div>
        <h3 class="look-h">Armour</h3>
        <div class="look-row look-armour"></div>
        <h3 class="look-h">Helm</h3>
        <div class="look-row look-ornament"></div>
        <p class="look-note">Other players in a shared Vale see you as you look here.</p>
      </div>`;
    hudRoot.appendChild(el);
    this.root = el;
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-k]');
      if (!b) return;
      const g = this.game;
      g.setLook({ ...g.look, [b.dataset.k]: b.dataset.v });
      g.audio.play('ui');
      this.render();
    });
  }

  show() {
    this.render();
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  render() {
    const l = cleanLook(this.game.look);
    const btn = (k, id, label, style = '') => `<button class="btn look-opt${l[k] === id ? ' on' : ''}" data-k="${k}" data-v="${id}" aria-pressed="${l[k] === id}" title="${label}"${style}>${style ? '' : label}</button>`;
    this.root.querySelector('.look-cloak').innerHTML = CLOAKS.map(([id, label, c]) => btn('cloak', id, label, ` style="--sw:${hex(c)}" aria-label="${label}"`)).join('');
    this.root.querySelector('.look-armour').innerHTML = ARMOURS.map(([id, label, a, b]) => `<button class="btn look-opt look-armour-opt${l.armour === id ? ' on' : ''}" data-k="armour" data-v="${id}" aria-pressed="${l.armour === id}"><i style="background:linear-gradient(135deg, ${hex(a)} 50%, ${hex(b)} 50%)"></i>${label}</button>`).join('');
    this.root.querySelector('.look-ornament').innerHTML = ORNAMENTS.map(([id, label]) => btn('ornament', id, label)).join('');
  }
}
