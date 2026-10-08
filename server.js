#!/usr/bin/env node
// Ashen Vale multiplayer server. No dependencies: plain Node (18+).
//
//   node server.js            serves the game on http://localhost:8080 and relays players on /ws
//   PORT=3000 node server.js  another port
//
// Friends on the same network open http://<your-ip>:8080; over the internet, host this on any Node
// host (Render, Railway, Fly, a VPS...) and share that address. Everyone who opens it shares one Vale.
//
// What it does: serves the files in this folder, and relays small JSON messages between players over
// WebSocket (RFC 6455, implemented here by hand: text frames, ping/pong, close). It has no game logic
// of its own: each client simulates its own world and sends where its character is and how it's posed.
//
// Messages (JSON):
//   client -> server  { t: 'hello', name }            first message; server answers 'welcome'
//                     { t: 'state', ... }             ~15 per second; relayed to everyone else with `id`
//                     { t: 'chat', text }             relayed to everyone (including the sender) with `id`, `name`
//   server -> client  { t: 'welcome', id, peers: [{ id, name }] }
//                     { t: 'join', id, name }  { t: 'leave', id }
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MAX_PLAYERS = 16;
const MAX_FRAME = 64 * 1024;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.md': 'text/plain; charset=utf-8',
};
// Only the game's own files are served (no server code, no git folder, no dotfiles).
const SERVE = /^\/(index\.html|style\.css|src\/[\w./-]+|vendor\/[\w./-]+|README\.md)$/;

// ---------- static files ----------

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  if (!SERVE.test(url) || url.includes('..')) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
    return;
  }
  const file = path.join(ROOT, url);
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

// ---------- WebSocket ----------

let nextId = 1;
const clients = new Map(); // id -> { socket, name, buf }

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if ((req.url || '').split('?')[0] !== '/ws' || !key || req.headers.upgrade?.toLowerCase() !== 'websocket') {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    return;
  }
  if (clients.size >= MAX_PLAYERS) {
    socket.end('HTTP/1.1 503 Service Unavailable\r\n\r\n');
    return;
  }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  const c = { id: nextId++, socket, name: null, buf: Buffer.alloc(0) };
  socket.on('data', (chunk) => onData(c, chunk));
  socket.on('close', () => drop(c));
  socket.on('error', () => drop(c));
});

function frame(text, opcode = 1) {
  const data = Buffer.from(text);
  const n = data.length;
  const head = n < 126 ? Buffer.from([0x80 | opcode, n])
    : n < 65536 ? Buffer.from([0x80 | opcode, 126, n >> 8, n & 255])
      : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | opcode; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); return h; })();
  return Buffer.concat([head, data]);
}

function send(c, msg) {
  if (!c.socket.destroyed) c.socket.write(typeof msg === 'string' ? frame(msg) : frame(JSON.stringify(msg)));
}

function broadcast(msg, except = null) {
  const f = frame(JSON.stringify(msg));
  for (const c of clients.values()) if (c !== except && c.name && !c.socket.destroyed) c.socket.write(f);
}

// Parses as many whole frames as have arrived. Client frames are always masked.
function onData(c, chunk) {
  c.buf = Buffer.concat([c.buf, chunk]);
  for (;;) {
    const b = c.buf;
    if (b.length < 2) return;
    const opcode = b[0] & 0x0f, masked = b[1] & 0x80;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) {
      if (b.length < 4) return;
      len = b.readUInt16BE(2);
      off = 4;
    } else if (len === 127) {
      if (b.length < 10) return;
      len = Number(b.readBigUInt64BE(2));
      off = 10;
    }
    if (len > MAX_FRAME || !masked) return drop(c);
    if (b.length < off + 4 + len) return;
    const mask = b.subarray(off, off + 4);
    const data = Buffer.from(b.subarray(off + 4, off + 4 + len));
    for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
    c.buf = b.subarray(off + 4 + len);
    if (opcode === 8) return drop(c);
    if (opcode === 9) { c.socket.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }
    if (opcode !== 1) continue;
    let msg;
    try { msg = JSON.parse(data.toString('utf8')); } catch { continue; }
    onMessage(c, msg);
  }
}

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

function onMessage(c, m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'hello' && !c.name) {
    c.name = clean(m.name, 20) || `Wanderer ${c.id}`;
    clients.set(c.id, c);
    send(c, { t: 'welcome', id: c.id, peers: [...clients.values()].filter((o) => o !== c && o.name).map((o) => ({ id: o.id, name: o.name })) });
    broadcast({ t: 'join', id: c.id, name: c.name }, c);
    log(`${c.name} joined (${clients.size} in the Vale)`);
    return;
  }
  if (!c.name) return;
  if (m.t === 'state') {
    m.id = c.id;
    broadcast(m, c);
  } else if (m.t === 'chat') {
    const text = clean(m.text, 200);
    if (text) broadcast({ t: 'chat', id: c.id, name: c.name, text });
  }
}

function drop(c) {
  if (!clients.has(c.id)) {
    c.socket.destroy();
    return;
  }
  clients.delete(c.id);
  c.socket.destroy();
  broadcast({ t: 'leave', id: c.id });
  log(`${c.name} left (${clients.size} in the Vale)`);
}

const log = (s) => console.log(`[${new Date().toLocaleTimeString()}] ${s}`);

server.listen(PORT, () => {
  const nets = Object.values(os.networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal);
  console.log(`Ashen Vale is open on http://localhost:${PORT}`);
  for (const n of nets) console.log(`  friends on your network: http://${n.address}:${PORT}`);
});
