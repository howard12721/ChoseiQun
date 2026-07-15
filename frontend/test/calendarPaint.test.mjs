import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCalendarPaintSelection,
  finishCalendarPaint,
  moveCalendarPaint,
  startCalendarPaint,
} from "../src/features/poll-setup/calendarPaint.ts";

test("touch drag paints the date range without applying a tap first", () => {
  const paint = startCalendarPaint({
    date: "2026-07-10",
    selectedDates: [],
    pointerId: 1,
    pointerType: "touch",
  });

  assert.equal(paint.endDate, null);
  const endDate = moveCalendarPaint(paint.state, "2026-07-12", 1);
  assert.equal(endDate, "2026-07-12");
  assert.deepEqual(
    applyCalendarPaintSelection(paint.state, ["2026-07-10", "2026-07-11", "2026-07-12"]),
    ["2026-07-10", "2026-07-11", "2026-07-12"],
  );
  assert.equal(finishCalendarPaint(paint.state, "pointerup", 1).endDate, null);
});

test("touch tap applies only the touched date on pointerup", () => {
  const paint = startCalendarPaint({
    date: "2026-07-10",
    selectedDates: [],
    pointerId: 2,
    pointerType: "touch",
  });

  const finish = finishCalendarPaint(paint.state, "pointerup", 2);
  assert.equal(finish.endDate, "2026-07-10");
  assert.deepEqual(applyCalendarPaintSelection(paint.state, [finish.endDate]), ["2026-07-10"]);
});

test("touch scroll cancellation does not select a date", () => {
  const paint = startCalendarPaint({
    date: "2026-07-10",
    selectedDates: [],
    pointerId: 3,
    pointerType: "touch",
  });

  assert.deepEqual(
    finishCalendarPaint(paint.state, "pointercancel", 3),
    { handled: true, endDate: null },
  );
});

test("mouse selection still starts on pointerdown", () => {
  const paint = startCalendarPaint({
    date: "2026-07-10",
    selectedDates: [],
    pointerId: 4,
    pointerType: "mouse",
  });

  assert.equal(paint.endDate, "2026-07-10");
});
