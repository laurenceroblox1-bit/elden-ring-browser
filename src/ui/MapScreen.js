// The map (M, D-pad right, or Pause > Map). The relief is drawn once to a canvas from the terrain's
// height field: hypsometric tint in the Vale's palette with hill shading, the lake, roads, the
// arena ring and Castle Dunmarrow. Live markers sit on top as DOM elements and are placed each
// time the map opens (the game is paused while it's open). Lit lanterns are buttons: fast travel.
import { WORLD, ZONES, ROADS, ARENA, LAKE, RIME } from '../data/world.js';

const EXTENT = Math.max(WORLD.playRadius, RIME.r - RIME.z) + 14; // metres from the centre to each edge of the map (the Rimewold reaches furthest)
const RES = 512; // canvas pixels per side
const LIGHT = norm([-0.55, 0.75, -0.55]); // hill shading from the north-west, as on old survey maps

// Height (m) -> colour: damp hollows, olive lowland, gold grass, dry slopes, rock, snow.
const RAMP = [
  [-30, 0x4f5a2c], [-6, 0x6f7838], [8, 0x9c8f52], [22, 0xa38f58], [40, 0x8f7a5e],
  [62, 0x77736a], [92, 0x8f8a80], [118, 0xdcd9d2],
];
const WATER = [0x5c7a80, 0x3a5560]; // shallow, deep
const PARCHMENT = [0xd9c49a, 0.16]; // tint toward old paper

function norm(v) {
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
}
const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const RAMP_RGB = RAMP.map(([h, c]) => [h, rgb(c)]);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function ramp(h) {
  if (h <= RAMP_RGB[0][0]) return RAMP_RGB[0][1];
  for (let i = 1; i < RAMP_RGB.length; i++) {
    const [h1, c1] = RAMP_RGB[i];
    if (h <= h1) {
      const [h0, c0] = RAMP_RGB[i - 1];
      return mix(c0, c1, (h - h0) / (h1 - h0));
    }
  }
  return RAMP_RGB[RAMP_RGB.length - 1][1];
}

