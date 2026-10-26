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

// Avatar selector state — cycled with < > arrows, like skribbl.io.
const sel = { color: 3, eyes: 3, mask: 0 }; // Charcoal, Deadpan, Bandana
let previewMasked = true; // Masked versions are shown by default.

function avatarHTML(p, masked) {
  const color = COLOR_HEX[p.color] || "#3a3f44";
  return `<div class="avatar ${masked ? "masked" : ""}">
    <div class="head" style="background:${color}">
      <div class="eyes">${EYE_GLYPHS[p.eyes] || "• •"}</div>
      ${masked
        ? `<div class="mask">${escapeHtml(p.mask)}</div>`
        : `<div class="mouth">${MOUTH[p.eyes] || "–"}</div>`}
    </div>
    <div>${escapeHtml(p.name)}${p.isHost ? " (Host)" : ""}</div>
    ${masked
      ? `<div class="mask-tag">MASKED</div><div class="mask-name">${escapeHtml(p.mask)}</div>`
      : `<div class="mask-tag" style="color:#22d3ee">UNMASKED</div>`}
  </div>`;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function send(obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function profile() {
  return {
    name: $("nameInput").value.trim() || "Operative",
    color: AVATAR_COLORS[sel.color], eyes: EYE_STYLES[sel.eyes], mask: MASK_TYPES[sel.mask],
  };
}
function show(id) {
  for (const panel of ["panel-setup", "panel-lobby", "panel-draft", "panel-game", "panel-ended"]) $(panel).hidden = panel !== id;
}

function renderPreview() {
  $("eyesValue").textContent = EYE_STYLES[sel.eyes];
  $("maskValue").textContent = MASK_TYPES[sel.mask];
  $("colorValue").textContent = AVATAR_COLORS[sel.color];
  $("avatarPreview").innerHTML = avatarHTML({ ...profile(), isHost: false }, previewMasked);
  $("maskToggleBtn").textContent = previewMasked ? "Show unmasked version" : "Show masked version";
  $("maskNote").textContent = previewMasked
    ? "Preview is masked — this is how you look when bidding."
    : "Preview is unmasked — this is how you look when talking.";
}
function cycle(part, dir) {
  const lists = { color: AVATAR_COLORS, eyes: EYE_STYLES, mask: MASK_TYPES };
  const list = lists[part];
  sel[part] = (sel[part] + dir + list.length) % list.length;
  renderPreview();
}
document.querySelectorAll(".arrow-btn").forEach((btn) => {
  btn.addEventListener("click", () => cycle(btn.dataset.cycle, Number(btn.dataset.dir)));
});
$("randomAvatarBtn").addEventListener("click", () => {
  sel.color = Math.floor(Math.random() * AVATAR_COLORS.length);
  sel.eyes = Math.floor(Math.random() * EYE_STYLES.length);
  sel.mask = Math.floor(Math.random() * MASK_TYPES.length);
  renderPreview();
});
$("maskToggleBtn").addEventListener("click", () => { previewMasked = !previewMasked; renderPreview(); });
$("nameInput").addEventListener("input", renderPreview);
renderPreview();

// Rules Diary toggle (visible on the start page, closable anywhere).
$("rulesToggleBtn").addEventListener("click", () => { $("rulesDiary").hidden = !$("rulesDiary").hidden; });
$("rulesCloseBtn").addEventListener("click", () => { $("rulesDiary").hidden = true; });

$("playBtn").addEventListener("click", () => send({ type: "find_random", ...profile() }));
$("createBtn").addEventListener("click", () => send({ type: "create", mode: "private", playerLimit: 10, ...profile() }));
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
    // Lobby avatars are always masked — the masked versions are the point.
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
    $("maskStateLine").textContent = state.masked
      ? "MASKED — masks are on, chat is off."
      : "UNMASKED — masks are off, you can talk.";
    $("playerRow").innerHTML = state.players.map((p) => avatarHTML(p, state.masked)).join("");
    $("hintText").textContent = state.phase === "discussion" ? `Hint: ${state.hint}` : state.phase === "bidding" ? "Hint hidden — SILENT bidding in progress." : `The item was: ${state.reveal?.item ?? "…"}`;
    $("chatBox").hidden = state.phase === "bidding";
    $("endDiscussionBtn").hidden = state.phase !== "discussion";
    $("bidBox").hidden = state.phase !== "bidding";
    // Wallet is shown only here, for your own bidding — never as a
    // score / ladder on avatar cards.
    $("walletLine").textContent = me ? `Your wallet: ₹${me.wallet}` : "";
    if (state.phase === "reveal" && state.reveal) {
      $("revealCard").hidden = false;
      $("revealItem").textContent = `Revealed item: ${state.reveal.item}`;
      $("revealReason").textContent = state.reveal.reason;
      $("revealBids").innerHTML = state.reveal.bids.map((b) => `<li>${escapeHtml(b.name)}: ${b.amount == null ? "no bid" : "₹" + b.amount}${b.name === state.reveal.winnerName ? " — WINNER!" : ""}</li>`).join("");
    } else $("revealCard").hidden = true;
    $("chatFeed").innerHTML = state.chat.map((c) => `<div><b>${escapeHtml(c.from)}:</b> ${escapeHtml(c.text)}</div>`).join("");
  } else if (state.phase === "ended") {
    show("panel-ended");
    $("endedText").textContent = state.winner ? `${state.winner.name} wins the operation!` : "No player reached the win threshold — the operation ends after 25 rounds.";
  }
}
