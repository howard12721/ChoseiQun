import assert from "node:assert/strict";
import test from "node:test";
import { selectHomePollLists } from "../src/entities/poll/listSelectors.ts";

const basePoll = {
  title: "会議",
  state: "OPEN",
  candidateDates: [],
  participantCount: 0,
  viewerResponses: {},
  participantUrl: "/polls/poll",
  updatedAt: "2026-07-01T00:00:00Z",
};

test("home poll lists classify created and answered polls independently", () => {
  const { createdPolls, answeredPolls } = selectHomePollLists([
    { ...basePoll, id: "created-only", createdByViewer: true, respondedByViewer: false },
    { ...basePoll, id: "created-and-answered", createdByViewer: true, respondedByViewer: true },
    { ...basePoll, id: "answered-only", createdByViewer: false, respondedByViewer: true },
  ]);

  assert.deepEqual(createdPolls.map((poll) => poll.id), ["created-only", "created-and-answered"]);
  assert.deepEqual(answeredPolls.map((poll) => poll.id), ["created-and-answered", "answered-only"]);
});
