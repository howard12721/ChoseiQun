import { AvailabilityIcon } from "../../entities/poll/AvailabilityIcon";
import {
  availabilityButtonClass,
  availabilityLabel,
} from "../../entities/poll/availabilityUi";
import type { DayAvailability, PollCandidate } from "../../entities/poll/model";
import { candidateTime, groupCandidates } from "../../entities/poll/selectors";
import { formatDateLabel } from "../../shared/lib/date";

export function AvailabilityTable({
  candidates,
  responses,
  disabled = false,
  onPickAvailability,
}: {
  candidates: PollCandidate[];
  responses: Record<string, DayAvailability>;
  disabled?: boolean;
  onPickAvailability: (key: string, value: DayAvailability) => void;
}) {
  const timed = candidates.some((candidate) => candidate.startTime !== null);
  return (
    <div
      className={`availability-table${timed ? " availability-table--timed" : " availability-table--date"}`}
    >
      {groupCandidates(candidates).map(([date, dayCandidates]) => (
        <section className="availability-day" key={date}>
          {timed && (
            <h3 className="candidate-day-heading">{formatDateLabel(date)}</h3>
          )}
          {dayCandidates.map((candidate) => (
            <div className="availability-row" key={candidate.candidateKey}>
              <div
                className={`availability-date${timed ? "" : " candidate-day-heading"}`}
              >
                {timed ? candidateTime(candidate) : formatDateLabel(date)}
              </div>
              <fieldset className="availability-actions" disabled={disabled}>
                <legend className="visually-hidden">
                  {formatDateLabel(date)}{" "}
                  {timed ? candidateTime(candidate) : ""}の予定
                </legend>
                {(
                  [
                    ["YES", "参加可"],
                    ["MAYBE", "たぶん"],
                    ["NO", "不可"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={availabilityButtonClass(
                      value,
                      responses[candidate.candidateKey],
                    )}
                    aria-label={`${formatDateLabel(date)} ${timed ? candidateTime(candidate) : ""}: ${availabilityLabel(value)}`}
                    aria-pressed={
                      (responses[candidate.candidateKey] ?? "NO") === value
                    }
                    onClick={() =>
                      onPickAvailability(candidate.candidateKey, value)
                    }
                  >
                    <AvailabilityIcon value={value} />
                    <span>{label}</span>
                  </button>
                ))}
              </fieldset>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
