export type CalendarPaintState = {
  anchorDate: string;
  lastDate: string;
  nextSelected: boolean;
  baseSelectedDates: string[];
  pointerId: number;
  pointerType: string;
  hasDragged: boolean;
};

export function startCalendarPaint(options: {
  date: string;
  selectedDates: string[];
  pointerId: number;
  pointerType: string;
}) {
  const isTouch = options.pointerType === "touch";
  const state: CalendarPaintState = {
    anchorDate: options.date,
    lastDate: isTouch ? options.date : "",
    nextSelected: !options.selectedDates.includes(options.date),
    baseSelectedDates: options.selectedDates,
    pointerId: options.pointerId,
    pointerType: options.pointerType,
    hasDragged: false,
  };
  return {
    state,
    endDate: isTouch ? null : options.date,
  };
}

export function moveCalendarPaint(
  state: CalendarPaintState,
  date: string,
  pointerId: number,
) {
  if (state.pointerId !== pointerId || state.lastDate === date) {
    return null;
  }
  state.lastDate = date;
  state.hasDragged = true;
  return date;
}

export function finishCalendarPaint(
  state: CalendarPaintState,
  eventType: "pointerup" | "pointercancel",
  pointerId: number,
) {
  if (state.pointerId !== pointerId) {
    return { handled: false, endDate: null };
  }
  const shouldApplyTap = eventType === "pointerup" && state.pointerType === "touch" && !state.hasDragged;
  return {
    handled: true,
    endDate: shouldApplyTap ? state.anchorDate : null,
  };
}

export function applyCalendarPaintSelection(
  state: CalendarPaintState,
  rangeDates: string[],
) {
  const nextDates = new Set(state.baseSelectedDates);
  if (state.nextSelected) {
    rangeDates.forEach((date) => nextDates.add(date));
  } else {
    rangeDates.forEach((date) => nextDates.delete(date));
  }
  return Array.from(nextDates);
}
