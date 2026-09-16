import test from "node:test";
import assert from "node:assert/strict";
import {
  commonTimeRanges,
  updateSelectedDates,
  initialTimeRanges,
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

test("time ranges must end after their start within the same day", () => {
  for (const range of [
    { startTime: "18:00", endTime: "17:59" },
    { startTime: "18:00", endTime: "18:00" },
    { startTime: "23:59", endTime: "00:00" },
  ]) {
    assert.equal(validTimeRange(range), false);
    const selection = {
      scheduleType: "TIMED",
      selectedDates: ["2026-09-21"],
      timeRanges: { "2026-09-21": [range] },
    };
    assert.equal(missingTimes(selection), true);
    assert.equal(commonTimeRanges(selection), null);
  }
  assert.equal(validTimeRange({ startTime: "00:00", endTime: "00:01" }), true);
  assert.equal(validTimeRange({ startTime: "23:58", endTime: "23:59" }), true);
});

test("initial, bulk and published ranges are sorted while draft duplicates remain", () => {
  const early = { startTime: "09:00", endTime: "10:00" };
  const late = { startTime: "18:00", endTime: "19:00" };
  const longer = { startTime: "09:00", endTime: "11:00" };
  const ranges = [late, longer, early, early];
  const date = "2026-09-21";
  const expected = [early, early, longer, late];
  assert.deepEqual(initialTimeRanges({
    candidates: ranges.map(range => ({ date, ...range })),
  })[date], expected);
  assert.deepEqual(replaceTimeRanges([date], ranges)[date], expected);
  assert.deepEqual(setupCandidates({
    scheduleType: "TIMED",
    selectedDates: [date],
    timeRanges: { [date]: ranges },
  }), expected.map(range => ({ date, ...range })));
  assert.deepEqual(ranges, [late, longer, early, early]);
});

test("common ranges do not depend on draft input order", () => {
  const early = { startTime: "09:00", endTime: "10:00" };
  const late = { startTime: "18:00", endTime: "19:00" };
  assert.deepEqual(commonTimeRanges({
    selectedDates: ["2026-09-21", "2026-09-22"],
    timeRanges: { "2026-09-21": [late, early], "2026-09-22": [early, late] },
  }), [early, late]);
});

test("only complete ranges on selected dates can be common", () => {
  const selection = {
    selectedDates: [],
    scheduleType: "TIMED",
    timeRanges: { "2026-09-21": [first] },
  };
  assert.equal(commonTimeRanges(selection), null);
  selection.selectedDates = ["2026-09-21"];
  assert.deepEqual(commonTimeRanges(selection), [first]);
  for (const ranges of [[], [{ startTime: "18:00", endTime: "" }]]) {
    selection.timeRanges["2026-09-21"] = ranges;
    assert.equal(commonTimeRanges(selection), null);
  }
});

test("added dates inherit every common range without sharing editable objects", () => {
  const selection = {
    selectedDates: ["2026-09-21", "2026-09-22"],
    scheduleType: "TIMED",
    timeRanges: replaceTimeRanges(["2026-09-21", "2026-09-22"], [first, second]),
  };
  const dates = [...selection.selectedDates, "2026-09-24", "2026-09-25"];
  const next = updateSelectedDates(selection, dates);
  assert.deepEqual(next.timeRanges["2026-09-24"], [first, second]);
  assert.deepEqual(next.timeRanges["2026-09-25"], [first, second]);
  assert.equal(missingTimes(next), false);
  assert.equal(setupCandidates(next).length, 8);
  assert.equal(selection.timeRanges["2026-09-24"], undefined);
  next.timeRanges["2026-09-24"][0].startTime = "17:00";
  assert.equal(next.timeRanges["2026-09-25"][0].startTime, "18:00");
  assert.equal(selection.timeRanges["2026-09-21"][0].startTime, "18:00");
});

test("reselected dates use the current common ranges instead of stale ranges", () => {
  const selection = {
    selectedDates: ["2026-09-21", "2026-09-22"],
    scheduleType: "TIMED",
    timeRanges: { "2026-09-21": [first], "2026-09-22": [second] },
  };
  const removed = updateSelectedDates(selection, ["2026-09-21"]);
  const reselected = updateSelectedDates(removed, selection.selectedDates);
  assert.deepEqual(reselected.timeRanges["2026-09-22"], [first]);
  assert.deepEqual(selection.timeRanges["2026-09-22"], [second]);
  assert.equal(updateSelectedDates(reselected, [...reselected.selectedDates]), reselected);
});

test("custom, incomplete, empty and date-only selections do not supply common ranges", () => {
  const base = {
    selectedDates: ["2026-09-21", "2026-09-22"],
    scheduleType: "TIMED",
    timeRanges: { "2026-09-21": [first], "2026-09-22": [first] },
  };
  const selections = [
    { ...base, timeRanges: { "2026-09-21": [first], "2026-09-22": [second] } },
    { ...base, timeRanges: { "2026-09-21": [first] } },
    { ...base, selectedDates: ["2026-09-21"], timeRanges: { "2026-09-21": [{ startTime: "18:00", endTime: "" }] } },
    { ...base, selectedDates: [] },
    { ...base, scheduleType: "DATE_ONLY" },
  ];
  for (const selection of selections) {
    const next = updateSelectedDates(selection, [...selection.selectedDates, "2026-09-24"]);
    assert.equal(next.timeRanges["2026-09-24"], undefined);
    assert.deepEqual(next.timeRanges, selection.timeRanges);
  }
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
