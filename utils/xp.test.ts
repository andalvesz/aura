import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateLevel,
  formatXpRemaining,
  getLevelThreshold,
  getStreakDisplay,
  getXpProgress,
} from "./xp";

describe("xp levels", () => {
  it("uses defined thresholds for levels 1–5", () => {
    assert.equal(calculateLevel(0), 1);
    assert.equal(calculateLevel(99), 1);
    assert.equal(calculateLevel(100), 2);
    assert.equal(calculateLevel(250), 3);
    assert.equal(calculateLevel(450), 4);
    assert.equal(calculateLevel(700), 5);
  });

  it("continues with a growing curve after level 5", () => {
    assert.equal(getLevelThreshold(6), 1000);
    assert.equal(calculateLevel(999), 5);
    assert.equal(calculateLevel(1000), 6);
  });

  it("computes progress within the current level", () => {
    const progress = getXpProgress(150);
    assert.equal(progress.level, 2);
    assert.equal(progress.currentThreshold, 100);
    assert.equal(progress.nextThreshold, 250);
    assert.equal(progress.xpInLevel, 50);
    assert.equal(progress.xpNeeded, 150);
    assert.equal(progress.pct, 33);
  });

  it("reports XP remaining to next level", () => {
    assert.equal(formatXpRemaining(150), 100);
  });
});

describe("xp streak display", () => {
  it("maps streak days to emojis", () => {
    assert.equal(getStreakDisplay(0), "");
    assert.equal(getStreakDisplay(1), "🔥");
    assert.equal(getStreakDisplay(3), "🔥🔥");
    assert.equal(getStreakDisplay(7), "🔥🔥🔥");
    assert.equal(getStreakDisplay(30), "🏆");
  });
});
