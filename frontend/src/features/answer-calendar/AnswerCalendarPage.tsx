import { useMemo, useState } from "react";
import { AvailabilityIcon } from "../../entities/poll/AvailabilityIcon";
import { availabilityLabel } from "../../entities/poll/availabilityUi";
import type { DayAvailability, PollListItem } from "../../entities/poll/model";
import {
  addMonths,
  buildMonthCells,
  formatFullDateLabel,
  isoDate,
  sortDates,
  startOfMonth,
  WEEKDAYS,
} from "../../shared/lib/date";

type AnswerEntry = {
  pollId: string;
  title: string;
  response: DayAvailability;
};

export function AnswerCalendarPage({ openPolls }: { openPolls: PollListItem[] }) {
  const answersByDate = useMemo(() => groupAnswersByDate(openPolls), [openPolls]);
  const answeredDates = useMemo(() => sortDates(Array.from(answersByDate.keys())), [answersByDate]);
  const [viewMonth, setViewMonth] = useState(() => initialAnswerMonth(answeredDates));
  const monthLabel = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" }).format(viewMonth);
  const cells = buildMonthCells(viewMonth);

  return (
    <section className="answer-calendar-page">
      <div className="answer-calendar-page__header">
        <h1>回答した日程</h1>
        <ul className="answer-calendar-legend" aria-label="回答記号">
          {(["YES", "MAYBE", "NO"] as const).map((response) => (
            <li className={`answer-calendar-legend__item--${response.toLowerCase()}`} key={response}>
              <AvailabilityIcon value={response} />
              {availabilityLabel(response)}
            </li>
          ))}
        </ul>
      </div>

      <section className="answer-calendar" aria-label={`${monthLabel}の回答`}>
        <div className="answer-calendar__toolbar">
          <button
            type="button"
            className="month-nav-button"
            aria-label="前の月"
            onClick={() => setViewMonth((current) => addMonths(current, -1))}
          >
            <ChevronIcon direction="left" />
          </button>
          <h2 aria-live="polite">{monthLabel}</h2>
          <button
            type="button"
            className="month-nav-button"
            aria-label="次の月"
            onClick={() => setViewMonth((current) => addMonths(current, 1))}
          >
            <ChevronIcon direction="right" />
          </button>
        </div>

        <div className="answer-calendar__weekdays" aria-hidden="true">
          {WEEKDAYS.map((day, index) => (
            <span className={index === 0 ? "is-sunday" : index === 6 ? "is-saturday" : ""} key={day}>
              {day}
            </span>
          ))}
        </div>

        <div className="answer-calendar__grid">
          {cells.map((cell, index) => {
            if (!cell) {
              return <div className="answer-calendar__gap" aria-hidden="true" key={`${monthLabel}-${index}`} />;
            }

            const date = isoDate(cell);
            const entries = answersByDate.get(date) ?? [];
            const isToday = date === isoDate(new Date());
            return (
              <div
                className={`answer-calendar__day${isToday ? " is-today" : ""}`}
                key={date}
                aria-label={formatFullDateLabel(date)}
              >
                <time dateTime={date}>{cell.getDate()}</time>
                <div className="answer-calendar__entries">
                  {entries.map((entry) => (
                    <a
                      className={`answer-calendar__entry answer-calendar__entry--${entry.response.toLowerCase()}`}
                      href={`/polls/${entry.pollId}`}
                      aria-label={`${entry.title}、${availabilityLabel(entry.response)}`}
                      key={entry.pollId}
                    >
                      <AvailabilityIcon value={entry.response} />
                      <span className="answer-calendar__entry-title">{entry.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function groupAnswersByDate(openPolls: PollListItem[]) {
  const answers = new Map<string, AnswerEntry[]>();
  openPolls
    .filter((poll) => poll.respondedByViewer)
    .forEach((poll) => {
      const viewerResponses = poll.viewerResponses ?? {};
      sortDates(Object.keys(viewerResponses))
        .filter((date) => poll.candidateDates.includes(date))
        .forEach((date) => {
          const entries = answers.get(date) ?? [];
          entries.push({ pollId: poll.id, title: poll.title, response: viewerResponses[date] });
          answers.set(date, entries);
        });
    });
  answers.forEach((entries) => entries.sort((left, right) => left.title.localeCompare(right.title)));
  return answers;
}

function initialAnswerMonth(dates: string[]) {
  const today = isoDate(new Date());
  const currentMonth = today.slice(0, 7);
  if (dates.some((date) => date.startsWith(currentMonth))) {
    return startOfMonth(new Date());
  }
  const nearestDate = dates.find((date) => date >= today) ?? dates.at(-1);
  return nearestDate ? startOfMonth(new Date(`${nearestDate}T00:00:00`)) : startOfMonth(new Date());
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
