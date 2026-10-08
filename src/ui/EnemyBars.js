// Floating health bars over enemies you are fighting, plus damage numbers when their health drops.
// A bar shows once an enemy is hurt, aggroed or locked on, and hides off-screen, beyond 32 m, or behind
// the camera. The boss is left out: he has the big bar at the bottom of the screen.
import * as THREE from '../lib/three.js';

const SHOW_DIST = 32;
const tmp = new THREE.Vector3();

export class EnemyBars {
  constructor(root, game) {
    this.game = game;
    this.layer = document.createElement('div');
    this.layer.className = 'enemy-bars';
    root.appendChild(this.layer);
    this.bars = new Map(); // enemy -> { el, fill, lag, name, lagV, lastHp, seenT }
    this.numbers = [];
  }

  _bar(e) {
    let b = this.bars.get(e);
    if (!b) {
      const el = document.createElement('div');
      el.className = 'ebar';
      el.hidden = true;
      el.innerHTML = '<div class="ebar-name"></div><div class="ebar-track"><div class="ebar-lag"></div><div class="ebar-fill"></div></div><div class="ebar-frost" hidden><i></i></div>';
      this.layer.appendChild(el);
      b = { el, frost: el.querySelector('.ebar-frost'), frostFill: el.querySelector('.ebar-frost i'), fill: el.querySelector('.ebar-fill'), lag: el.querySelector('.ebar-lag'), name: el.querySelector('.ebar-name'), lagV: 1, lastHp: e.hp, hold: 0, shown: false };
      this.bars.set(e, b);
    }
    return b;
  }

  _number(x, y, amount, crit) {
    const el = document.createElement('div');
    el.className = 'dmg-num' + (crit ? ' crit' : '');
    el.textContent = Math.round(amount);
    el.style.transform = `translate(${x}px, ${y}px)`;
    this.layer.appendChild(el);
    this.numbers.push({ el, t: 0, x: x + (Math.random() - 0.5) * 24, y });
  }

  update(dt) {
    const g = this.game, cam = g.camera, p = g.player.pos;
    const w = innerWidth, h = innerHeight;
    for (const e of g.enemies) {
      if (e.isBoss) continue; // bosses have the big bar at the bottom of the screen
      const b = this._bar(e);
      const hurt = e.hp < e.maxHp;
      const engaged = e.state && !['idle', 'return', 'dead'].includes(e.state);
      const locked = g.lockTarget === e;
      const dist = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
      let show = e.alive && e.model?.root.visible && dist < SHOW_DIST && (hurt || engaged || locked);

      // Damage numbers come from the health drop itself, so every source (blades, bolts, rings) counts.
      const drop = b.lastHp - e.hp;
      if (drop > 0.5 && dist < SHOW_DIST + 10) {
        tmp.set(e.pos.x, e.pos.y + e.height * 1.05, e.pos.z).project(cam);
        if (tmp.z < 1) this._number(((tmp.x + 1) / 2) * w, ((1 - tmp.y) / 2) * h - 18, drop, drop >= 60);
        b.hold = 0.8;
      }
      b.lastHp = e.hp;

      if (show) {
        tmp.set(e.pos.x, e.pos.y + e.height + 0.35, e.pos.z).project(cam);
        if (tmp.z >= 1 || tmp.x < -1.1 || tmp.x > 1.1 || tmp.y < -1.1 || tmp.y > 1.1) show = false;
      }
      if (show !== b.shown) {
        b.shown = show;
        b.el.hidden = !show;
      }
      if (!show) {
        b.lagV = e.hp / e.maxHp;
        continue;
      }
      const f = Math.max(0, e.hp / e.maxHp);
      if ((b.hold -= dt) <= 0) b.lagV = Math.max(f, b.lagV - dt * 0.6);
      b.fill.style.transform = `scaleX(${f})`;
      b.lag.style.transform = `scaleX(${Math.max(f, b.lagV)})`;
      b.name.textContent = locked ? e.name ?? '' : '';
      b.el.classList.toggle('open', !!e.isOpen?.());
      const fr = e.frostbite > 0 ? e.frostbite / 6 : (e.frost ?? 0) / 100;
      if (b.frost.hidden !== !(fr > 0.01)) b.frost.hidden = !(fr > 0.01);
      if (fr > 0.01) {
        b.frostFill.style.transform = `scaleX(${Math.min(1, fr)})`;
        b.frost.classList.toggle('bitten', e.frostbite > 0);
      }
      const scale = Math.max(0.6, Math.min(1, 14 / Math.max(dist, 1)));
      b.el.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) scale(${scale})`;
    }
    // Enemies spawned from the test menu come and go: drop bars that lost their enemy.
    for (const [e, b] of this.bars) {
      if (!g.enemies.includes(e)) {
        b.el.remove();
        this.bars.delete(e);
      }
    }
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.t += dt;
      if (n.t > 1.1) {
        n.el.remove();
        this.numbers.splice(i, 1);
        continue;
      }
      n.el.style.transform = `translate(${n.x}px, ${n.y - n.t * 38}px)`;
      n.el.style.opacity = String(Math.min(1, (1.1 - n.t) * 2.5));
    }
  }

  clear() {
    for (const b of this.bars.values()) b.el.hidden = true;
    for (const n of this.numbers) n.el.remove();
    this.numbers.length = 0;
  }
}
