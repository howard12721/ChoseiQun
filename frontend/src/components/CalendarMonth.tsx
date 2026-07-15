import { useEffect, useRef } from "react";
import {
  buildDateRange,
  buildMonthCells,
  formatDateLabel,
  formatFullDateLabel,
  isoDate,
  WEEKDAYS,
} from "../utils/date";
import {
  applyCalendarPaintSelection,
  finishCalendarPaint,
  moveCalendarPaint,
  startCalendarPaint,
  type CalendarPaintState,
} from "../utils/calendarPaint";

export function CalendarMonth(props: {
  monthDate: Date;
  mode: "setup";
  selectedDates: string[];
  onShiftMonth?: (amount: number) => void;
  onSetupSetDates?: (dates: string[]) => void;
}) {
  const { monthDate, ...calendarCellProps } = props;
  const monthLabel = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" }).format(monthDate);
  const cells = buildMonthCells(monthDate);
  const dragStateRef = useRef<CalendarPaintState | null>(null);
  const onSetupSetDatesRef = useRef(props.onSetupSetDates);
  onSetupSetDatesRef.current = props.onSetupSetDates;

  useEffect(() => {
    function finishPaint(event: PointerEvent) {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      const result = finishCalendarPaint(
        dragState,
        event.type as "pointerup" | "pointercancel",
        event.pointerId,
      );
      if (result.endDate) {
        commitRangeSelection(dragState, result.endDate);
      }
      if (result.handled) {
        dragStateRef.current = null;
      }
    }

    window.addEventListener("pointerup", finishPaint);
    window.addEventListener("pointercancel", finishPaint);
    return () => {
      window.removeEventListener("pointerup", finishPaint);
      window.removeEventListener("pointercancel", finishPaint);
    };
  }, []);

  function commitRangeSelection(
    dragState: NonNullable<typeof dragStateRef.current>,
    date: string,
  ) {
    onSetupSetDatesRef.current?.(
      applyCalendarPaintSelection(dragState, buildDateRange(dragState.anchorDate, date)),
    );
  }

  function applyRangeSelection(date: string, pointerId: number) {
    const dragState = dragStateRef.current;
    if (!dragState) {
      return;
    }
    const endDate = moveCalendarPaint(dragState, date, pointerId);
    if (endDate) {
      commitRangeSelection(dragState, endDate);
    }
  }

  function startPaint(date: string, event: React.PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }
    const paint = startCalendarPaint({
      date,
      selectedDates: props.selectedDates,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
    });
    dragStateRef.current = paint.state;
    if (paint.endDate) {
      commitRangeSelection(paint.state, paint.endDate);
    }
  }

  function findSetupDateAtPoint(container: HTMLElement, clientX: number, clientY: number) {
    const target = container.ownerDocument
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-setup-date]");
    return target?.dataset.setupDate;
  }

  return (
    <section className="month-card">
      <div className="month-card__header">
        <button
          type="button"
          className="month-nav-button"
          aria-label="前の月"
          onClick={() => props.onShiftMonth?.(-1)}
        >
          <ChevronIcon direction="left" />
        </button>
        <div className="month-card__title">
          <h3 aria-live="polite">{monthLabel}</h3>
        </div>
        <button
          type="button"
          className="month-nav-button"
          aria-label="次の月"
          onClick={() => props.onShiftMonth?.(1)}
        >
          <ChevronIcon direction="right" />
        </button>
      </div>
      <div className="weekday-row">
        {WEEKDAYS.map((day, index) => (
          <span className={index === 0 ? "is-sunday" : index === 6 ? "is-saturday" : ""} key={day}>
            {day}
          </span>
        ))}
      </div>
      <div
        className="month-grid"
        onPointerMove={(event) => {
          if (!event.isPrimary) {
            return;
          }
          const date = findSetupDateAtPoint(event.currentTarget, event.clientX, event.clientY);
          if (date) {
            applyRangeSelection(date, event.pointerId);
          }
        }}
      >
        {cells.map((cell, index) =>
          cell ? (
            <CalendarCell
              key={`${monthLabel}-${index}`}
              {...calendarCellProps}
              cell={cell}
              monthDate={monthDate}
              onSetupPaintStart={startPaint}
            />
          ) : (
            <div className="day-gap" key={`${monthLabel}-${index}`} />
          ),
        )}
      </div>
    </section>
  );
}

export function SelectedDatesPanel({ dates, onRemove }: { dates: string[]; onRemove: (date: string) => void }) {
  if (!dates.length) {
    return <div className="empty-state">候補日がまだ選ばれていません。</div>;
  }

  return (
    <div className="selected-dates" aria-label="選択中の候補日">
      {dates.map((date) => (
        <button
          key={date}
          type="button"
          className="date-chip"
          aria-label={`${formatFullDateLabel(date)}を候補から削除`}
          onClick={() => onRemove(date)}
        >
          <span>{formatDateLabel(date)}</span>
          <span className="date-chip__remove" aria-hidden="true">×</span>
        </button>
      ))}
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  const path = direction === "left" ? "M14.5 5.5 8 12l6.5 6.5" : "M9.5 5.5 16 12l-6.5 6.5";

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CalendarCell(props: {
  cell: Date;
  monthDate: Date;
  mode: "setup";
  selectedDates: string[];
  onSetupPaintStart?: (date: string, event: React.PointerEvent<HTMLButtonElement>) => void;
  onSetupSetDates?: (dates: string[]) => void;
}) {
  const {
    cell,
    monthDate,
    selectedDates,
    onSetupPaintStart,
    onSetupSetDates,
  } = props;
  const date = isoDate(cell);
  const inCurrentMonth = cell.getMonth() === monthDate.getMonth();
  const isCandidate = selectedDates.includes(date);
  const isToday = date === isoDate(new Date());
  const className = [
    "day-cell",
    !inCurrentMonth && "out-of-month",
    isCandidate && "in-range",
    isToday && "is-today",
    cell.getDay() === 0 && "is-sunday",
    cell.getDay() === 6 && "is-saturday",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      data-setup-date={date}
      aria-label={`${formatFullDateLabel(date)}${isCandidate ? "、選択中" : ""}`}
      aria-pressed={isCandidate}
      onPointerDown={(event) => onSetupPaintStart?.(date, event)}
      onClick={(event) => {
        if (event.detail === 0) {
          onSetupSetDates?.(
            isCandidate
              ? selectedDates.filter((value) => value !== date)
              : [...selectedDates, date],
          );
        }
      }}
    >
      <span>{cell.getDate()}</span>
    </button>
  );
}
