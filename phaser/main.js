import { ITEMS, AVATAR_COLORS, COLOR_HEX, EYE_STYLES, MASK_TYPES } from "../game-logic.js";

const $ = (id) => document.getElementById(id);
const wsProto = location.protocol === "https:" ? "wss" : "ws";
const wsOverride = new URLSearchParams(location.search).get("ws");
const ws = new WebSocket(wsOverride || `${wsProto}://${location.host}`);

const Bridge = {
  myId: null, state: null, currentScene: "setup",
  sel: { color: 3, eyes: 3, mask: 0 }, previewMasked: true,
  profile() {
    return {
      name: $("nameInput").value.trim() || "Operative",
      color: AVATAR_COLORS[this.sel.color], eyes: EYE_STYLES[this.sel.eyes], mask: MASK_TYPES[this.sel.mask],
    };
  },
  send(obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); },
  showForms(kind, phase, me) {
    $("chatForm").hidden = !(kind === "game" && phase === "discussion");
    $("bidForm").hidden = !(kind === "game" && phase === "bidding");
    if (me) $("walletLine").textContent = `Your wallet: ₹${me.wallet}`;
  },
};
Bridge.showForms("setup");

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function hex(color) { return parseInt((COLOR_HEX[color] || "#3a3f44").slice(1), 16); }

