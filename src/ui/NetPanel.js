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
        <div class="net-ws">
          <label class="net-field"><span>Server</span><input class="net-url" spellcheck="false" placeholder="ws://192.168.1.20:8080/ws"></label>
          <div class="test-btns"><button class="btn primary net-go"></button></div>
        </div>
        <div class="net-room" hidden>
          <label class="net-field"><span>Party code (optional: only people with the same code see each other)</span><input class="net-party" maxlength="40" spellcheck="false" placeholder="e.g. ashfriends"></label>
          <div class="test-btns">
            <button class="btn primary net-party-go">Join party</button>
            <button class="btn net-lobby">Back to everyone</button>
            <button class="btn net-show"></button>
            <button class="btn net-re">Reconnect</button>
            <button class="btn net-inv">Copy invite link</button>
          </div>
        </div>
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
    this.$('.net-name').addEventListener('change', () => net.setName(this.$('.net-name').value));
    this.$('.net-party-go').addEventListener('click', () => { game.audio.play('ui'); net.joinParty(this.$('.net-party').value); });
    this.$('.net-lobby').addEventListener('click', () => { game.audio.play('ui'); this.$('.net-party').value = ''; net.joinParty(''); });
    this.$('.net-show').addEventListener('click', () => { game.audio.play('ui'); net.setVisible(!net.visible); });
    this.$('.net-inv').addEventListener('click', async () => {
      game.audio.play('ui');
      const link = net.inviteLink();
      try { await navigator.clipboard.writeText(link); game.hud.toast('Invite link copied: send it to your friends.', 'item'); }
      catch { window.prompt('Copy this invite link:', link); }
    });
    this.$('.net-re').addEventListener('click', () => { game.audio.play('ui'); net.reconnect(); });
    // "Go to them": travel to another player's side.
    this.$('.net-who').addEventListener('click', (e) => {
      const b = e.target.closest('.net-go-to');
      if (!b) return;
      game.audio.play('ui');
      const why = game.travelToFriend(b.dataset.key);
      if (why) game.hud.toast(why);
      else if (game.modal === 'multiplayer') game.closeModal();
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
      this.game.hud.toast(this.game.net.partyMode ? 'Connecting to the shared Vale…' : 'Not connected. Press N to join a shared Vale.');
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
    this.$('.net-party').value = net.party;
    this.render();
    this.root.hidden = false;
  }

  hide() {
    this.root.hidden = true;
  }

  render() {
    const net = this.game.net;
    const room = net.partyMode;
    this.$('.net-ws').hidden = room;
    this.$('.net-room').hidden = !room;
    if (room) {
      this.$('.net-name').disabled = false;
      const n = net.ghosts.size;
      const waiting = Math.max(0, net.present.size - n);
      this.$('.net-status').textContent = net.error || (net.online
        ? `${net.party ? `In party "${net.party}"` : 'In the shared Vale'} as ${net.name}. ${n ? `${n} other${n > 1 ? 's' : ''} playing with you.` : 'Nobody else is playing yet.'}${waiting ? ` ${waiting} more on the title screen.` : ''}${net.visible ? '' : ' (Hidden: others cannot see you.)'}${this._host(net)}`
        : net.status === 'connecting' ? 'Connecting to the shared Vale…' : 'Playing alone.');
      this.$('.net-show').textContent = `Show me to others: ${net.visible ? 'on' : 'off'}`;
      this.$('.net-lobby').disabled = !net.party;
      this.$('.net-help').textContent = 'Everyone who has this page open on claude.ai plays in the same Vale: you see each other move, fight and ride, fight the same enemies and bosses, and can chat with Enter. Share the page with friends from its Share menu (they need to be signed in to claude.ai). Loot and quests stay your own; kills count for everyone nearby.';
      this._lists(net);
      return;
    }
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
      : `Enemies and roaming bosses are shared: one game hosts them, everyone's blows land.${this._host(net)}`;
    if (net.online) this.$('.net-status').textContent += this._host(net);
    this._lists(net);
  }

  _host(net) {
    if (!net.hostKey) return '';
    return net.coop.host ? ' Your game is hosting the shared enemies.' : ` ${net.hostName || 'Another player'}'s game is hosting the shared enemies.`;
  }

  _lists(net) {
    const who = [...net.ghosts.entries()].map(([key, g]) => `<li>${esc(g.name)}${g.model.root.visible ? ` <button class="btn net-go-to" data-key="${esc(key)}">Go to them</button>` : ''}</li>`);
    if (net.online) who.unshift(`<li class="self">${esc(net.name)} (you)</li>`);
    this.$('.net-who').innerHTML = who.join('') || '<li class="none">Nobody</li>';
    this.$('.net-log').innerHTML = net.chatLog.slice(-12).map((l) => `<div class="${l.self ? 'self' : ''}"><b>${esc(l.name)}</b> ${esc(l.text)}</div>`).join('') || '<div class="none">No messages yet.</div>';
  }
}
