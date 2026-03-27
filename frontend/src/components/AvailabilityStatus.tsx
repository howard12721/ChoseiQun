import type { DayAvailability } from "../types";
import { availabilityLabel } from "../utils/ui";

export function ResultStatusBadge({ value, compact = false }: { value: DayAvailability; compact?: boolean }) {
  return (
    <span
      className={`result-status result-status--${value.toLowerCase()}${compact ? " result-status--compact" : ""}`}
      aria-label={availabilityLabel(value)}
      title={availabilityLabel(value)}
    >
      <AvailabilityOptionIcon value={value} />
    </span>
  );
}

export function AvailabilityOptionIcon({ value }: { value: DayAvailability }) {
  if (value === "YES") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 12.3l2.6 2.6L16.4 9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      </svg>
    );
  }

  if (value === "MAYBE") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.2l7.1 14.2H4.9L12 4.2z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M12 9v3.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        <circle cx="12" cy="16.2" r="1" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 9l6 6M15 9l-6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