function btn(scene, x, y, w, h, label, fill, cb) {
  const r = scene.add.rectangle(x, y, w, h, fill).setInteractive({ useHandCursor: true });
  const t = scene.add.text(x, y, label, { fontSize: "16px", fontFamily: "Arial Black, sans-serif", color: "#ffffff" }).setOrigin(0.5);
  r.on("pointerover", () => r.setScale(1.04));
  r.on("pointerout", () => r.setScale(1));
  r.on("pointerdown", cb);
  return { r, t };
}
function txt(scene, x, y, str, size = 16, color = "#e5e7eb", align = "center") {
  return scene.add.text(x, y, str, { fontSize: `${size}px`, fontFamily: "Arial, sans-serif", color, align, wordWrap: { width: 840 } }).setOrigin(0.5);
}
function arrowBtn(scene, x, y, label, cb) {
  const t = scene.add.text(x, y, label, { fontSize: "28px", fontFamily: "Arial Black, sans-serif", color: "#ffffff", backgroundColor: "#111827" }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  t.on("pointerdown", cb);
  return t;
}

// --- Cartoon-style 2D operative, drawn with Phaser Graphics (no image files, no API key) ---
function drawEyes(g, eyes) {
  const centres = [[-11, -8], [11, -8]];
  for (const [cx, cy] of centres) {
    if (eyes === "Tired") { g.lineStyle(3, 0xffffff, 1); g.beginPath(); g.moveTo(cx - 7, cy); g.lineTo(cx + 7, cy); g.strokePath(); continue; }
    if (eyes === "Intense") { g.fillStyle(0xffffff, 1); g.fillRect(cx - 8, cy - 2, 16, 4); g.fillStyle(0xff2d2d, 1); g.fillCircle(cx, cy, 2); continue; }
    g.fillStyle(0xffffff, 1); g.fillCircle(cx, cy, 6);
    const px = eyes === "Suspicious" ? cx + 3 : cx;
    g.fillStyle(0x111111, 1); g.fillCircle(px, cy, 2.5);
    if (eyes === "Angry") { g.lineStyle(3, 0xffffff, 1); g.beginPath(); g.moveTo(cx - 8, cy - 10); g.lineTo(cx + 8, cy - 6); g.strokePath(); }
  }
}
function drawMask(g, mask, color) {
  if (mask === "Gas Mask Lower") {
    g.fillStyle(0x2a2f2a, 1); g.fillRoundedRect(-20, 6, 40, 26, 8);
    g.fillStyle(0x555555, 1); g.fillCircle(-10, 19, 6); g.fillCircle(10, 19, 6);
  } else if (mask === "Black Cloth") {
    g.fillStyle(0x0a0a0a, 1); g.fillRect(-20, 6, 40, 26);
    g.lineStyle(1, 0x444444, 1); g.beginPath(); g.moveTo(-18, 19); g.lineTo(18, 19); g.strokePath();
  } else if (mask === "Armored Plate") {
    g.fillStyle(0x6b7280, 1); g.fillRoundedRect(-20, 6, 40, 26, 4);
    g.fillStyle(0x111111, 1); g.fillCircle(-16, 10, 2); g.fillCircle(16, 10, 2); g.fillCircle(-16, 28, 2); g.fillCircle(16, 28, 2);
  } else if (mask === "Balaclava Lower") {
    g.fillStyle(hex(color), 1); g.fillRoundedRect(-22, 2, 44, 30, 8);
    g.fillStyle(0x111111, 1); g.fillRect(-10, 19, 20, 2);
  } else {
    g.fillStyle(0x111827, 1); g.fillRoundedRect(-20, 6, 40, 26, 4);
    g.fillStyle(0x111827, 1); g.fillCircle(20, 8, 4);
  }
}
function drawAvatar(scene, x, y, scale, p, masked) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(hex(p.color), 1);
  g.fillRoundedRect(-34, 28, 68, 28, 8);
  g.fillRoundedRect(-30, -48, 60, 72, 18);
  g.fillStyle(0x000000, 0.18); g.fillRoundedRect(-30, -48, 30, 72, 18);
  g.fillStyle(0x1c1c1c, 1); g.fillRoundedRect(-20, -22, 40, 30, 8);
  drawEyes(g, p.eyes);
  if (!masked) { g.fillStyle(0xe5e7eb, 1); g.fillRect(-10, 18, 20, 3); }
  c.add(g);
  const maskG = scene.add.graphics();
  drawMask(maskG, p.mask, p.color);
  maskG.visible = masked;
  c.add(maskG);
  c.maskG = maskG; c.masked = masked;
  c.setScale(scale);
  return c;
}
function avatarWithLabel(scene, x, y, scale, p, masked) {
  const c = drawAvatar(scene, x, y, scale, p, masked);
  const name = scene.add.text(0, 62, p.name + (p.isHost ? " (Host)" : ""), { fontSize: "12px", fontFamily: "Arial, sans-serif", color: "#ffffff" }).setOrigin(0.5);
  const tag = scene.add.text(0, 78, masked ? `MASKED · ${p.mask}` : "UNMASKED", { fontSize: "11px", fontFamily: "Arial, sans-serif", color: masked ? "#ff2447" : "#22d3ee" }).setOrigin(0.5);
  c.add([name, tag]);
  return c;
}

function drawRoom(scene) {
  scene.add.rectangle(450, 320, 900, 640, 0x1d1d28);
  scene.add.rectangle(70, 320, 120, 640, 0x3a1212);
  scene.add.rectangle(830, 320, 120, 640, 0x3a1212);
  const lamp = scene.add.graphics(); lamp.fillStyle(0xf5c518, 0.15); lamp.fillCircle(450, 60, 90);
  scene.add.rectangle(110, 110, 110, 100, 0xe8dcc0);
  scene.add.rectangle(790, 110, 110, 100, 0xe8dcc0);
  txt(scene, 110, 110, "TRUST\nLIE\nBID\nSURVIVE", 14, "#111111").setOrigin(0.5);
  txt(scene, 790, 110, "AUCTION\nBEGINS", 14, "#111111").setOrigin(0.5);
  scene.add.rectangle(450, 600, 900, 80, 0x5b3a1e);
  const coin = scene.add.graphics(); coin.fillStyle(0xf5c518, 1); coin.fillCircle(250, 600, 14); coin.fillCircle(290, 600, 14);
}

