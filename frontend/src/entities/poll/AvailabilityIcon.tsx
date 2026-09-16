import { Icon } from "../../shared/ui/Icon";
import type { DayAvailability } from "./model";

export function AvailabilityIcon({
  value,
  className = "",
}: {
  value: DayAvailability;
  className?: string;
}) {
  return (
    <Icon
      name={value === "YES" ? "yes" : value === "MAYBE" ? "maybe" : "no"}
      className={`availability-icon availability-icon--${value.toLowerCase()} ${className}`}
    />
  );
}
