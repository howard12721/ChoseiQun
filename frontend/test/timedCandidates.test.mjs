import test from "node:test";
import assert from "node:assert/strict";
import {
  missingTimes,
  setupCandidates,
  replaceTimeRanges,
  validTimeRange,
} from "../src/features/poll-setup/model.ts";
import {
  viewerResponses,
  groupCandidates,
} from "../src/entities/poll/selectors.ts";
import { groupAnswersByDate } from "../src/features/answer-calendar/model.ts";

const first = {
  candidateKey: "2026-09-21/18:00-19:00",
  date: "2026-09-21",
  startTime: "18:00",
  endTime: "19:00",
};
const second = {
  candidateKey: "2026-09-21/19:30-20:30",
  date: "2026-09-21",
  startTime: "19:30",
  endTime: "20:30",
};
const dateOnly = {
  candidateKey: "2026-09-22",
  date: "2026-09-22",
  startTime: null,
  endTime: null,
};

test("all candidate slots default to NO and existing answers stay independent", () => {
  const poll = {
    candidates: [first, second],
    candidateDates: [first.date],
    participants: [],
  };
  assert.deepEqual(viewerResponses(poll), {
    [first.candidateKey]: "NO",
    [second.candidateKey]: "NO",
  });
  poll.participants = [
    { isViewer: true, responses: { [first.candidateKey]: "YES" } },
  ];
  assert.deepEqual(viewerResponses(poll), {
    [first.candidateKey]: "YES",
    [second.candidateKey]: "NO",
  });
  assert.equal(groupCandidates(poll.candidates).length, 1);
});

test("missing or partially filled ranges block publishing only in timed mode", () => {
  const selection = {
    selectedDates: ["2026-09-21", "2026-09-22"],
    scheduleType: "TIMED",
    timeRanges: { "2026-09-21": [first] },
  };
  assert.equal(missingTimes(selection), true);
  selection.timeRanges["2026-09-22"] = [{ startTime: "18:00", endTime: "" }];
  assert.equal(missingTimes(selection), true);
  selection.timeRanges["2026-09-22"] = [second];
  assert.equal(missingTimes(selection), false);
  selection.scheduleType = "DATE_ONLY";
  selection.timeRanges = {};
  assert.equal(missingTimes(selection), false);
  assert.deepEqual(
    setupCandidates(selection),
    selection.selectedDates.map((date) => ({
      date,
      startTime: null,
      endTime: null,
    })),
  );
  assert.equal(validTimeRange({ startTime: "24:00", endTime: "25:00" }), false);
});

test("bulk setting replaces every selected day and each day can then be changed independently", () => {
  const dates = ["2026-09-21", "2026-09-22"];
  const ranges = [{ startTime: "18:00", endTime: "19:00" }];
  const before = { [dates[0]]: [first, second] };
  const after = { ...before, ...replaceTimeRanges(dates, ranges) };
  assert.equal(after[dates[0]].length, 1);
  after[dates[0]][0].startTime = "17:00";
  assert.equal(after[dates[1]][0].startTime, "18:00");
  assert.equal(ranges[0].startTime, "18:00");
});

test("calendar keeps multiple slots and date-only answers without orphan responses", () => {
  const groups = groupAnswersByDate([
    {
      id: "p",
      title: "meeting",
      respondedByViewer: true,
      candidates: [first, second, dateOnly],
      viewerResponses: {
        [first.candidateKey]: "YES",
        [second.candidateKey]: "NO",
        [dateOnly.candidateKey]: "MAYBE",
        orphan: "YES",
      },
    },
  ]);
  assert.equal(groups.get(first.date).length, 2);
  assert.equal(groups.get(dateOnly.date)[0].startTime, null);
  assert.equal(groups.size, 2);
});