const DIARY_PAGES = [
  { title: "Silent Bid", text: "A game of secrets and bids. Learn in a minute, then play." },
  { title: "Goal", text: "Get the items you need before anyone else does." },
  { title: "Draft", text: "First, pick 10 items you want. No one sees your picks." },
  { title: "Talk", text: "Each round, you get a vague hint. Talk for up to 3 minutes. Masks are off here." },
  { title: "Bid in silence", text: "Then masks go back on, chat stops, and everyone writes one secret bid in 60 seconds." },
  { title: "Reveal and ties", text: "The real item is shown, and all bids are shown too. Highest bid wins — unless two tie for highest. Then the lowest bidder wins. If the lowest is also tied, the second-highest wins. If that is tied too, the item is lost and no one pays." },
  { title: "Money and winning", text: "You start with game money. When you win an item, you pay what you bid. First player to enough items wins. No leagues, no levels, no ladder — just one operation at a time." },
];

class SetupScene extends Phaser.Scene {
  constructor() { super("setup"); }
  init() { this.built = false; }
  create() {
    this.built = true;
    drawRoom(this);
    // Boss silhouette behind the title
    const boss = this.add.graphics();
    boss.fillStyle(0x050505, 1);
    boss.fillRoundedRect(380, 70, 140, 70, 10);
    boss.fillCircle(450, 55, 32);
    boss.fillRect(400, 32, 100, 10);
    boss.fillStyle(0xff2d2d, 1); boss.fillCircle(438, 55, 5); boss.fillCircle(462, 55, 5);
    const hammer = this.add.container(540, 70); const hg = this.add.graphics();
    hg.fillStyle(0x3a1a1a, 1); hg.fillRect(-25, -15, 50, 30); hg.fillStyle(0x5b3a1e, 1); hg.fillRect(-5, 10, 10, 50);
    hammer.add(hg); hammer.rotation = 0.5;
    const t1 = this.add.text(450, 165, "SILENT", { fontSize: "52px", fontFamily: "Arial Black, sans-serif", color: "#ff2447", stroke: "#000000", strokeThickness: 6 }).setOrigin(0.5);
    const t2 = this.add.text(450, 215, "BID", { fontSize: "52px", fontFamily: "Arial Black, sans-serif", color: "#ffffff", stroke: "#000000", strokeThickness: 6 }).setOrigin(0.5);
    txt(this, 450, 245, "Enter your name in the box above the game, then choose your operative below.", 13, "#9ca3af");
    this.renderPreview();
    // Arrows: left = previous, right = next; rows are eyes, mask, colour
    const rows = [["eyes", 265], ["mask", 315], ["color", 365]];
    for (const [part, y] of rows) {
      arrowBtn(this, 315, y, "<", () => this.cycle(part, -1));
      arrowBtn(this, 585, y, ">", () => this.cycle(part, 1));
    }
    btn(this, 690, 265, 110, 40, "🎲 Random", 0x111827, () => {
      Bridge.sel.color = Math.floor(Math.random() * AVATAR_COLORS.length);
      Bridge.sel.eyes = Math.floor(Math.random() * EYE_STYLES.length);
      Bridge.sel.mask = Math.floor(Math.random() * MASK_TYPES.length);
      this.renderPreview();
    });
    this.maskBtn = btn(this, 690, 330, 110, 40, Bridge.previewMasked ? "Masked" : "Unmasked", 0x111827, () => { Bridge.previewMasked = !Bridge.previewMasked; this.renderPreview(); });
    btn(this, 450, 470, 360, 56, "▶ PLAY!", 0xe11d48, () => Bridge.send({ type: "find_random", ...Bridge.profile() }));
    btn(this, 350, 540, 160, 44, "CREATE ROOM", 0x3a1212, () => Bridge.send({ type: "create", mode: "private", playerLimit: 10, ...Bridge.profile() }));
    btn(this, 550, 540, 160, 44, "JOIN ROOM", 0x222527, () => {
      const code = $("codeInput").value.trim();
      if (!code) { $("error").textContent = "Enter a room code in the box above first, or use Create Room."; $("codeInput").focus(); return; }
      Bridge.send({ type: "join", code, ...Bridge.profile() });
    });
    // Glowing corners: book (bottom-left) and hammer (bottom-right)
    const book = btn(this, 110, 575, 110, 70, "📖 RULES", 0x2a1a12, () => { if (!this.scene.isActive("diary")) this.scene.launch("diary"); });
    book.r.on("pointerover", () => book.r.setScale(1.1));
    const ham = btn(this, 790, 575, 110, 70, "🔨 POWER", 0x6b4a1f, () => {
      this.tweens.add({ targets: ham.r, angle: -25, duration: 150, yoyo: true, onComplete: () => Bridge.send({ type: "find_random", ...Bridge.profile() }) });
    });
    ham.r.on("pointerover", () => ham.r.setScale(1.1));
  }
  cycle(part, dir) {
    const lists = { color: AVATAR_COLORS, eyes: EYE_STYLES, mask: MASK_TYPES };
    const list = lists[part];
    Bridge.sel[part] = (Bridge.sel[part] + dir + list.length) % list.length;
    this.renderPreview();
  }
  renderPreview() {
    if (this.preview) this.preview.destroy(true);
    if (this.previewLabel) this.previewLabel.destroy();
    this.preview = drawAvatar(this, 450, 315, 1.6, { ...Bridge.profile(), isHost: false }, Bridge.previewMasked);
    this.previewLabel = txt(this, 450, 415, `Eyes: ${EYE_STYLES[Bridge.sel.eyes]} · Mask: ${MASK_TYPES[Bridge.sel.mask]} · Colour: ${AVATAR_COLORS[Bridge.sel.color]}`, 14, "#e5e7eb");
    if (this.maskBtn) this.maskBtn.t.setText(Bridge.previewMasked ? "Masked" : "Unmasked");
  }
}

