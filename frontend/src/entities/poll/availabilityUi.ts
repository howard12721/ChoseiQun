import type { DayAvailability } from "./model";

export function availabilityLabel(value: DayAvailability) {
  if (value === "YES") return "参加できる";
  if (value === "MAYBE") return "たぶん";
  return "参加できない";
}

export function availabilityButtonClass(tool: DayAvailability, current: DayAvailability | undefined) {
  const isActive = (current ?? "NO") === tool;
  return ["tool-button", "availability-option-button", isActive && "active", `tool-${tool.toLowerCase()}`]
    .filter(Boolean)
    .join(" ");
}
