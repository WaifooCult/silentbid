import { ITEMS, AVATAR_COLORS, COLOR_HEX, EYE_STYLES, MASK_TYPES, scalingFor } from "../game-logic.js";

const $ = (id) => document.getElementById(id);
const wsProto = location.protocol === "https:" ? "wss" : "ws";
// Split deployment: ?ws=wss://<game-server-host> lets a static frontend
// (e.g. on Vercel) connect to a game server hosted elsewhere (e.g. Render).
// Same-origin deployment needs no parameter at all.
const wsOverride = new URLSearchParams(location.search).get("ws");
const ws = new WebSocket(wsOverride || `${wsProto}://${location.host}`);
let myId = null, state = null;

/**
 * NEW avatar style — flat 2D operative, deliberately NOT the skribbl pixel
 * blob (one big eye, pixel body). This one is an angular hood + visor face
 * with TWO eyes, a jaw, and shoulders, drawn as one layered SVG so it
 * stays sharp at any size and needs no image files.
 */
function eyesSVG(eyes) {
  // Eye centres: left (52, 56), right (68, 56).
  switch (eyes) {
    case "Tired":
      return `<line x1="45" y1="56" x2="59" y2="56" stroke="#fff" stroke-width="3"/><line x1="61" y1="56" x2="75" y2="56" stroke="#fff" stroke-width="3"/>`;
    case "Calculating":
      return `<ellipse cx="52" cy="56" rx="7" ry="4" fill="#fff" transform="rotate(-18 52 56)"/><ellipse cx="68" cy="56" rx="7" ry="4" fill="#fff" transform="rotate(-18 68 56)"/><circle cx="54" cy="56" r="2" fill="#111"/><circle cx="70" cy="56" r="2" fill="#111"/>`;
    case "Suspicious":
      return `<circle cx="52" cy="56" r="6" fill="#fff"/><circle cx="68" cy="56" r="6" fill="#fff"/><circle cx="55" cy="56" r="2.5" fill="#111"/><circle cx="71" cy="56" r="2.5" fill="#111"/>`;
    case "Intense":
      return `<rect x="44" y="53" width="16" height="4" fill="#fff"/><rect x="60" y="53" width="16" height="4" fill="#fff"/><circle cx="52" cy="55" r="1.8" fill="#ff2d2d"/><circle cx="68" cy="55" r="1.8" fill="#ff2d2d"/>`;
    case "Angry":
      return `<line x1="44" y1="50" x2="60" y2="54" stroke="#fff" stroke-width="3"/><line x1="76" y1="50" x2="60" y2="54" stroke="#fff" stroke-width="3"/><circle cx="52" cy="58" r="4" fill="#fff"/><circle cx="68" cy="58" r="4" fill="#fff"/><circle cx="52" cy="58" r="1.8" fill="#111"/><circle cx="68" cy="58" r="1.8" fill="#111"/>`;
    case "Deadpan":
    default:
      return `<circle cx="52" cy="56" r="5" fill="#fff"/><circle cx="68" cy="56" r="5" fill="#fff"/><circle cx="52" cy="56" r="2" fill="#111"/><circle cx="68" cy="56" r="2" fill="#111"/>`;
  }
}

function mouthSVG(eyes) {
  switch (eyes) {
    case "Calculating": return `<path d="M50 84 Q60 88 70 82" stroke="#e5e7eb" stroke-width="2.5" fill="none"/>`;
    case "Suspicious": return `<path d="M50 84 Q55 81 60 84 Q65 87 70 84" stroke="#e5e7eb" stroke-width="2.5" fill="none"/>`;
    case "Intense": return `<rect x="50" y="82" width="20" height="3" fill="#e5e7eb"/>`;
    case "Angry": return `<path d="M50 88 Q60 80 70 88" stroke="#e5e7eb" stroke-width="2.5" fill="none"/>`;
    case "Tired":
    case "Deadpan":
    default: return `<line x1="52" y1="84" x2="68" y2="84" stroke="#e5e7eb" stroke-width="2.5"/>`;
  }
}