class DiaryScene extends Phaser.Scene {
  constructor() { super("diary"); }
  init() { this.page = 0; }
  create() {
    this.add.rectangle(450, 320, 900, 640, 0x000000, 0.7);
    this.panel = this.add.rectangle(450, 320, 620, 420, 0xe8dcc0);
    this.titleT = txt(this, 450, 160, "", 26, "#5b1f1f");
    this.bodyT = this.add.text(450, 320, "", { fontSize: "18px", fontFamily: "Arial, sans-serif", color: "#1f1a12", align: "center", wordWrap: { width: 540 } }).setOrigin(0.5);
    this.numT = txt(this, 450, 470, "", 14, "#5b1f1f");
    btn(this, 300, 520, 150, 40, "▼ Previous", 0x5b1f1f, () => { if (this.page > 0) this.flip(-1); });
    btn(this, 600, 520, 150, 40, "▲ Next", 0x5b1f1f, () => { if (this.page < DIARY_PAGES.length - 1) this.flip(1); });
    btn(this, 450, 580, 110, 36, "Close", 0x111827, () => this.scene.stop("diary"));
    this.renderPage();
  }
  renderPage() {
    const p = DIARY_PAGES[this.page];
    this.titleT.setText(p.title); this.bodyT.setText(p.text);
    this.numT.setText(`Page ${this.page + 1} / ${DIARY_PAGES.length}`);
  }
  flip(dir) {
    const y0 = this.bodyT.y;
    this.tweens.add({ targets: [this.titleT, this.bodyT], alpha: 0, duration: 200, onComplete: () => {
      this.page += dir; this.renderPage(); this.bodyT.y = y0;
      this.tweens.add({ targets: [this.titleT, this.bodyT], alpha: 1, duration: 200 });
    }});
  }
}

