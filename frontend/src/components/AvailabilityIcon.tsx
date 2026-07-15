import type { DayAvailability } from "../types";

export function AvailabilityIcon({ value, className }: { value: DayAvailability; className?: string }) {
  const classes = ["availability-icon", `availability-icon--${value.toLowerCase()}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      className={classes}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {value === "YES" ? (
        <circle cx="10" cy="10" r="6.6" stroke="currentColor" strokeWidth="1.8" />
      ) : value === "MAYBE" ? (
        <path
          d="M10 3.3 17.1 16.4H2.9L10 3.3Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      ) : (
        <path
          d="m4.6 4.6 10.8 10.8m0-10.8L4.6 15.4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
      )}
    </svg>
  );
}
