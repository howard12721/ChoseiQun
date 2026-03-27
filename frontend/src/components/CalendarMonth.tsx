import { useEffect, useRef } from "react";
import { buildDateRange, buildMonthCells, formatDateLabel, isoDate, WEEKDAYS } from "../utils/date";

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
  const dragStateRef = useRef<{
    anchorDate: string;
    lastDate: string;
    nextSelected: boolean;
    baseSelectedDates: string[];
  } | null>(null);

  useEffect(() => {
    function finishPaint() {
      dragStateRef.current = null;
    }

    window.addEventListener("pointerup", finishPaint);
    window.addEventListener("pointercancel", finishPaint);
    return () => {
      window.removeEventListener("pointerup", finishPaint);
      window.removeEventListener("pointercancel", finishPaint);
    };
  }, []);

  function applyRangeSelection(date: string) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.lastDate === date) {
      return;
    }

    dragState.lastDate = date;
    const rangeDates = buildDateRange(dragState.anchorDate, date);
    const nextDates = new Set(dragState.baseSelectedDates);
    if (dragState.nextSelected) {
      rangeDates.forEach((value) => nextDates.add(value));
    } else {
      rangeDates.forEach((value) => nextDates.delete(value));
    }

    props.onSetupSetDates?.(Array.from(nextDates));
  }

  function startPaint(date: string) {
    const nextSelected = !props.selectedDates.includes(date);
    dragStateRef.current = {
      anchorDate: date,
      lastDate: "",
      nextSelected,
      baseSelectedDates: props.selectedDates,
    };
    applyRangeSelection(date);
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
          <h3>{monthLabel}</h3>
          <span className="section-caption">{props.mode === "setup" ? "候補日を選択" : "回答を入力"}</span>
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
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div
        className="month-grid"
        onPointerMove={(event) => {
          const target = (event.target as HTMLElement).closest<HTMLElement>("[data-setup-date]");
          const date = target?.dataset.setupDate;
          if (date) {
            applyRangeSelection(date);
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
    <div className="selected-dates">
      {dates.map((date) => (
        <button key={date} type="button" className="date-chip" onClick={() => onRemove(date)}>
          {formatDateLabel(date)}
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
  onSetupPaintStart?: (date: string) => void;
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
  const className = [
    "day-cell",
    !inCurrentMonth && "out-of-month",
    isCandidate && "in-range",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      data-setup-date={date}
      onPointerDown={() => onSetupPaintStart?.(date)}
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