function maskSVG(mask, color) {
  switch (mask) {
    case "Gas Mask Lower":
      return `<rect x="40" y="66" width="40" height="26" rx="8" fill="#2a2f2a" stroke="#000" stroke-width="2"/><circle cx="50" cy="80" r="6" fill="#555" stroke="#000"/><circle cx="70" cy="80" r="6" fill="#555" stroke="#000"/>`;
    case "Black Cloth":
      return `<rect x="40" y="66" width="40" height="26" fill="#0a0a0a" stroke="#222" stroke-width="1.5"/><line x1="42" y1="79" x2="78" y2="79" stroke="#444" stroke-width="1" stroke-dasharray="4 3"/>`;
    case "Armored Plate":
      return `<rect x="40" y="66" width="40" height="26" rx="4" fill="#6b7280" stroke="#111" stroke-width="2"/><circle cx="44" cy="70" r="1.8" fill="#111"/><circle cx="76" cy="70" r="1.8" fill="#111"/><circle cx="44" cy="88" r="1.8" fill="#111"/><circle cx="76" cy="88" r="1.8" fill="#111"/>`;
    case "Balaclava Lower":
      return `<path d="M38 60 Q60 52 82 60 L82 92 L38 92 Z" fill="${color}" stroke="#000" stroke-width="2"/><line x1="52" y1="84" x2="68" y2="84" stroke="#000" stroke-width="2"/>`;
    case "Bandana":
    default:
      return `<path d="M40 68 L80 68 L78 92 L42 92 Z" fill="#111827" stroke="#000" stroke-width="2"/><circle cx="82" cy="70" r="4" fill="#111827" stroke="#000"/><line x1="44" y1="76" x2="76" y2="76" stroke="#374151" stroke-width="1.5"/>`;
  }
}

