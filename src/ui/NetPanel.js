// Multiplayer (N, or Pause > Multiplayer): your name, the server address, connect/leave, who's here,
// and the chat log. Plus the in-game chat bar: Enter opens it, Enter sends, Escape cancels; recent
// lines fade out above the gear panel.
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class NetPanel {
  constructor(hudRoot, game) {
    this.game = game;
    const net = game.net;
    const el = document.createElement('section');
    el.className = 'screen net-screen';
    el.hidden = true;
    el.innerHTML = `
      <div class="panel net-panel" role="dialog" aria-label="Multiplayer">
        <div class="panel-head">
          <h2>Multiplayer</h2>
          <span class="close-hint"><kbd data-glyph="close" data-key="N">N</kbd> Close</span>
        </div>
        <p class="net-status" aria-live="polite"></p>
        <label class="net-field"><span>Your name</span><input class="net-name" maxlength="20" spellcheck="false"></label>
        <label class="net-field"><span>Server</span><input class="net-url" spellcheck="false" placeholder="ws://192.168.1.20:8080/ws"></label>
        <div class="test-btns"><button class="btn primary net-go"></button></div>
        <p class="test-sub net-help"></p>
        <h3 class="net-h">In the Vale</h3>
        <ul class="net-who"></ul>
        <h3 class="net-h">Chat <span class="net-hint">(press Enter in the world to talk)</span></h3>
        <div class="net-log"></div>
      </div>`;
    hudRoot.appendChild(el);
    this.root = el;
    this.$ = (s) => el.querySelector(s);
    this.$('.net-go').addEventListener('click', () => {
      game.audio.play('ui');
      if (net.status === 'offline') net.connect(this.$('.net-url').value, this.$('.net-name').value);
      else net.disconnect();
    });
    net.onChange = () => { if (!this.root.hidden) this.render(); };

    // The chat bar lives in the HUD whether or not this panel is open.
    const bar = document.createElement('div');
    bar.className = 'chat';
    bar.innerHTML = '<div class="chat-lines" aria-live="polite"></div><input class="chat-input" maxlength="200" placeholder="Say something (Enter to send, Esc to cancel)" hidden>';
    hudRoot.appendChild(bar);
    this.lines = bar.querySelector('.chat-lines');
    this.input = bar.querySelector('.chat-input');
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        net.say(this.input.value);
        this.closeChat();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeChat();
      }
    });
    this.input.addEventListener('blur', () => this.closeChat());
    game.hud.chatLine = (name, text, self) => this.addLine(name, text, self);
  }

  get typing() { return !this.input.hidden; }

  openChat() {
    if (!this.game.net.online) {
      this.game.hud.toast('Not connected. Press N to join a shared Vale.');
      return;
    }
    this.game.input.down.clear(); // nothing stays held while you type
    this.input.hidden = false;
    this.input.value = '';
    this.input.focus();
  }

  closeChat() {
    if (this.input.hidden) return;
    this.input.hidden = true;
    this.input.blur();
  }

  addLine(name, text, self) {
    const line = document.createElement('div');
    line.className = 'chat-line' + (self ? ' self' : '');
    line.innerHTML = `<b>${esc(name)}</b> ${esc(text)}`;
    this.lines.appendChild(line);
    while (this.lines.children.length > 6) this.lines.firstChild.remove();
    setTimeout(() => line.classList.add('old'), 12000);
  }

  show() {
    const net = this.game.net;
    this.$('.net-name').value = net.name;
    this.$('.net-url').value = net.url;
    this.render();
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  render() {
    const net = this.game.net;
    const off = net.status === 'offline';
    this.$('.net-go').textContent = off ? 'Join the shared Vale' : net.status === 'connecting' ? 'Cancel' : 'Leave';
    this.$('.net-name').disabled = this.$('.net-url').disabled = !off;
    this.$('.net-status').textContent = net.status === 'online'
      ? `Connected as ${net.name}. ${net.ghosts.size ? `${net.ghosts.size + 1} wanderers in this Vale.` : 'Nobody else is here yet.'}`
      : net.status === 'connecting' ? 'Connecting…' : net.error || 'Playing alone.';
    this.$('.net-help').textContent = off
      ? (net.defaultUrl()
        ? 'This page came from a game server, so its address is filled in already. Share the page address with friends and they can join too.'
        : 'To play together, one of you runs "node server.js" in the game folder (see README), then everyone opens the address it prints. Enemies and bosses stay your own; you see each other, ride and fight side by side, and chat.')
      : 'Enemies, loot and bosses are still your own: each of you fights your own copy of them.';
    const who = [...net.ghosts.values()].map((g) => `<li>${esc(g.name)}</li>`);
    if (net.online) who.unshift(`<li class="self">${esc(net.name)} (you)</li>`);
    this.$('.net-who').innerHTML = who.join('') || '<li class="none">Nobody</li>';
    this.$('.net-log').innerHTML = net.chatLog.slice(-12).map((l) => `<div class="${l.self ? 'self' : ''}"><b>${esc(l.name)}</b> ${esc(l.text)}</div>`).join('') || '<div class="none">No messages yet.</div>';
  }
}