class LobbyScene extends Phaser.Scene {
  constructor() { super("lobby"); }
  init() { this.built = false; this.lastKey = ""; this.hostControls = null; }
  create() {
    this.built = true;
    this.add.rectangle(450, 320, 900, 640, 0x1d1d28);
    this.titleT = txt(this, 450, 40, "Waiting Room", 26, "#ffffff");
    txt(this, 450, 75, "Everyone here is shown MASKED.", 13, "#9ca3af");
    this.grid = this.add.container(0, 0);
    this.hostBox = this.add.container(0, 0);
    this.hintT = txt(this, 450, 580, "Waiting for the host to initialize the operation…", 14, "#9ca3af");
    if (this.pendingState) this.updateState(this.pendingState);
  }
  updateState(state) {
    if (!this.built) { this.pendingState = state; return; }
    const me = state.players.find((p) => p.id === Bridge.myId);
    this.titleT.setText(`Waiting Room ${state.code ? "CODE-" + state.code : ""}`);
    const key = state.players.map((p) => p.id + p.color + p.eyes + p.mask).join("|");
    if (key !== this.lastKey) {
      this.lastKey = key; this.grid.removeAll(true);
      state.players.forEach((p, i) => {
        const x = 150 + (i % 5) * 150, y = 180 + Math.floor(i / 5) * 150;
        this.grid.add(avatarWithLabel(this, x, y, 0.9, p, true));
      });
    }
    const isHost = me && me.id === state.hostId;
    this.hintT.setVisible(!isHost);
    if (isHost && !this.hostControls) {
      const modeBtn = btn(this, 300, 500, 180, 44, `Mode: ${state.mode}`, 0x111827, () => Bridge.send({ type: "set_settings", mode: state.mode === "private" ? "public" : "private", playerLimit: state.playerLimit }));
      const minusBtn = btn(this, 520, 500, 44, 44, "−", 0x111827, () => Bridge.send({ type: "set_settings", mode: state.mode, playerLimit: Math.max(2, state.playerLimit - 1) }));
      const limitT = txt(this, 580, 500, `${state.playerLimit}`, 18, "#ffffff");
      const plusBtn = btn(this, 640, 500, 44, 44, "+", 0x111827, () => Bridge.send({ type: "set_settings", mode: state.mode, playerLimit: Math.min(10, state.playerLimit + 1) }));
      const startBtn = btn(this, 450, 560, 360, 44, "[INITIALIZE OPERATION (START)]", 0x8a6d00, () => Bridge.send({ type: "start" }));
      this.hostControls = { modeBtn, limitT };
      this.hostBox.add([modeBtn.r, modeBtn.t, minusBtn.r, minusBtn.t, limitT, plusBtn.r, plusBtn.t, startBtn.r, startBtn.t]);
    }
    if (this.hostControls) {
      this.hostControls.modeBtn.t.setText(`Mode: ${state.mode}`);
      this.hostControls.limitT.setText(`${state.playerLimit}`);
    }
    Bridge.showForms("lobby");
  }
}

class DraftScene extends Phaser.Scene {
  constructor() { super("draft"); }
  init() { this.built = false; this.buttons = new Map(); }
  create() {
    this.built = true;
    this.add.rectangle(450, 320, 900, 640, 0x1d1d28);
    this.titleT = txt(this, 450, 35, "Phase 1: The Draft Board", 24, "#ffffff");
    txt(this, 450, 65, "Pick 10 items you want. No one else can see your picks.", 13, "#9ca3af");
    ITEMS.forEach((item, i) => {
      const col = i % 5, row = Math.floor(i / 5);
      const x = 110 + col * 170, y = 120 + row * 95;
      const r = this.add.rectangle(x, y, 150, 75, 0x222527).setInteractive({ useHandCursor: true });
      const t = this.add.text(x, y, item.name, { fontSize: "14px", fontFamily: "Arial, sans-serif", color: "#ffffff", align: "center", wordWrap: { width: 130 } }).setOrigin(0.5);
      r.on("pointerdown", () => Bridge.send({ type: "draft_select", item: item.name }));
      this.buttons.set(item.name, { r, t });
    });
    if (this.pendingState) this.updateState(this.pendingState);
  }
  updateState(state) {
    if (!this.built) { this.pendingState = state; return; }
    this.titleT.setText(`Phase 1: The Draft Board — ${state.myTargets.length}/10 selected · ${state.timeLeft}s`);
    for (const [name, b] of this.buttons) {
      const sel = state.myTargets.includes(name);
      b.r.setFillStyle(sel ? 0x8a6d00 : 0x222527);
      b.t.setText(sel ? `${name} ✓` : name);
    }
    Bridge.showForms("draft");
  }
}

