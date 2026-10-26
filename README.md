# SILENT BID

A multiplayer social-deduction bidding game. Masked operatives, caught by
a black-market syndicate called **The Broker**, must acquire specific items
to earn freedom.

**Aesthetic:** dark-mode, deep charcoal greys, oxidized-metal feel, with
crimson, cyan and electric-gold accents — like Skribbl.io, but underground.

> GitHub repo name note: GitHub repository names cannot contain spaces, so
> this project is published as **`silentbid`** at
> https://github.com/WaifooCult/silentbid.

## How to run (local multiplayer)

```bash
npm install
npm start
# Open http://localhost:8080 in 2–10 browser windows/tabs.
# Phaser 2D version: open http://localhost:8080/phaser/
```

One tab creates a room (private code, or public), the others join with the
code or via Find Random Room. The host sets the player limit and clicks
**Initialize Operation (Start)**.

No build step, no database, no accounts. Game state lives in memory on the
server while it runs — restart the server and rooms are gone.

## Checking it online (Vercel? Render?)

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full answer. In short: Vercel
alone cannot run this persistent WebSocket server, so use **Render** for
the full game (free tier, `render.yaml` is included), or run it locally.
Vercel can host only the static client, and then only as a UI preview —
point it at a Render server with `?ws=wss://<render-host>` to play.

## The game loop

### Start page & lobby — 2D auction-room theme
- **Start page (2D game feel):** a flat 2D auction-room scene — boss
  logo at the top (black silhouette of The Broker with his auction hammer
  behind the crimson SILENT BID words), "TRUST / LIE / BID / SURVIVE" and
  "AUCTION BEGINS" posters at the sides, and a wooden table strip at the
  bottom with coins and photo cards. The dark charcoal + crimson/cyan/gold
  theme from the original design is kept.
- **Order on the start page:** Enter your name is ABOVE the avatar box,
  then the avatar, then big red **PLAY!**, then a room-code input, then
  **CREATE ROOM** and **JOIN ROOM** side by side.
- **Avatar setup — a new style, not skribbl's:** a flat 2D operative
  drawn as one layered SVG — angular hood, visor face with TWO eyes, jaw
  and shoulders — not the skribbl pixel blob with one big eye. Cycle eyes
  (6), mask (5) and colour (8) with `<` / `>` arrows flanking a red-framed
  avatar box, plus a dice Random button and a mask toggle on the right.
  The preview is **masked by default** — the masked version is what you
  see in the lobby and when bidding — with a toggle to see the unmasked
  version.
- **Glowing corner elements:** the Rules book (bottom-left) and the
  hammer on its POWER block (bottom-right) sit on the table strip. Both
  have a padded hover area, so moving the cursor *around* them makes them
  glow (gold for the book, red for the hammer) and scale up slightly.
  Clicking the book opens the Rules Diary. Clicking the hammer strikes
  (gavel animation) and plays — it finds a public room, like Play!.
- **Rules Diary book:** clicking the book opens a book overlay. Pages
  flip UP for next and DOWN for previous, with a page number. It explains
  the game in simple, plain terms only — goal, draft, talk, silent bid,
  reveal, ties, money, winning — with no advanced definitions.
- **No ladder display:** avatar cards never show a wallet or a "won"
  count. Your wallet is shown only in the bidding box, where you need it
  to choose a bid. This is a single operation, not a climb to a new league.
- `[CREATE PRIVATE ROOM]` generates a `CODE-XXXX` private room.
- `[FIND RANDOM ROOM]` searches the public queue and **never creates a
  room if it is empty**.
- Host-only waiting-room settings: Public/Private toggle, player-limit
  slider (2–10), `[INITIALIZE OPERATION (START)]`.

### Dynamic scaling — set at Start, from actual players
Scaling is determined when the host clicks Start, from the number of
players actually connected — not the room limit.

| Players | Items to win | Starting wallet | Minimum bid | Increment |
|---|---:|---:|---:|---:|
| 2 | 7 | ₹15,000 | ₹100 | ₹100 |
| 3–4 | 5 | ₹12,000 | ₹200 | ₹200 |
| 5–7 | 4 | ₹10,000 | ₹200 | ₹200 |
| 8–10 | 3 | ₹8,000 | ₹200 | ₹200 |

