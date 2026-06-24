import test from "node:test";
import assert from "node:assert/strict";
import { emptyExpertBrainDashboard } from "./expert-brain-dashboard";

test("emptyExpertBrainDashboard returns valid zeroed structure", () => {
  const dashboard = emptyExpertBrainDashboard();

  assert.equal(dashboard.metrics.courses, 0);
  assert.equal(dashboard.courses.length, 0);
  assert.equal(dashboard.queue.length, 0);
  assert.equal(dashboard.ingestionQueue.length, 0);
  assert.equal(dashboard.transcripts.length, 0);
  assert.equal(dashboard.statusCounts.pending, 0);
});
