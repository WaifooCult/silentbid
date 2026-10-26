import { ITEMS, AVATAR_COLORS, COLOR_HEX, EYE_STYLES, MASK_TYPES } from "../game-logic.js";

const $ = (id) => document.getElementById(id);
const wsProto = location.protocol === "https:" ? "wss" : "ws";
// Split deployment: ?ws=wss://<game-server-host> lets a static frontend
// (e.g. on Vercel) connect to a game server hosted elsewhere (e.g. Render).
// Same-origin deployment needs no parameter at all.
const wsOverride = new URLSearchParams(location.search).get("ws");
const ws = new WebSocket(wsOverride || `${wsProto}://${location.host}`);
let myId = null, state = null;

const EYE_GLYPHS = { Tired: "– –", Calculating: "◐ ◑", Suspicious: "↗ ↖", Deadpan: "• •", Intense: "◉ ◉", Angry: "> <" };
const MOUTH = { Tired: "—", Calculating: "¬", Suspicious: "〰", Deadpan: "–", Intense: "▬", Angry: "⌒" };

function avatarHTML(p, masked) {
  const color = COLOR_HEX[p.color] || "#3a3f44";
  return `<div class="avatar ${masked ? "masked" : ""}">
    <div class="head" style="background:${color}">
      <div class="eyes">${EYE_GLYPHS[p.eyes] || "• •"}</div>
      ${masked
        ? `<div class="mask">${p.mask}</div>`
        : `<div class="mouth">${MOUTH[p.eyes] || "–"}</div>`}
    </div>
    <div>${escapeHtml(p.name)}${p.isHost ? " (Host)" : ""}</div>
    <div class="hint">₹${p.wallet} · ${p.won.length} won</div>
  </div>`;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function send(obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function profile() {
  return {
    name: $("nameInput").value.trim() || "Operative",
    color: $("colorInput").value, eyes: $("eyesInput").value, mask: $("maskInput").value,
  };
}
function show(id) {
  for (const panel of ["panel-setup", "panel-lobby", "panel-draft", "panel-game", "panel-ended"]) $(panel).hidden = panel !== id;
}

$("colorInput").innerHTML = AVATAR_COLORS.map((c) => `<option>${c}</option>`).join("");
$("eyesInput").innerHTML = EYE_STYLES.map((e) => `<option>${e}</option>`).join("");
$("maskInput").innerHTML = MASK_TYPES.map((m) => `<option>${m}</option>`).join("");

function renderPreview() { $("avatarPreview").innerHTML = avatarHTML({ ...profile(), wallet: 0, won: [] }, true); }
for (const id of ["colorInput", "eyesInput", "maskInput", "nameInput"]) $(id).addEventListener("input", renderPreview);
renderPreview();

$("playBtn").addEventListener("click", () => { $("roomActions").hidden = false; });
$("createBtn").addEventListener("click", () => send({ type: "create", mode: "private", playerLimit: 10, ...profile() }));
$("randomBtn").addEventListener("click", () => send({ type: "find_random", ...profile() }));
$("joinBtn").addEventListener("click", () => send({ type: "join", code: $("codeInput").value.trim(), ...profile() }));
$("limitInput").addEventListener("input", () => {
  $("limitValue").textContent = $("limitInput").value;
  send({ type: "set_settings", mode: $("modeInput").value, playerLimit: Number($("limitInput").value) });
});
$("modeInput").addEventListener("change", () => send({ type: "set_settings", mode: $("modeInput").value, playerLimit: Number($("limitInput").value) }));
$("startBtn").addEventListener("click", () => send({ type: "start" }));
$("chatSend").addEventListener("click", () => {
  const text = $("chatInput").value.trim(); if (!text) return;
  send({ type: "chat", text }); $("chatInput").value = "";
});
$("chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("chatSend").click(); });
$("endDiscussionBtn").addEventListener("click", () => send({ type: "end_discussion" }));
$("bidBtn").addEventListener("click", () => send({ type: "bid", amount: Number($("bidInput").value) }));

ws.onopen = () => { $("status").textContent = "Connected — set up your operative, then create or find a room."; };
ws.onclose = () => { $("status").textContent = "Not connected to a game server. If this page is on Vercel alone, the server is not running there — see DEPLOYMENT.md and use Render, or run it locally."; };
ws.onerror = () => { $("status").textContent = "Could not reach the game server. See DEPLOYMENT.md: Vercel alone cannot run this WebSocket server; Render (or local) can."; };
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "joined") { myId = msg.playerId; }
  if (msg.type === "error") { $("error").textContent = msg.text; return; }
  if (msg.type === "notice") { $("status").textContent = msg.text; }
  if (msg.type === "state") { state = msg.room; render(); }
};

function render() {
  if (!state) return;
  const me = state.players.find((p) => p.id === myId);
  $("roomCode").textContent = state.code ? `CODE-${state.code}` : "";
  if (state.phase === "lobby") {
    show("panel-lobby");
    $("lobbyGrid").innerHTML = state.players.map((p) => avatarHTML(p, true)).join("");
    const isHost = me && me.id === state.hostId;
    $("hostSettings").hidden = !isHost;
    $("lobbyHint").hidden = !!isHost;
    $("modeInput").value = state.mode; $("limitInput").value = state.playerLimit; $("limitValue").textContent = state.playerLimit;
  } else if (state.phase === "draft") {
    show("panel-draft");
    $("draftCount").textContent = `${state.myTargets.length}/10 selected`;
    $("draftTimer").textContent = `${state.timeLeft}s remaining`;
    $("draftGrid").innerHTML = ITEMS.map((item) => {
      const selected = state.myTargets.includes(item.name);
      return `<button class="${selected ? "selected" : ""}" data-item="${escapeHtml(item.name)}">${escapeHtml(item.name)}${selected ? " ✓" : ""}</button>`;
    }).join("");
    $("draftGrid").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => send({ type: "draft_select", item: b.dataset.item })));
  } else if (["discussion", "bidding", "reveal"].includes(state.phase)) {
    show("panel-game");
    $("panel-game").classList.toggle("silent", state.phase === "bidding");
    $("roundTitle").textContent = `Round ${state.round}/25`;
    $("gameTimer").textContent = `${state.timeLeft}s · ${state.phase.toUpperCase()}`;
    $("playerRow").innerHTML = state.players.map((p) => avatarHTML(p, state.masked)).join("");
    $("hintText").textContent = state.phase === "discussion" ? `Hint: ${state.hint}` : state.phase === "bidding" ? "Hint hidden — SILENT bidding in progress." : `The item was: ${state.reveal?.item ?? "…"}`;
    $("chatBox").hidden = state.phase === "bidding";
    $("endDiscussionBtn").hidden = state.phase !== "discussion";
    $("bidBox").hidden = state.phase !== "bidding";
    $("walletLine").textContent = me ? `Your wallet: ₹${me.wallet} · Items won: ${me.won.join(", ") || "none"} · Targets selected: ${state.myTargets.length}` : "";
    if (state.phase === "reveal" && state.reveal) {
      $("revealCard").hidden = false;
      $("revealItem").textContent = `Revealed item: ${state.reveal.item}`;
      $("revealReason").textContent = state.reveal.reason;
      $("revealBids").innerHTML = state.reveal.bids.map((b) => `<li>${escapeHtml(b.name)}: ${b.amount == null ? "no bid" : "₹" + b.amount}${b.name === state.reveal.winnerName ? " — WINNER!" : ""}</li>`).join("");
    } else $("revealCard").hidden = true;
    $("chatFeed").innerHTML = state.chat.map((c) => `<div><b>${escapeHtml(c.from)}:</b> ${escapeHtml(c.text)}</div>`).join("");
  } else if (state.phase === "ended") {
    show("panel-ended");
    $("endedText").textContent = state.winner ? `${state.winner.name} wins with: ${state.winner.won.join(", ")}` : "No player reached the win threshold — the operation ends after 25 rounds.";
  }
}
