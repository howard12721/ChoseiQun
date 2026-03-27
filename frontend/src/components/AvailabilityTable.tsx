import type { DayAvailability } from "../types";
import { formatDateLabel, sortDates } from "../utils/date";
import { availabilityButtonClass } from "../utils/ui";
import { AvailabilityOptionIcon } from "./AvailabilityStatus";

export function AvailabilityTable(props: {
  dates: string[];
  responses: Record<string, DayAvailability>;
  onPickAvailability: (date: string, value: DayAvailability) => void;
}) {
  const { dates, responses, onPickAvailability } = props;
  const sortedDates = sortDates(dates);

  if (!sortedDates.length) {
    return <div className="empty-state">候補日がありません。</div>;
  }

  return (
    <div className="availability-table-wrap">
      <table className="availability-table">
        <thead>
          <tr>
            <th>日付</th>
            <th>あなたの予定</th>
          </tr>
        </thead>
        <tbody>
          {sortedDates.map((date) => {
            const response = responses[date];
            return (
              <tr key={date}>
                <td>
                  <div className="availability-date">{formatDateLabel(date)}</div>
                  <div className="availability-date-subtle">{date}</div>
                </td>
                <td>
                  <div className="availability-actions">
                    {([
                      ["YES", "参加可"],
                      ["MAYBE", "たぶん"],
                      ["NO", "不可"],
                    ] as const).map(([tool, label]) => (
                      <button
                        key={tool}
                        type="button"
                        className={availabilityButtonClass(tool, response)}
                        onClick={() => onPickAvailability(date, tool)}
                      >
                        <AvailabilityOptionIcon value={tool} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
