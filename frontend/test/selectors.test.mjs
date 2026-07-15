import assert from "node:assert/strict";
import test from "node:test";
import { isViewerParticipant, viewerResponses } from "../src/entities/poll/selectors.ts";

const poll = {
  id: "poll1234",
  title: "会議",
  description: "",
  state: "OPEN",
  candidateDates: ["2026-07-20", "2026-07-21"],
  participantUrl: "/polls/poll1234",
  viewerTraqId: "alice",
  participants: [
    {
      name: "alice",
      traqId: "alice",
      isViewer: false,
      note: "",
      comments: [],
      responses: { "2026-07-20": "YES" },
      updatedAt: "2026-07-01T00:00:00Z",
    },
    {
      name: "renamed-alice",
      traqId: "renamed-alice",
      isViewer: true,
      note: "",
      comments: [],
      responses: { "2026-07-20": "MAYBE" },
      updatedAt: "2026-07-01T00:00:00Z",
    },
  ],
  summary: { participantCount: 2, recommendedDates: [], days: [] },
};

test("viewer identity uses server-computed participant marker", () => {
  assert.equal(isViewerParticipant(poll.participants[0], poll), false);
  assert.equal(isViewerParticipant(poll.participants[1], poll), true);
});

test("viewerResponses fills missing candidate dates with NO", () => {
  assert.deepEqual(viewerResponses(poll), {
    "2026-07-20": "MAYBE",
    "2026-07-21": "NO",
  });
});
