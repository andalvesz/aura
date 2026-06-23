import test from "node:test";
import assert from "node:assert/strict";
import {
  ingestionStatusLabel,
  pipelineProgressForStatus,
  pipelineStageIndex,
  PIPELINE_STAGE_LABELS,
} from "./expert-brain-pipeline";

test("pipeline progress maps ingestion statuses", () => {
  assert.equal(pipelineProgressForStatus("uploaded"), 0);
  assert.equal(pipelineProgressForStatus("transcribing"), 25);
  assert.equal(pipelineProgressForStatus("waiting_for_openai"), 25);
  assert.equal(pipelineProgressForStatus("extracting"), 50);
  assert.equal(pipelineProgressForStatus("completed"), 100);
});

test("pipeline stage index", () => {
  assert.equal(pipelineStageIndex("uploaded"), 0);
  assert.equal(pipelineStageIndex("transcribing"), 1);
  assert.equal(pipelineStageIndex("extracting"), 2);
  assert.equal(pipelineStageIndex("completed"), 3);
});

test("ingestion status labels", () => {
  assert.equal(ingestionStatusLabel("waiting_for_openai"), "Aguardando OpenAI");
  assert.equal(ingestionStatusLabel("completed"), "Concluído");
});

test("pipeline stage labels include 0/25/50/100 milestones", () => {
  assert.deepEqual(
    PIPELINE_STAGE_LABELS.map((stage) => stage.percent),
    [0, 25, 50, 100]
  );
});
