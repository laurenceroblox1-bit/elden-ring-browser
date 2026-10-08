import { Game } from './core/Game.js';

const app = document.getElementById('app');
try {
  const game = new Game(app);
  window.game = game; // handy from the dev console
} catch (err) {
  console.error(err);
  app.querySelector('#hud').innerHTML = `
    <section class="screen fatal">
      <div class="panel"><h2>Ashen Vale couldn't start</h2>
      <p>Your browser didn't give the game a WebGL canvas. Try a current Chrome, Edge or Firefox with hardware acceleration turned on.</p>
      <pre>${String(err && err.message ? err.message : err)}</pre></div>
    </section>`;
}
