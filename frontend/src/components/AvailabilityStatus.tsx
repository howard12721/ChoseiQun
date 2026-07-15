import type { DayAvailability } from "../types";
import { availabilityLabel } from "../utils/ui";
import { AvailabilityIcon } from "./AvailabilityIcon";

export function ResultStatusBadge({
  value,
  decorative = false,
}: {
  value: DayAvailability;
  decorative?: boolean;
}) {
  return (
    <span
      className={`result-status result-status--${value.toLowerCase()}`}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : availabilityLabel(value)}
      title={decorative ? undefined : availabilityLabel(value)}
    >
      <AvailabilityIcon value={value} />
    </span>
  );
}