function avatarSVG(p, masked) {
  const color = COLOR_HEX[p.color] || "#3a3f44";
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(p.name)} avatar">
    <path d="M18 120 L34 94 Q60 86 86 94 L102 120 Z" fill="${color}" stroke="#000" stroke-width="2"/>
    <path d="M28 92 Q28 22 60 22 Q92 22 92 92 Z" fill="${color}" stroke="#000" stroke-width="2"/>
    <path d="M28 92 Q28 22 60 22 L60 92 Z" fill="#000" opacity="0.18"/>
    <path d="M36 40 Q60 28 84 40" stroke="#fff" stroke-width="2" fill="none" opacity="0.25"/>
    <rect x="42" y="42" width="36" height="28" rx="8" fill="#1c1c1c"/>
    ${eyesSVG(p.eyes)}
    ${masked ? `<g class="mask-layer">${maskSVG(p.mask, color)}</g>` : mouthSVG(p.eyes)}
  </svg>`;
}

function avatarHTML(p, masked) {
  return `<div class="avatar ${masked ? "masked" : ""}">
    ${avatarSVG(p, masked)}
    <div>${escapeHtml(p.name)}${p.isHost ? " (Host)" : ""}</div>
    ${masked
      ? `<div class="mask-tag">MASKED</div><div class="mask-name">${escapeHtml(p.mask)}</div>`
      : `<div class="mask-tag" style="color:#22d3ee">UNMASKED</div>`}
  </div>`;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function send(obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }

// --- Gamified layer: dust particles, mouse spotlight, screen shake ---
for (let i = 0; i < 24; i++) {
  const p = document.createElement("span");
  p.className = "particle";
  p.style.left = `${Math.random() * 100}%`;
  p.style.animationDuration = `${9 + Math.random() * 12}s`;
  p.style.animationDelay = `${Math.random() * 12}s`;
  $("particles").appendChild(p);
}
document.addEventListener("mousemove", (e) => {
  document.body.style.setProperty("--mx", `${e.clientX}px`);
  document.body.style.setProperty("--my", `${e.clientY}px`);
});
function shake() {
  document.body.classList.add("shake");
  setTimeout(() => document.body.classList.remove("shake"), 450);
}
let soundOn = localStorage.getItem("silentbid-sound") !== "off";
let audioCtx = null;
function tone(freq, dur, type = "sine", gain = 0.08, when = 0) {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime + when;
    const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(audioCtx.destination); osc.start(t); osc.stop(t + dur);
  } catch { /* sound is optional; the game works without it */ }
}
function playClick() { tone(600, 0.07, "square", 0.03); }
function playGavel() { tone(90, 0.25, "sine", 0.15); tone(55, 0.3, "triangle", 0.1, 0.02); }
function playReveal() { tone(520, 0.15, "sine", 0.06); tone(780, 0.2, "sine", 0.06, 0.12); }
function playWin() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, "sine", 0.07, i * 0.14)); }
function renderSoundBtn() { $("soundToggleBtn").textContent = soundOn ? "🔊 Sound: ON" : "🔇 Sound: OFF"; }
$("soundToggleBtn").addEventListener("click", () => {
  soundOn = !soundOn; localStorage.setItem("silentbid-sound", soundOn ? "on" : "off");
  renderSoundBtn(); if (soundOn) playClick();
});
renderSoundBtn();
document.addEventListener("click", (e) => { if (e.target.closest("button")) playClick(); });

// Avatar selector state — cycled with < > arrows.
const sel = { color: 3, eyes: 3, mask: 0 }; // Charcoal, Deadpan, Bandana
let previewMasked = true; // Masked versions are shown by default.

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
  // The preview frame shows ONLY the SVG avatar — no name, wallet, or count.
  $("avatarPreview").innerHTML = avatarSVG({ ...profile(), isHost: false }, previewMasked);
  $("maskToggleLabel").textContent = previewMasked ? "Masked" : "Unmasked";
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

// --- Rules Diary book: pages flip UP for next, DOWN for previous ---
const DIARY_PAGES = [
  { title: "Silent Bid", text: "A game of secrets and bids. Open the book, learn in a minute, then play." },
  { title: "Goal", text: "Get the items you need before anyone else does." },
  { title: "Draft", text: "First, pick 10 items you want. No one sees your picks." },
  { title: "Talk", text: "Each round, you get a vague hint. Talk for up to 3 minutes. Masks are off here, so you can see faces." },
  { title: "Bid in silence", text: "Then masks go back on, chat stops, and everyone writes one secret bid in 60 seconds." },
  { title: "Reveal and ties", text: "The real item is shown, and all bids are shown too. Highest bid wins — unless two people tie for highest. Then the lowest bidder wins. If the lowest is also tied, the second-highest bidder wins. If that is tied too, the item is lost and no one pays. Example: Ghost Rs 1500 (Tie), Viper Rs 1500 (Tie), Shadow Rs 200 wins." },
  { title: "Money and winning", text: "You start with game money. When you win an item, you pay what you bid. You cannot bid more than you have. First player to get enough items wins. That is all. No leagues, no levels, no ladder — just one operation at a time." },
];
let diaryPage = 0;
function renderDiaryPage() {
  const page = DIARY_PAGES[diaryPage];
  $("diaryPageTitle").textContent = page.title;
  $("diaryPageText").textContent = page.text;
  $("diaryPageNum").textContent = `Page ${diaryPage + 1} / ${DIARY_PAGES.length}`;
}
function flipDiary(dir) {
  const pageEl = $("diaryPage");
  pageEl.classList.add(dir > 0 ? "flip-up" : "flip-down");
  setTimeout(() => {
    diaryPage = Math.min(DIARY_PAGES.length - 1, Math.max(0, diaryPage + dir));
    renderDiaryPage();
    pageEl.classList.remove("flip-up", "flip-down");
  }, 260);
}
function openDiary() { diaryPage = 0; renderDiaryPage(); $("diaryBook").hidden = false; }
function closeDiary() { $("diaryBook").hidden = true; }
$("rulesToggleBtn").addEventListener("click", () => { if ($("diaryBook").hidden) openDiary(); else closeDiary(); });
$("rulesBookBtn").addEventListener("click", openDiary);
$("diaryCloseBtn").addEventListener("click", closeDiary);
$("diaryNextBtn").addEventListener("click", () => { if (diaryPage < DIARY_PAGES.length - 1) flipDiary(1); });
$("diaryPrevBtn").addEventListener("click", () => { if (diaryPage > 0) flipDiary(-1); });
$("diaryBook").addEventListener("click", (e) => { if (e.target === $("diaryBook")) closeDiary(); });
renderDiaryPage();

// --- Corner hammer: glows on hover (CSS), strikes on click, then plays ---
$("hammerBtn").addEventListener("click", () => {
  const btn = $("hammerBtn");
  playGavel(); shake();
  btn.classList.add("striking");
  setTimeout(() => {
    btn.classList.remove("striking");
    send({ type: "find_random", ...profile() });
  }, 380);
});

$("playBtn").addEventListener("click", () => send({ type: "find_random", ...profile() }));
$("createBtn").addEventListener("click", () => send({ type: "create", mode: "private", playerLimit: 10, ...profile() }));
$("joinBtn").addEventListener("click", () => {
  const code = $("codeInput").value.trim();
  if (!code) { $("error").textContent = "Enter a room code first, or use Create Room."; $("codeInput").focus(); return; }
  send({ type: "join", code, ...profile() });
});
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

$("playAgainBtn").addEventListener("click", () => window.location.reload());

ws.onopen = () => { $("status").textContent = "Syndicate comms live"; $("status").classList.remove("offline"); };
ws.onclose = () => { $("status").textContent = "Syndicate comms standby — server not reached"; $("status").classList.add("offline"); };
ws.onerror = () => { $("status").textContent = "Syndicate comms standby — server not reached"; $("status").classList.add("offline"); };
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "joined") { myId = msg.playerId; }
  if (msg.type === "error") { $("error").textContent = msg.text; return; }
  if (msg.type === "notice") { $("status").textContent = msg.text; }
  if (msg.type === "state") { state = msg.room; render(); }
};

let lastPhase = null;
function render() {
  if (!state) return;
  // Finished-product theme: cartoony at the start, darker and more ominous
  // as the operation goes on — and darkest of all during silent bidding.
  let ominous = 0;
  if (["discussion", "bidding", "reveal"].includes(state.phase)) {
    ominous = state.round <= 7 ? 1 : state.round <= 16 ? 2 : 3;
    if (state.phase === "bidding" || state.phase === "reveal") ominous = Math.max(ominous, 2);
  }
  document.body.dataset.ominous = String(ominous);
  document.body.dataset.phase = state.phase;
  if (state.phase === "reveal" && lastPhase !== "reveal") {
    playReveal(); shake();
    const conf = $("confetti");
    for (let i = 0; i < 24; i++) {
      const c = document.createElement("span");
      c.className = "coin-burst";
      c.style.left = `${20 + Math.random() * 60}%`;
      c.style.setProperty("--dx", `${(Math.random() - 0.5) * 240}px`);
      conf.appendChild(c);
      setTimeout(() => c.remove(), 1700);
    }
  }
  if (state.phase === "ended" && lastPhase !== "ended") playWin();
  lastPhase = state.phase;
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
    $("wantedTray").innerHTML = state.myTargets.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("") || `<span class="hint">Your wanted tray is empty — pick 10.</span>`;
  } else if (["discussion", "bidding", "reveal"].includes(state.phase)) {
    show("panel-game");
    $("panel-game").classList.toggle("silent", state.phase === "bidding");
    $("roundTitle").textContent = `Round ${state.round}/25`;
    $("gameTimer").textContent = `${state.timeLeft}s · ${state.phase.toUpperCase()}`;
    $("gameTimer").classList.toggle("urgent", state.timeLeft <= 10 && state.timeLeft > 0);
    if (me) {
      const need = scalingFor(state.players.length).itemsToWin;
      const pct = Math.min(100, Math.round((me.won.length / need) * 100));
      $("progressFill").style.width = `${pct}%`;
      $("progressText").textContent = `You: ${me.won.length} / ${need} items won · Wallet ₹${me.wallet}`;
    }
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
      // Winner spotlight; everyone else dims for the moment.
      $("playerRow").querySelectorAll(".avatar").forEach((el) => {
        const isWinner = state.reveal.winnerName && el.textContent.includes(state.reveal.winnerName);
        el.classList.toggle("winner", !!isWinner);
        el.classList.toggle("dim", !!state.reveal.winnerName && !isWinner);
      });
    } else $("revealCard").hidden = true;
    $("chatFeed").innerHTML = state.chat.map((c) => `<div><b>${escapeHtml(c.from)}:</b> ${escapeHtml(c.text)}</div>`).join("");
  } else if (state.phase === "ended") {
    show("panel-ended");
    $("endedText").textContent = state.winner ? `${state.winner.name} wins the operation!` : "No player reached the win threshold — the operation ends after 25 rounds.";
  }
}
