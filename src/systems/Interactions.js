// "Press E" prompts. Anything you can talk to, pick up, rest at or walk through registers here.
export class Interactions {
  constructor(game) {
    this.game = game;
    this.items = [];
    this.current = null;
  }

  add(item) {
    this.items.push(item);
    return item;
  }

  remove(item) {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    if (this.current === item) this.current = null;
  }

  update() {
    const g = this.game;
    const p = g.player;
    this.current = null;
    if (p.alive && p.state === 'move') {
      let best = Infinity;
      for (const it of this.items) {
        if (it.enabled && !it.enabled()) continue;
        const d = Math.hypot(p.pos.x - it.x, p.pos.z - it.z);
        if (d < it.radius && d < best) {
          best = d;
          this.current = it;
        }
      }
    }
    g.hud.setPrompt(this.current ? this.current.label() : null);
    if (this.current && g.input.pressed('interact')) {
      g.input.consume('interact');
      this.current.action();
    }
  }
}
