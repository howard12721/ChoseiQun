import { useMemo, useState } from "react";
import { AvailabilityIcon } from "../../entities/poll/AvailabilityIcon";
import type { PollListItem } from "../../entities/poll/model";
import { candidateTime } from "../../entities/poll/selectors";
import { groupAnswersByDate } from "./model";
import {
  addMonths,
  buildMonthCells,
  formatFullDateLabel,
  initialMonthForDates,
  isoDate,
  WEEKDAYS,
} from "../../shared/lib/date";
import { Icon } from "../../shared/ui/Icon";

export function AnswerCalendarPage({
  openPolls,
}: {
  openPolls: PollListItem[];
}) {
  const answersByDate = useMemo(
    () => groupAnswersByDate(openPolls),
    [openPolls],
  );
  const dates = [...answersByDate.keys()].sort();
  const today = isoDate(new Date());
  const nearest = dates.find((date) => date >= today) ?? dates.at(-1) ?? today;
  const [selectedDate, setSelectedDate] = useState(nearest);
  const [viewMonth, setViewMonth] = useState(() =>
    initialMonthForDates([nearest]),
  );
  const monthLabel = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(viewMonth);
  const entries = answersByDate.get(selectedDate) ?? [];
  return (
    <section className="answer-calendar-page">
      <h1>回答カレンダー</h1>
      <div className="answer-calendar-layout">
        <section className="answer-calendar" aria-label={`${monthLabel}の回答`}>
          <div className="month-card__header">
            <button
              className="month-nav-button"
              type="button"
              aria-label="前の月"
              onClick={() => setViewMonth(addMonths(viewMonth, -1))}
            >
              <Icon name="left" />
            </button>
            <h2 aria-live="polite">{monthLabel}</h2>
            <button
              className="month-nav-button"
              type="button"
              aria-label="次の月"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            >
              <Icon name="right" />
            </button>
          </div>
          <div className="weekday-row" aria-hidden="true">
            {WEEKDAYS.map((day, i) => (
              <span
                key={day}
                className={i === 0 ? "is-sunday" : i === 6 ? "is-saturday" : ""}
              >
                {day}
              </span>
            ))}
          </div>
          <div className="answer-calendar-grid">
            {buildMonthCells(viewMonth).map((cell, index) => {
              if (!cell) return <div key={index} />;
              const date = isoDate(cell),
                dayEntries = answersByDate.get(date) ?? [];
              const polls = [
                ...new Map(
                  dayEntries.map((entry) => [entry.pollId, entry]),
                ).values(),
              ];
              return (
                <button
                  key={date}
                  type="button"
                  className={`answer-day${date === selectedDate ? " is-selected" : ""}${date === today ? " is-today" : ""}`}
                  aria-label={`${formatFullDateLabel(date)}、${dayEntries.length}候補`}
                  aria-pressed={selectedDate === date}
                  onClick={() => setSelectedDate(date)}
                >
                  <time dateTime={date}>{cell.getDate()}</time>
                  {dayEntries.length > 0 && (
                    <>
                      <span className="answer-day__dot" />
                      <span className="answer-day__events">
                        {polls.slice(0, 2).map((entry) => (
                          <span
                            className="answer-day__event"
                            key={entry.pollId}
                          >
                            <span>{entry.title}</span>
                            <small>
                              {
                                dayEntries.filter(
                                  (item) => item.pollId === entry.pollId,
                                ).length
                              }
                              候補
                            </small>
                          </span>
                        ))}
                        {polls.length > 2 && (
                          <small>ほか{polls.length - 2}件</small>
                        )}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </section>
        <section className="answer-agenda" aria-live="polite">
          <h2>
            {new Intl.DateTimeFormat("ja-JP", {
              month: "long",
              day: "numeric",
              weekday: "short",
            }).format(new Date(`${selectedDate}T00:00:00`))}{" "}
            の回答
          </h2>
          {entries.length ? (
            entries.map((entry) => (
              <article
                className="agenda-slot"
                key={`${entry.pollId}-${entry.candidateKey}`}
              >
                <h3>{candidateTime(entry)}</h3>
                <strong>{entry.title}</strong>
                <div className="agenda-slot__actions">
                  <span
                    className={`agenda-status agenda-status--${entry.response.toLowerCase()}`}
                  >
                    <AvailabilityIcon value={entry.response} />
                    {entry.response === "YES"
                      ? "参加可"
                      : entry.response === "MAYBE"
                        ? "たぶん"
                        : "不可"}
                  </span>
                  <a
                    className="secondary-button"
                    href={`/polls/${entry.pollId}`}
                  >
                    回答を変更
                    <Icon name="edit" />
                  </a>
                </div>
              </article>
            ))
          ) : (
            <p className="empty-state">この日の回答はありません</p>
          )}
        </section>
      </div>
    </section>
  );
}