### Phase 1: The Draft (60s)
A 5×5 board of **25 common items** (Candle, Knife, Wine Glass, Gold Bar,
Notebook, Flashlight, Hammer, Key, Hourglass, Wallet, and more). Each
player secretly selects **10 target items**. Targets are secret: the server
only ever sends a player their own list — other players see a count, never
the items.

### Rounds 1–25 — one item per round
1. **Unmasked Discussion (3 min).** Masks come off the avatars, revealing
   the lower face/expression. A vague hint is shown (e.g. *"A simple object
   that emits light"* — which could be Candle, Flashlight, or Lantern).
   Players discuss, bluff, or form alliances in text chat. `[END DISCUSSION]`
   ends the phase early if **all** players click it, or if **all but one**
   click it.
2. **Silent Bidding (60s).** Red alert, masks animate back on, chat is
   muted **server-side** (messages sent now are rejected, not just hidden).
   Each player submits one secret blind bid in a `₹_____` field, on the
   round's minimum and increment, and within their wallet.
3. **The Reveal & Clash (15s).** The true item is revealed and all blind
   bids are shown side by side, with the winner highlighted.

### Tie-breaker escalation
1. Highest unique bid wins and pays their bid.
2. **High-bid tie:** the item defaults to the **lowest bidder**
   (minimum bid must be met).
3. **Low-bid tie (double tie):** the item defaults to the
   **second-highest bidder**.
4. **Total deadlock:** if the second-highest bid is also tied, the item is
   **destroyed** — no one gets it, cash is returned.

Example from the design: Ghost ₹1500 (Tie), Viper ₹1500 (Tie),
Shadow ₹200 → **Shadow wins** under rule 2.

The first player to reach their win threshold wins the operation.
Otherwise the game ends after round 25.

## Phaser 2D version (built from phaser-core)

`phaser/` is a full Phaser 4.2 version of the same game, built from the
skills.sh skill `gamedev-skills/awesome-gamedev-agent-skills@phaser-core`
(no API key, repo ~4.4 MB, installed with
`npx skills add gamedev-skills/awesome-gamedev-agent-skills --skill phaser-core -y`).
It uses the same server and the same `game-logic.js` — Phaser only renders:
Setup, Rules Diary (page-flip overlay), Lobby, Draft, Game
(discussion / silent bidding / reveal) and Ended scenes, with the boss
silhouette, posters, table, glowing Rules book and POWER hammer, and
masks that **slide** on and off with a Phaser tween instead of swapping
instantly. Play Again on the ended screen starts a new operation.
The classic DOM client in `client/` still works as a fallback.

No other skills were needed for this build: Phaser has no physics or
movement in Silent Bid, so `phaser-arcade-physics` was not used. If
physics is ever added, its command (same small repo) is:
`npx skills add gamedev-skills/awesome-gamedev-agent-skills --skill phaser-arcade-physics -y`
— no zip needed for that one, it is not a large repo.

## Project layout

```
game-logic.js        Shared pure logic: scaling, 25 items + hints, tie-breaker,
                     discussion-end rule, bid validation (server + tests use this)
server/server.js     WebSocket server: rooms, host settings, timers, chat muting,
                     bids, wallets, reveal, win check. The server is authoritative.
client/
  index.html         Start page, avatar/lobby setup, draft board, auction floor
  style.css          Dark-mode charcoal + neon theme
  app.js             Client rendering + WebSocket messages (no game authority)
phaser/
  index.html         Phaser 2D page (name + room-code boxes, Phaser canvas, chat/bid boxes)
  style.css          Page layout for the Phaser version
  main.js            Phaser 4.2 scenes: Setup, Diary, Lobby, Draft, Game, Ended
tests/game-logic.test.js   node:test — scaling, all tie-breaker cases, discussion, bids
```

## Tests

```bash
npm test
```

## What this version is — and is not

Implemented and tested here: lobby/rooms, avatar customization, draft,
scaling, discussion with early-end rules, server-muted silent bidding,
all four tie-breaker outcomes, wallets, win threshold, and text chat.

Not yet implemented: voice chat (text chat only in v0.1), persistent
accounts or stats, reconnect/resume after a disconnect, a hosted public
server (run it locally or deploy the `server/` yourself), and hand-drawn
vector avatar art (avatars are rendered with styled shapes/glyphs in this
version). Do not describe those as done until they land and are tested.
