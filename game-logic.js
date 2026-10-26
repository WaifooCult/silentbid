/**
 * Silent Bid — shared game logic.
 * Pure functions, no network, no DOM. Used by the server and by tests.
 * The browser client imports the same scaling / tie-breaker rules so the
 * UI never invents a different winner than the server.
 */

// --- Scaling matrix (determined at Start, from ACTUAL connected players) ---
export function scalingFor(playerCount) {
  if (playerCount <= 2) return { itemsToWin: 7, startingWallet: 15000, minBid: 100, increment: 100 };
  if (playerCount <= 4) return { itemsToWin: 5, startingWallet: 12000, minBid: 200, increment: 200 };
  if (playerCount <= 7) return { itemsToWin: 4, startingWallet: 10000, minBid: 200, increment: 200 };
  return { itemsToWin: 3, startingWallet: 8000, minBid: 200, increment: 200 };
}

export const ITEMS = [
  { name: "Candle", hint: "A simple object that emits light." },
  { name: "Flashlight", hint: "A simple object that emits light." },
  { name: "Lantern", hint: "A simple object that emits light." },
  { name: "Knife", hint: "A sharp tool, useful in a tight spot." },
  { name: "Wine Glass", hint: "A fragile vessel for a celebration." },
  { name: "Gold Bar", hint: "Heavy, shiny, and worth a fortune." },
  { name: "Gold Coin", hint: "Small, shiny, and worth a fortune." },
  { name: "Notebook", hint: "Paper bound together, full of secrets." },
  { name: "Book", hint: "Paper bound together, full of stories." },
  { name: "Hammer", hint: "A heavy tool for building — or breaking." },
  { name: "Key", hint: "Small, metal, and it opens something." },
  { name: "Padlock", hint: "Small, metal, and it keeps something shut." },
  { name: "Hourglass", hint: "It measures time, grain by grain." },
  { name: "Pocket Watch", hint: "It measures time, and fits in a pocket." },
  { name: "Wallet", hint: "It holds what you value most." },
  { name: "Compass", hint: "It points the way when you are lost." },
  { name: "Map", hint: "It shows the way when you are lost." },
  { name: "Rope", hint: "Long, strong, and easy to tie." },
  { name: "Chain", hint: "Long, strong links of metal." },
  { name: "Ring", hint: "A small circle worn with meaning." },
  { name: "Camera", hint: "It captures a moment forever." },
  { name: "Mirror", hint: "It shows you exactly as you are." },
  { name: "Bottle", hint: "A vessel that holds a liquid." },
  { name: "Mug", hint: "A vessel you drink from every day." },
  { name: "Matchbox", hint: "Tiny sticks that can start a fire." },
];

export const AVATAR_COLORS = ["Moss Green", "Burnt Orange", "Navy", "Charcoal", "Plum", "Teal", "Rust", "Olive"];
export const COLOR_HEX = {
  "Moss Green": "#6b8f5e", "Burnt Orange": "#c96f2e", Navy: "#2c4a7a", Charcoal: "#3a3f44",
  Plum: "#6d4a6b", Teal: "#2e7d74", Rust: "#a34a2a", Olive: "#7a7a3a",
};
export const EYE_STYLES = ["Tired", "Calculating", "Suspicious", "Deadpan", "Intense", "Angry"];
export const MASK_TYPES = ["Bandana", "Gas Mask Lower", "Black Cloth", "Armored Plate", "Balaclava Lower"];

export function sanitizeName(name) {
  return String(name ?? "").replace(/[<>]/g, "").trim().slice(0, 20) || "Operative";
}

export function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * Tie-breaker escalation (spec Part 3 §2).
 * bids: [{ playerId, amount }] — only bids >= minBid are eligible.
 * Returns { winnerId, rule, reason } or { winnerId: null, rule, reason }.
 *  - Highest unique bid wins.
 *  - High-bid tie -> lowest bidder wins.
 *  - Low-bid tie (double tie) -> second-highest bidder wins.
 *  - Second-highest also tied -> item destroyed, cash returned (no winner).
 */
export function resolveBids(bids, minBid) {
  const eligible = bids.filter((b) => Number.isFinite(b.amount) && b.amount >= minBid);
  if (eligible.length === 0) return { winnerId: null, rule: "no_eligible_bid", reason: "No bid met the minimum bid." };
  if (eligible.length === 1) return { winnerId: eligible[0].playerId, rule: "only_bid", reason: "Only one eligible bid." };

  const counts = new Map();
  for (const b of eligible) counts.set(b.amount, (counts.get(b.amount) ?? 0) + 1);
  const amountsDesc = [...counts.keys()].sort((a, b) => b - a);
  const highest = amountsDesc[0];
  const highestBidders = eligible.filter((b) => b.amount === highest);

  if (highestBidders.length === 1) {
    return { winnerId: highestBidders[0].playerId, rule: "highest_unique", reason: "Highest unique bid wins." };
  }

  // High-bid tie -> lowest bidder.
  const lowest = Math.min(...eligible.map((b) => b.amount));
  const lowestBidders = eligible.filter((b) => b.amount === lowest);
  if (lowestBidders.length === 1) {
    return { winnerId: lowestBidders[0].playerId, rule: "high_tie_lowest_wins", reason: "High-bid tie! Item defaults to lowest bidder." };
  }

  // Double tie -> second-highest bidder.
  const secondHighest = amountsDesc[1];
  const secondBidders = eligible.filter((b) => b.amount === secondHighest);
  if (secondBidders.length === 1) {
    return { winnerId: secondBidders[0].playerId, rule: "double_tie_second_highest", reason: "Low-bid tie too! Item defaults to second-highest bidder." };
  }

  return { winnerId: null, rule: "total_deadlock_destroyed", reason: "Total deadlock — second-highest is also tied. Item destroyed, cash returned." };
}

/** Discussion early-termination: all players, or all but one, clicked End. */
export function discussionShouldEnd(clickedCount, playerCount) {
  if (playerCount <= 0) return false;
  return clickedCount >= playerCount || clickedCount >= playerCount - 1;
}

export function isValidBid(amount, minBid, increment, wallet) {
  if (!Number.isInteger(amount) || amount < minBid) return false;
  if ((amount - minBid) % increment !== 0) return false;
  if (amount > wallet) return false;
  return true;
}
