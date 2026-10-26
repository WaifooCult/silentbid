/**
 * Silent Bid — multiplayer server (Node + WebSocket).
 *
 * Run:  npm install && npm start        (serves the client on :8080)
 * Then open http://localhost:8080 in 2–10 browser windows/tabs.
 *
 * Authority: this server owns timers, chat muting, bids, wallets and the
 * winner. Clients only render what the server broadcasts. A bid submitted
 * after the bidding window, or a chat message during silent bidding, is
 * rejected here — not just hidden in the UI.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import {
  ITEMS, scalingFor, sanitizeName, makeRoomCode, resolveBids,
  discussionShouldEnd, isValidBid,
} from "../game-logic.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = process.env.PORT || 8080;

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let urlPath = req.url === "/" ? "/client/index.html" : req.url.split("?")[0];
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "text/plain" });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = new Map(); // code -> room
let playerSeq = 0;

function publicRoom(room, forPlayerId) {
  // Draft targets are secret: each player only ever receives their OWN list.
  // Everyone else sees only a count, so a wishlist can never be read off
  // another player's broadcast.
  const me = room.players.find((p) => p.id === forPlayerId);
  return {
    code: room.code, mode: room.mode, hostId: room.hostId, playerLimit: room.playerLimit,
    phase: room.phase, round: room.round, roundItem: room.roundItem,
    hint: room.phase === "discussion" ? room.roundItem?.hint : undefined,
    masked: room.phase === "bidding" || room.phase === "reveal",
    timeLeft: room.timeLeft, reveal: room.reveal,
    myTargets: me ? [...me.targets] : [],
    players: room.players.map((p) => ({
      id: p.id, name: p.name, color: p.color, eyes: p.eyes, mask: p.mask,
      wallet: p.wallet, won: p.won, targetCount: p.targets.length,
      isHost: p.id === room.hostId, endDiscussion: p.endDiscussion, hasBid: p.hasBid,
    })),
    winner: room.winner, chat: room.chat.slice(-50),
  };
}

function broadcast(room, msg) {
  const data = JSON.stringify(msg);
  for (const p of room.players) {
    if (p.ws.readyState === 1) p.ws.send(data);
  }
  // Also send the full state after every broadcast so clients stay in sync.
  broadcastState(room);
}

function broadcastState(room) {
  for (const p of room.players) {
    if (p.ws.readyState === 1) p.ws.send(JSON.stringify({ type: "state", room: publicRoom(room, p.id) }));
  }
}

function clearTimer(room) { if (room.timer) { clearInterval(room.timer); room.timer = null; } }

function startTimer(room, seconds, onDone) {
  clearTimer(room);
  room.timeLeft = seconds;
  room.timer = setInterval(() => {
    room.timeLeft -= 1;
    if (room.timeLeft <= 0) { clearTimer(room); onDone(); }
    else broadcastState(room);
  }, 1000);
}

function shuffledItems() {
  const items = [...ITEMS];
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function startDraft(room) {
  room.phase = "draft";
  room.round = 0;
  room.roundItems = shuffledItems();
  room.players.forEach((p) => { p.targets = []; });
  broadcast(room, { type: "notice", text: "Draft: select your 10 target items (60s)." });
  startTimer(room, 60, () => startRound(room));
}

function startRound(room) {
  if (room.round >= 25) return endGame(room);
  room.round += 1;
  room.roundItem = room.roundItems[room.round - 1];
  room.phase = "discussion";
  room.reveal = null;
  room.players.forEach((p) => { p.endDiscussion = false; p.hasBid = false; p.currentBid = null; });
  room.chat.push({ from: "Broker", text: `Round ${room.round}/25 — hint: ${room.roundItem.hint}` });
  broadcast(room, { type: "notice", text: `Round ${room.round}: discussion begins. Masks off.` });
  startTimer(room, 180, () => startBidding(room));
}

function startBidding(room) {
  room.phase = "bidding";
  broadcast(room, { type: "notice", text: "SILENT — masks on. Chat is muted. Submit your blind bid." });
  startTimer(room, 60, () => doReveal(room));
}

function doReveal(room) {
  room.phase = "reveal";
  const bids = room.players.filter((p) => p.currentBid != null).map((p) => ({ playerId: p.id, amount: p.currentBid }));
  const result = resolveBids(bids, room.scaling.minBid);
  let winnerPlayer = null;
  if (result.winnerId) {
    winnerPlayer = room.players.find((p) => p.id === result.winnerId);
    const bid = bids.find((b) => b.playerId === result.winnerId);
    winnerPlayer.wallet -= bid.amount;
    winnerPlayer.won.push(room.roundItem.name);
  }
  room.reveal = {
    item: room.roundItem.name, bids: room.players.map((p) => ({ name: p.name, amount: p.currentBid })),
    winnerName: winnerPlayer?.name ?? null, rule: result.rule, reason: result.reason,
  };
  room.winner = null;
  broadcast(room, { type: "notice", text: result.reason });
  // Check win threshold before the next round.
  const champion = room.players.find((p) => p.won.length >= room.scaling.itemsToWin);
  startTimer(room, 15, () => {
    if (champion) return endGame(room, champion);
    startRound(room);
  });
}

function endGame(room, champion) {
  room.phase = "ended";
  room.winner = champion ? { name: champion.name, won: champion.won } : null;
  broadcast(room, { type: "notice", text: champion ? `${champion.name} wins the operation!` : "All 25 rounds complete." });
  clearTimer(room);
}

function createRoom(ws, msg) {
  const code = makeRoomCode();
  const room = {
    code, mode: msg.mode === "public" ? "public" : "private", hostId: null,
    playerLimit: Math.min(10, Math.max(2, msg.playerLimit || 10)),
    phase: "lobby", players: [], chat: [], timer: null, timeLeft: 0,
    round: 0, roundItems: [], roundItem: null, reveal: null, scaling: null, winner: null,
  };
  rooms.set(code, room);
  joinRoom(ws, { ...msg, code }, room, true);
}

function joinRoom(ws, msg, existingRoom, isNew) {
  const room = existingRoom || rooms.get(String(msg.code || "").toUpperCase());
  if (!room) { ws.send(JSON.stringify({ type: "error", text: "Room not found. Check the code." })); return; }
  if (room.phase !== "lobby") { ws.send(JSON.stringify({ type: "error", text: "That operation has already started." })); return; }
  if (room.players.length >= room.playerLimit) { ws.send(JSON.stringify({ type: "error", text: "That room is full." })); return; }
  const player = {
    id: `p${++playerSeq}`, ws, name: sanitizeName(msg.name), color: msg.color || "Charcoal",
    eyes: msg.eyes || "Deadpan", mask: msg.mask || "Bandana",
    wallet: 0, won: [], targets: [], endDiscussion: false, hasBid: false, currentBid: null,
  };
  if (isNew || room.players.length === 0) room.hostId = player.id;
  room.players.push(player);
  ws._room = room; ws._player = player;
  ws.send(JSON.stringify({ type: "joined", playerId: player.id, code: room.code }));
  broadcast(room, { type: "notice", text: `${player.name} joined the operation.` });
}

function findRandom(ws, msg) {
  const open = [...rooms.values()].find((r) => r.mode === "public" && r.phase === "lobby" && r.players.length < r.playerLimit);
  if (!open) { ws.send(JSON.stringify({ type: "error", text: "No public operation is waiting right now. Create a private room instead — a random search never creates a room." })); return; }
  joinRoom(ws, msg, open, false);
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const room = ws._room; const player = ws._player;

    if (msg.type === "create") return createRoom(ws, msg);
    if (msg.type === "join") return joinRoom(ws, msg);
    if (msg.type === "find_random") return findRandom(ws, msg);
    if (!room || !player) return;

    if (msg.type === "chat") {
      if (room.phase !== "discussion") { ws.send(JSON.stringify({ type: "error", text: "Chat is muted during silent bidding." })); return; }
      room.chat.push({ from: player.name, text: String(msg.text || "").slice(0, 300) });
      return broadcastState(room);
    }
    if (msg.type === "set_settings") {
      if (player.id !== room.hostId || room.phase !== "lobby") return;
      room.mode = msg.mode === "public" ? "public" : "private";
      room.playerLimit = Math.min(10, Math.max(2, msg.playerLimit || room.playerLimit));
      return broadcastState(room);
    }
    if (msg.type === "start") {
      if (player.id !== room.hostId || room.phase !== "lobby") return;
      if (room.players.length < 2) { ws.send(JSON.stringify({ type: "error", text: "Need at least 2 players to start." })); return; }
      // Scaling is fixed HERE, from actual connected players — not the limit.
      room.scaling = scalingFor(room.players.length);
      room.players.forEach((p) => { p.wallet = room.scaling.startingWallet; });
      return startDraft(room);
    }
    if (msg.type === "draft_select") {
      if (room.phase !== "draft") return;
      const name = String(msg.item || "");
      if (!ITEMS.some((i) => i.name === name)) return;
      if (player.targets.includes(name)) player.targets = player.targets.filter((t) => t !== name);
      else if (player.targets.length < 10) player.targets.push(name);
      return broadcastState(room);
    }
    if (msg.type === "end_discussion") {
      if (room.phase !== "discussion") return;
      player.endDiscussion = true;
      if (discussionShouldEnd(room.players.filter((p) => p.endDiscussion).length, room.players.length)) {
        return startBidding(room);
      }
      return broadcastState(room);
    }
    if (msg.type === "bid") {
      if (room.phase !== "bidding") return;
      const amount = Number(msg.amount);
      if (!isValidBid(amount, room.scaling.minBid, room.scaling.increment, player.wallet)) {
        ws.send(JSON.stringify({ type: "error", text: `Invalid bid. Minimum ₹${room.scaling.minBid}, increment ₹${room.scaling.increment}, and within your wallet (₹${player.wallet}).` }));
        return;
      }
      player.currentBid = amount; player.hasBid = true;
      return broadcastState(room);
    }
  });

  ws.on("close", () => {
    const room = ws._room; const player = ws._player;
    if (!room || !player) return;
    room.players = room.players.filter((p) => p.id !== player.id);
    if (room.players.length === 0) { clearTimer(room); rooms.delete(room.code); return; }
    if (room.hostId === player.id) room.hostId = room.players[0].id;
    broadcast(room, { type: "notice", text: `${player.name} left the operation.` });
  });
});

server.listen(PORT, () => console.log(`Silent Bid server on http://localhost:${PORT} — open it in 2–10 browser tabs to play.`));
