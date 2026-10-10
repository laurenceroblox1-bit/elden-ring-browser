// Tamsin's wares (talk to her at the Oasis of Seven Palms, then E at her crates): smithing stones,
// flask seeds (one more flask each, two at most) and a shield. Prices in ash. Closes with E, Esc or B.
import { SHIELDS } from '../data/weapons.js';

export const WARES = [
  { id: 'stone', name: 'Smithing Stone', desc: 'For Hessa\'s anvil in the Sunken Forge. "Dug out of the Wastes by someone braver than me."', price: 500 },
  { id: 'seed', name: 'Flask Seed', desc: 'A hard green seed that swells in water. Your flask holds one more draught for each (two at most).', price: 2500, max: 2 },
  { id: 'sunsteel_shield', name: SHIELDS.sunsteel_shield.name, desc: SHIELDS.sunsteel_shield.desc, price: 1500, gear: true },
];

export class ShopPanel {
  constructor(hudRoot, game) {
    this.game = game;
    const el = document.createElement('section');
    el.className = 'screen shop-screen';
    el.hidden = true;
    el.innerHTML = `
      <div class="panel shop-panel" role="dialog" aria-label="Trade with Tamsin">
        <div class="panel-head">
          <h2>Tamsin's Wares</h2>
          <span class="close-hint"><kbd>E</kbd> Close</span>
        </div>
        <p class="shop-ash"></p>
        <ul class="shop-list"></ul>
      </div>`;
    hudRoot.appendChild(el);
    this.root = el;
    this.list = el.querySelector('.shop-list');
    this.list.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]');
      if (b) this.buy(b.dataset.id);
    });
  }

  // How many more of a ware can be bought (Infinity for stones).
  _left(w) {
    const st = this.game.state;
    if (w.gear) return this.game.hasGear(w.id) ? 0 : 1;
    if (w.max) return w.max - (st.flags[`bought_${w.id}`] ?? 0);
    return Infinity;
  }

  buy(id) {
    const g = this.game, w = WARES.find((x) => x.id === id);
    if (!w || this._left(w) <= 0) return;
    if (g.state.ash < w.price) {
      g.hud.toast('Not enough ash.');
      g.audio.play('ui');
      return;
    }
    g.state.ash -= w.price;
    if (w.id === 'stone') g.giveItem('smithing_stone');
    else if (w.id === 'seed') {
      g.state.flags.bought_seed = (g.state.flags.bought_seed ?? 0) + 1;
      g.state.flasksMax += 1;
      g.player.applyStats(g.state.stats, g.state.flasksMax);
      g.player.flasks = Math.min(g.player.flasks + 1, g.player.flasksMax);
      g.hud.toast('Your flask holds one more draught.', 'item');
      g.audio.play('pickup');
    } else if (w.gear) g.giveGear(w.id);
    g.save();
    this.render();
  }

  show() {
    this.render();
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  render() {
    const g = this.game;
    this.root.querySelector('.shop-ash').textContent = `You carry ${g.state.ash} ash.`;
    this.list.innerHTML = WARES.map((w) => {
      const left = this._left(w);
      const sold = left <= 0;
      const can = !sold && g.state.ash >= w.price;
      return `<li class="shop-item${sold ? ' sold' : ''}">
        <span class="shop-head"><b>${w.name}</b><span>${sold ? 'Sold' : `${w.price} ash${Number.isFinite(left) ? ` · ${left} left` : ''}`}</span></span>
        <span class="shop-desc">${w.desc}</span>
        <button class="btn${can ? ' primary' : ''}" data-id="${w.id}"${sold ? ' disabled' : ''}>Buy</button>
      </li>`;
    }).join('');
  }
}