class GameScene extends Phaser.Scene {
  constructor() { super("game"); }
  init() { this.built = false; this.lastKey = ""; this.lastMasked = null; this.avatars = []; }
  create() {
    this.built = true;
    this.add.rectangle(450, 320, 900, 640, 0x1d1d28);
    this.roundT = txt(this, 450, 30, "Round", 22, "#ffffff");
    this.maskT = txt(this, 450, 60, "", 13, "#9ca3af");
    this.hintT = this.add.text(450, 340, "", { fontSize: "16px", fontFamily: "Arial, sans-serif", color: "#f5c518", align: "center", wordWrap: { width: 840 } }).setOrigin(0.5);
    this.revealT = this.add.text(450, 400, "", { fontSize: "15px", fontFamily: "Arial, sans-serif", color: "#ffffff", align: "center", wordWrap: { width: 840 } }).setOrigin(0.5);
    this.chatT = this.add.text(450, 480, "", { fontSize: "13px", fontFamily: "Arial, sans-serif", color: "#e5e7eb", align: "center", wordWrap: { width: 840 } }).setOrigin(0.5);
    this.endBtn = btn(this, 450, 570, 220, 40, "[END DISCUSSION]", 0x7f1d2d, () => Bridge.send({ type: "end_discussion" }));
    this.rulesBtn = btn(this, 800, 30, 110, 36, "Rules Diary", 0x111827, () => { if (!this.scene.isActive("diary")) this.scene.launch("diary"); });
    this.avatarRow = this.add.container(0, 0);
    if (this.pendingState) this.updateState(this.pendingState);
  }
  updateState(state) {
    if (!this.built) { this.pendingState = state; return; }
    const me = state.players.find((p) => p.id === Bridge.myId);
    this.roundT.setText(`Round ${state.round}/25 · ${state.phase.toUpperCase()} · ${state.timeLeft}s`);
    this.maskT.setText(state.masked ? "MASKED — masks are on, chat is off." : "UNMASKED — masks are off, you can talk.");
    if (state.phase === "discussion") this.hintT.setText(`Hint: ${state.hint}`);
    else if (state.phase === "bidding") this.hintT.setText("Hint hidden — SILENT bidding in progress.");
    else this.hintT.setText(state.reveal ? `The item was: ${state.reveal.item}` : "");
    if (state.phase === "reveal" && state.reveal) {
      const bids = state.reveal.bids.map((b) => `${b.name}: ${b.amount == null ? "no bid" : "₹" + b.amount}${b.name === state.reveal.winnerName ? " — WINNER!" : ""}`).join("  ·  ");
      this.revealT.setText(`${state.reveal.item} — ${state.reveal.reason}\n${bids}`);
    } else this.revealT.setText("");
    this.chatT.setText(state.chat.slice(-6).map((c) => `${c.from}: ${c.text}`).join("\n"));
    this.endBtn.r.setVisible(state.phase === "discussion");
    this.endBtn.t.setVisible(state.phase === "discussion");
    const key = state.players.map((p) => p.id + p.color + p.eyes + p.mask).join("|");
    if (key !== this.lastKey) {
      this.lastKey = key; this.avatarRow.removeAll(true); this.avatars = [];
      state.players.forEach((p, i) => {
        const x = 110 + (i % 5) * 170, y = 150 + Math.floor(i / 5) * 130;
        const av = avatarWithLabel(this, x, y, 0.7, p, state.masked);
        this.avatarRow.add(av); this.avatars.push(av);
      });
      this.lastMasked = state.masked;
    } else if (this.lastMasked !== state.masked) {
      // Mask SLIDES on/off (Phaser tween), instead of instantly swapping.
      for (const av of this.avatars) {
        if (state.masked) { av.maskG.visible = true; av.maskG.y = -26; this.tweens.add({ targets: av.maskG, y: 0, duration: 400, ease: "power2.out" }); }
        else { this.tweens.add({ targets: av.maskG, y: -26, duration: 400, ease: "power2.in", onComplete: () => { av.maskG.visible = false; av.maskG.y = 0; } }); }
      }
      this.lastMasked = state.masked;
    }
    Bridge.showForms("game", state.phase, me);
  }
}

