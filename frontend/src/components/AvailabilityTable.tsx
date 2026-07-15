import type { DayAvailability } from "../types";
import { formatDateLabel, sortDates } from "../utils/date";
import { availabilityButtonClass, availabilityLabel } from "../utils/ui";
import { AvailabilityIcon } from "./AvailabilityIcon";

export function AvailabilityTable(props: {
  dates: string[];
  responses: Record<string, DayAvailability>;
  disabled?: boolean;
  onPickAvailability: (date: string, value: DayAvailability) => void;
}) {
  const { dates, responses, disabled = false, onPickAvailability } = props;
  const sortedDates = sortDates(dates);

  if (!sortedDates.length) {
    return <div className="empty-state">候補日がありません。</div>;
  }

  return (
    <div className="availability-table-wrap">
      <table className="availability-table">
        <caption className="visually-hidden">候補日ごとの参加可否を選択</caption>
        <thead>
          <tr>
            <th scope="col">日付</th>
            <th scope="col">あなたの予定</th>
          </tr>
        </thead>
        <tbody>
          {sortedDates.map((date) => {
            const response = responses[date];
            return (
              <tr key={date}>
                <th scope="row">
                  <div className="availability-date">{formatDateLabel(date)}</div>
                  <div className="availability-date-subtle">{date}</div>
                </th>
                <td>
                  <fieldset className="availability-actions">
                    <legend className="visually-hidden">{formatDateLabel(date)}の予定</legend>
                    {([
                      ["YES", "参加可"],
                      ["MAYBE", "たぶん"],
                      ["NO", "不可"],
                    ] as const).map(([tool, label]) => (
                      <button
                        key={tool}
                        type="button"
                        className={availabilityButtonClass(tool, response)}
                        disabled={disabled}
                        aria-label={`${formatDateLabel(date)}: ${availabilityLabel(tool)}`}
                        aria-pressed={(response ?? "NO") === tool}
                        onClick={() => onPickAvailability(date, tool)}
                      >
                        <AvailabilityIcon value={tool} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </fieldset>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
