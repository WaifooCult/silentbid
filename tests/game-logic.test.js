import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scalingFor, resolveBids, discussionShouldEnd, isValidBid, ITEMS, makeRoomCode } from "../game-logic.js";

describe("scaling matrix", () => {
  it("scales from actual player count, not the room limit", () => {
    assert.deepEqual(scalingFor(2), { itemsToWin: 7, startingWallet: 15000, minBid: 100, increment: 100 });
    assert.deepEqual(scalingFor(4), { itemsToWin: 5, startingWallet: 12000, minBid: 200, increment: 200 });
    assert.deepEqual(scalingFor(6), { itemsToWin: 4, startingWallet: 10000, minBid: 200, increment: 200 });
    assert.deepEqual(scalingFor(10), { itemsToWin: 3, startingWallet: 8000, minBid: 200, increment: 200 });
  });
  it("has exactly 25 items", () => {
    assert.equal(ITEMS.length, 25);
    assert.equal(new Set(ITEMS.map((i) => i.name)).size, 25);
  });
  it("makes 4-character room codes", () => {
    assert.match(makeRoomCode(), /^[A-Z0-9]{4}$/);
  });
});

describe("tie-breaker escalation", () => {
  const bids = (...pairs) => pairs.map(([playerId, amount]) => ({ playerId, amount }));
  it("highest unique bid wins", () => {
    assert.equal(resolveBids(bids(["a", 500], ["b", 300]), 200).winnerId, "a");
  });
  it("high-bid tie defaults to lowest bidder (the image-board example)", () => {
    // Ghost 1500, Viper 1500, Shadow 200 -> Shadow wins.
    const r = resolveBids(bids(["ghost", 1500], ["viper", 1500], ["shadow", 200]), 200);
    assert.equal(r.winnerId, "shadow");
    assert.equal(r.rule, "high_tie_lowest_wins");
  });
  it("double tie defaults to second-highest bidder, deadlock destroys the item", () => {
    // Highest tied, lowest tied, second-highest (900) unique -> e wins.
    const r2 = resolveBids(bids(["a", 1500], ["b", 1500], ["c", 200], ["d", 200], ["e", 900]), 200);
    assert.equal(r2.winnerId, "e");
    assert.equal(r2.rule, "double_tie_second_highest");
    // Highest tied, lowest tied, and second-highest also tied -> destroyed.
    const r = resolveBids(bids(["a", 1500], ["b", 1500], ["c", 200], ["d", 200]), 200);
    assert.equal(r.winnerId, null);
    assert.equal(r.rule, "total_deadlock_destroyed");
  });
  it("ignores bids below the minimum", () => {
    assert.equal(resolveBids(bids(["a", 100], ["b", 300]), 200).winnerId, "b");
  });
});

describe("discussion and bids", () => {
  it("ends early when all, or all but one, click End Discussion", () => {
    assert.equal(discussionShouldEnd(4, 4), true);
    assert.equal(discussionShouldEnd(3, 4), true);
    assert.equal(discussionShouldEnd(2, 4), false);
  });
  it("validates bid amount, increment and wallet", () => {
    assert.equal(isValidBid(400, 200, 200, 1000), true);
    assert.equal(isValidBid(300, 200, 200, 1000), false); // not on increment
    assert.equal(isValidBid(2000, 200, 200, 1000), false); // over wallet
    assert.equal(isValidBid(100, 200, 200, 1000), false); // below minimum
  });
});