// World metres -> percent across the map.
const pctX = (x) => ((x + EXTENT) / (2 * EXTENT)) * 100;
const pctZ = (z) => ((z + EXTENT) / (2 * EXTENT)) * 100;
const at = (x, z) => `left:${pctX(x).toFixed(2)}%;top:${pctZ(z).toFixed(2)}%`;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class MapScreen {
  constructor(hudRoot, game) {
    this.game = game;
    this.drawn = false;
    const el = document.createElement('section');
    el.className = 'screen map-screen';
    el.hidden = true;
    el.innerHTML = `
      <div class="panel wide map-panel" role="dialog" aria-label="Map">
        <div class="map-view">
          <canvas class="map-canvas" width="${RES}" height="${RES}" aria-hidden="true"></canvas>
          <div class="map-marks"></div>
          <div class="map-north" aria-hidden="true">N</div>
        </div>
        <div class="map-side">
          <div class="panel-head"><h2>The Vale</h2><span class="close-hint"><kbd data-glyph="close" data-key="M">M</kbd> Close</span></div>
          <h3 class="map-h">Fast travel</h3>
          <div class="map-travel"></div>
          <p class="map-status" aria-live="polite"></p>
          <h3 class="map-h">Legend</h3>
          <ul class="map-legend">
            <li><i class="lg player"></i>You</li>
            <li><i class="lg shrine"></i>Lit lantern (travel)</li>
            <li><i class="lg quest"></i>Objective</li>
            <li><i class="lg npc"></i>Someone to talk to</li>
            <li><i class="lg gate"></i>The mist gate</li>
            <li><i class="lg remnant"></i>Your lost ash</li>
          </ul>
        </div>
      </div>`;
    hudRoot.appendChild(el);
    this.root = el;
    this.canvas = el.querySelector('.map-canvas');
    this.marks = el.querySelector('.map-marks');
    this.travel = el.querySelector('.map-travel');
    this.status = el.querySelector('.map-status');
    el.addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-shrine]');
      if (b) this.travelTo(b.dataset.shrine);
    });
  }

  show() {
    if (!this.drawn) this.draw();
    this.status.textContent = this.game.bossFight ? 'The mist holds you in the arena: no travel until the fight ends.' : '';
    this.refresh();
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  travelTo(id) {
    const g = this.game;
    const why = g.fastTravel(id);
    if (why) {
      this.status.textContent = why;
      g.audio.play('ui');
      return;
    }
    g.closeModal();
  }

  // ---------- markers ----------

  refresh() {
    const g = this.game;
    const p = g.player;
    const st = g.state;
    const blocked = g.bossFight || !p.alive;
    const parts = [];
    // Zone names, once discovered.
    for (const id of st.discovered) {
      const z = ZONES[id];
      if (z) parts.push(`<span class="map-zone" style="${at(z.x, z.z)}">${esc(z.name)}</span>`);
    }
    const fog = g.world.fogGate;
    if (fog.active) parts.push(`<span class="mk gate" style="${at(fog.x, fog.z)}" title="The mist gate"></span>`);
    for (const n of g.npcs) parts.push(`<span class="mk npc" style="${at(n.def.x, n.def.z)}" title="${esc(n.def.name)}"></span>`);
    for (const m of g.quests.markers()) parts.push(`<span class="mk quest${m.main ? ' main' : ''}" style="${at(m.x, m.z)}" title="${esc(m.label)}"></span>`);
    if (g.remnant) parts.push(`<span class="mk remnant" style="${at(g.remnant.x, g.remnant.z)}" title="Your lost ash (${g.remnant.amount})"></span>`);
    const lit = [...g.world.shrines.values()].filter((s) => s.lit);
    for (const s of lit) {
      parts.push(`<button class="mk shrine" style="${at(s.x, s.z)}" data-shrine="${s.id}" title="Travel to ${esc(s.name)}" aria-label="Travel to ${esc(s.name)}"${blocked ? ' aria-disabled="true"' : ''}></button>`);
    }
    // The player last, on top: an arrow along their facing (map up is north, -Z).
    parts.push(`<span class="mk player" style="${at(p.pos.x, p.pos.z)};transform:translate(-50%,-50%) rotate(${(Math.PI - p.yaw).toFixed(3)}rad)" title="You"></span>`);
    this.marks.innerHTML = parts.join('');

    this.travel.innerHTML = lit.length
      ? lit.map((s) => {
        const d = Math.round(Math.hypot(s.x - p.pos.x, s.z - p.pos.z));
        return `<button class="btn small map-go" data-shrine="${s.id}"${blocked ? ' aria-disabled="true"' : ''}><span>${esc(s.name)}</span><i>${d < 8 ? 'here' : `${d} m`}</i></button>`;
      }).join('')
      : '<p class="empty">Kindle a lantern to travel back to it.</p>';
  }

  // ---------- relief ----------

  draw() {
    this.drawn = true;
    const w = this.game.world;
    const ctx = this.canvas.getContext('2d');
    const img = ctx.createImageData(RES, RES);
    const d = img.data;
    const m = (2 * EXTENT) / RES; // metres per pixel
    // Sample once into a grid with a one-pixel border for the shading gradient.
    const N = RES + 2;
    const H = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) H[j * N + i] = w.getHeight(-EXTENT + (i - 0.5) * m, -EXTENT + (j - 0.5) * m);
    }
    const wl = w.waterLevel;
    const tint = rgb(PARCHMENT[0]);
    const edge = WORLD.playRadius;
    for (let j = 0; j < RES; j++) {
      for (let i = 0; i < RES; i++) {
        const k = (j + 1) * N + (i + 1);
        const h = H[k];
        const dx = (H[k + 1] - H[k - 1]) / (2 * m), dz = (H[k + N] - H[k - N]) / (2 * m);
        // Normal of the height field, exaggerated a little so the lowland folds read.
        const nx = -dx * 1.6, ny = 1, nz = -dz * 1.6;
        const nl = Math.hypot(nx, ny, nz);
        const shade = Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / nl);
        const x = -EXTENT + (i + 0.5) * m, z = -EXTENT + (j + 0.5) * m;
        let c;
        // Only the lake and the fen pools hold water (World.isWater); other hollows are dry ground.
        const lake = Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r;
        const level = lake ? wl : w.fenLevel;
        if (h < level && (lake || w.fenPoolDepth(x, z) > 0)) {
          c = mix(rgb(lake ? WATER[0] : 0x4a5240), rgb(lake ? WATER[1] : 0x1c2424), Math.min(1, (level - h) / 4));
          if (level - h < 0.35) c = mix(c, [226, 214, 176], 0.45); // a pale shoreline
        } else {
          c = ramp(h);
          if (z < RIME.snowZ) c = mix(c, [228, 234, 238], Math.min(1, (RIME.snowZ - z) / 20) * 0.75); // snow
          c = c.map((v) => v * (0.5 + shade * 0.72));
        }
        c = mix(c, tint, PARCHMENT[1]);
        // Beyond the walkable edge the mountains fade toward the frame.
        // (the walkable area is the Vale's circle plus the Rimewold's lobe)
        const r = Math.min(Math.hypot(x, z) - edge, Math.hypot(x - RIME.x, z - RIME.z) - RIME.r);
        if (r > -10) c = mix(c, [40, 33, 26], Math.min(0.55, (r + 10) / 60));
        const o = (j * RES + i) * 4;
        d[o] = c[0];
        d[o + 1] = c[1];
        d[o + 2] = c[2];
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    const px = (x) => ((x + EXTENT) / m);
    const pz = (z) => ((z + EXTENT) / m);
    // Roads: a dark bed with a pale track on top.
    ctx.lineJoin = ctx.lineCap = 'round';
    for (const [wdt, col] of [[4.2, 'rgba(52, 40, 28, 0.55)'], [2, 'rgba(236, 219, 176, 0.9)']]) {
      ctx.lineWidth = wdt;
      ctx.strokeStyle = col;
      for (const road of ROADS) {
        ctx.beginPath();
        road.forEach(([x, z], n) => (n ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z))));
        ctx.stroke();
      }
    }
    // The arena: a flagstone floor inside a ring of wall, open to the south (the mist) and the north gate.
    const ax = px(ARENA.x), az = pz(ARENA.z), ar = ARENA.r / m;
    ctx.fillStyle = 'rgba(132, 125, 114, 0.85)';
    ctx.beginPath();
    ctx.arc(ax, az, ar, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = 'rgba(58, 54, 49, 0.95)';
    const gap = 0.13;
    for (const [a0, a1] of [[Math.PI / 2 + gap, (3 * Math.PI) / 2 - gap], [-Math.PI / 2 + gap, Math.PI / 2 - gap]]) {
      ctx.beginPath();
      ctx.arc(ax, az, ar, a0, a1);
      ctx.stroke();
    }
    // Castle Dunmarrow: the curtain wall, its two towers and the keep behind (see World._buildCastle).
    const c = ZONES.castle;
    ctx.fillStyle = 'rgba(70, 64, 57, 0.95)';
    ctx.strokeStyle = 'rgba(30, 26, 22, 0.8)';
    ctx.lineWidth = 1;
    const rect = (x, z, wx, wz) => {
      ctx.fillRect(px(x - wx / 2), pz(z - wz / 2), wx / m, wz / m);
      ctx.strokeRect(px(x - wx / 2), pz(z - wz / 2), wx / m, wz / m);
    };
    rect(c.x, c.z - 22, 26, 18);
    rect(c.x, c.z - 8, 60, 6);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(px(c.x + s * 30), pz(c.z - 8), 6 / m, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // A thin double frame, like an engraved plate.
    ctx.strokeStyle = 'rgba(201, 164, 92, 0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, RES - 10, RES - 10);
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, RES - 20, RES - 20);
  }
}
