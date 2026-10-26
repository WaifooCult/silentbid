# Checking Silent Bid online — Vercel vs. a real game server

Short answer: **Vercel alone is not the right host for the full multiplayer
game, and Render is.** This is a server limitation, not a code bug.

## Why Vercel doesn't fit this game as-is

Silent Bid is a long-lived Node + WebSocket server (`server/server.js`):
it holds rooms, timers, chat muting, bids and wallets in memory and keeps
a WebSocket open for every player for the whole game.

Vercel runs serverless functions: short-lived, stateless, and without
support for a persistent WebSocket server like this one. If you import this
repo into Vercel as a Node project, the game server will not stay running,
so players will not be able to join a room or stay connected — even if the
start page loads.

Vercel *can* host the static client files (`client/`) as a website, but
only the start page / avatar UI would load. Without a game server behind
it, creating or joining a room will fail. That is useful for a UI preview
only, not for checking the actual game.

## Recommended way to check the full game: Render (free tier)

Render runs a persistent web service, which is exactly what this server
needs, and the repo already contains `render.yaml` for it.

1. Go to https://dashboard.render.com → **New + → Web Service**.
2. Choose **Build and deploy from a Git repository** → connect GitHub →
   select **WaifooCult/silentbid**.
3. Render should pick up `render.yaml` automatically. If it asks, use:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance type: Free
4. Click **Create Web Service** and wait for the deploy to go live
   (first build usually takes a couple of minutes).
5. Open the Render URL it gives you (e.g. `https://silentbid-xxxx.onrender.com`)
   in 2–10 browser tabs.
6. In one tab, create a private room and share the `CODE-XXXX` with the
   other tabs; in the others, join with that code. The host clicks
   **Initialize Operation (Start)**.

Notes:
- On Render's free tier, the service sleeps after inactivity, so the first
  load after a pause can take ~30–60 seconds. That is normal.
- Rooms live in server memory only. Restarting/redeploying the service
  clears rooms — players just create a new one.
- The client and the WebSocket server run on the **same origin** on Render,
  so no extra configuration is needed.

## Splitting frontend and backend (advanced)

If you still want the frontend on Vercel and the game server elsewhere:

1. Deploy the server to Render as above.
2. Deploy `client/` to Vercel as a static site.
3. Open the Vercel site with `?ws=wss://<your-render-host>` appended to
   the URL, e.g. `https://your-site.vercel.app/?ws=wss://silentbid-xxxx.onrender.com`
   The client reads that `ws` parameter and connects to the Render server
   instead of its own host.

Do not use `http://` for the Render URL in that parameter — browsers on
an `https://` Vercel page will block an insecure `ws://` connection.

## Checking locally (fastest, no deploy)

```bash
npm install
npm start
# Open http://localhost:8080 in 2–10 browser tabs.
```

## What to test once it's live

1. Two tabs join the same room; host starts with 2 players → wallet
   should be ₹15,000 and the win threshold 7 (see README scaling table).
2. Draft: each tab selects 10 items; the other tab must **not** see them.
3. Discussion: masks off, chat works, End Discussion with all-but-one
   clicking ends the phase.
4. Bidding: masks on, chat is rejected, a bid below the minimum is rejected.
5. Reveal: try a high-bid tie (e.g. both bid ₹1500, one bids ₹200) and
   confirm the ₹200 bidder wins.
