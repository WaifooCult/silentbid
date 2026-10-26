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

### Start page & lobby
- **Avatar setup first:** display name (sanitized), base color (8 muted
  colors), eyes/expression (6: Tired, Calculating, Suspicious, Deadpan,
  Intense, Angry), and mask type (5 lower-face masks: Bandana, Gas Mask
  Lower, Black Cloth, Armored Plate, Balaclava Lower).
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
