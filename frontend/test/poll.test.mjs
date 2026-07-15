import assert from "node:assert/strict";
import test from "node:test";
import { belongsToAnsweredPollList } from "../src/utils/pollList.ts";

test("a poll created and answered by the viewer appears in the answered list", () => {
  assert.equal(
    belongsToAnsweredPollList({
      createdByViewer: true,
      respondedByViewer: true,
    }),
    true,
  );
});

test("a created poll without a viewer response does not appear in the answered list", () => {
  assert.equal(
    belongsToAnsweredPollList({
      createdByViewer: true,
      respondedByViewer: false,
    }),
    false,
  );
});
