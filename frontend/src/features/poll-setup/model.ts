import type { PollDetail, ScheduleType } from "../../entities/poll/model";

export type TimeRange = { startTime: string; endTime: string };
export type SetupSelection = {
  selectedDates: string[];
  viewMonth: Date;
  scheduleType: ScheduleType;
  timeRanges: Record<string, TimeRange[]>;
};

export function initialTimeRanges(poll: PollDetail) {
  const ranges: Record<string, TimeRange[]> = {};
  for (const candidate of poll.candidates ?? []) {
    if (candidate.startTime && candidate.endTime) {
      (ranges[candidate.date] ??= []).push({
        startTime: candidate.startTime,
        endTime: candidate.endTime,
      });
    }
  }
  return ranges;
}

export function validTimeRange(range: TimeRange) {
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  return (
    time.test(range.startTime) &&
    time.test(range.endTime) &&
    range.startTime !== range.endTime
  );
}

export function missingTimes(selection: SetupSelection) {
  return (
    selection.scheduleType === "TIMED" &&
    selection.selectedDates.some((date) => {
      const ranges = selection.timeRanges[date] ?? [];
      return !ranges.length || ranges.some((range) => !validTimeRange(range));
    })
  );
}

export function commonTimeRanges(selection: SetupSelection): TimeRange[] | null {
  const firstRanges = selection.timeRanges[selection.selectedDates[0]] ?? [];
  return selection.selectedDates.length > 0 &&
    firstRanges.length > 0 &&
    firstRanges.every(validTimeRange) &&
    selection.selectedDates.every((date) => {
      const ranges = selection.timeRanges[date] ?? [];
      return (
        ranges.length === firstRanges.length &&
        ranges.every(
          (range, index) =>
            range.startTime === firstRanges[index].startTime &&
            range.endTime === firstRanges[index].endTime,
        )
      );
    })
    ? firstRanges
    : null;
}

export function updateSelectedDates(
  current: SetupSelection,
  selectedDates: string[],
): SetupSelection {
  if (
    current.selectedDates.length === selectedDates.length &&
    current.selectedDates.every((date, index) => date === selectedDates[index])
  ) {
    return current;
  }
  const common =
    current.scheduleType === "TIMED" ? commonTimeRanges(current) : null;
  const addedDates = selectedDates.filter(
    (date) => !current.selectedDates.includes(date),
  );
  return {
    ...current,
    selectedDates,
    timeRanges:
      common && addedDates.length
        ? { ...current.timeRanges, ...replaceTimeRanges(addedDates, common) }
        : current.timeRanges,
  };
}

export function setupCandidates(selection: SetupSelection) {
  return selection.selectedDates.flatMap<{
    date: string;
    startTime: string | null;
    endTime: string | null;
  }>((date) =>
    selection.scheduleType === "DATE_ONLY"
      ? [{ date, startTime: null, endTime: null }]
      : (selection.timeRanges[date] ?? []).map((range) => ({ date, ...range })),
  );
}

export function replaceTimeRanges(dates: string[], ranges: TimeRange[]) {
  return Object.fromEntries(
    dates.map((date) => [date, ranges.map((range) => ({ ...range }))]),
  );
}