class EndedScene extends Phaser.Scene {
  constructor() { super("ended"); }
  init() { this.built = false; }
  create() {
    this.built = true;
    this.add.rectangle(450, 320, 900, 640, 0x1d1d28);
    txt(this, 450, 200, "Operation complete", 30, "#ffffff");
    const s = Bridge.state;
    txt(this, 450, 260, s && s.winner ? `${s.winner.name} wins the operation!` : "No player reached the win threshold — the operation ends after 25 rounds.", 18, "#f5c518");
    txt(this, 450, 320, "No ladder, no league — just one operation at a time.", 14, "#9ca3af");
    btn(this, 450, 400, 260, 52, "PLAY AGAIN", 0xe11d48, () => window.location.reload());
    Bridge.showForms("ended");
    if (this.pendingState) this.pendingState = null;
  }
}

// --- WebSocket bridge: same server, same rules; Phaser only renders ---
function switchScene(state) {
  const map = { lobby: "lobby", draft: "draft", discussion: "game", bidding: "game", reveal: "game", ended: "ended" };
  const key = map[state.phase];
  if (!key) return;
  if (Bridge.currentScene !== key) {
    Bridge.currentScene = key;
    game.scene.start(key, { state });
    // The new scene's create() will pick up pendingState via updateState below.
    setTimeout(() => { const sc = game.scene.getScene(key); if (sc && sc.updateState) sc.updateState(state); }, 50);
  } else {
    const sc = game.scene.getScene(key);
    if (sc && sc.updateState) sc.updateState(state);
  }
}
ws.onopen = () => { $("status").textContent = "Connected — set up your operative, then create or find a room."; };
ws.onclose = () => { $("status").textContent = "Not connected to a game server. If this page is on Vercel alone, the server is not running there — use Render, or run it locally."; };
ws.onerror = () => { $("status").textContent = "Could not reach the game server."; };
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "joined") { Bridge.myId = msg.playerId; }
  if (msg.type === "error") { $("error").textContent = msg.text; return; }
  if (msg.type === "notice") { $("status").textContent = msg.text; }
  if (msg.type === "state") { Bridge.state = msg.room; switchScene(msg.room); }
};

$("chatSend").addEventListener("click", () => {
  const text = $("chatInput").value.trim(); if (!text) return;
  Bridge.send({ type: "chat", text }); $("chatInput").value = "";
});
$("chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("chatSend").click(); });
$("bidSend").addEventListener("click", () => Bridge.send({ type: "bid", amount: Number($("bidInput").value) }));
$("nameInput").addEventListener("input", () => { /* profile is read live from the input */ });

// Phaser 4 config, per phaser-core: AUTO renderer, FIT scale, scenes in order.
const config = {
  type: Phaser.AUTO,
  width: 900, height: 640,
  backgroundColor: "#1d1d28",
  parent: "gameContainer",
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [SetupScene, DiaryScene, LobbyScene, DraftScene, GameScene, EndedScene],
};
const game = new Phaser.Game(config);
