import type { DayAvailability } from "../types";

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

export function toErrorMessage(caught: unknown) {
  if (caught instanceof Error) {
    return caught.message;
  }
  return "予期しないエラーが発生しました";
}

export function copyAndFlash(
  value: string,
  setFlash: (message: string, tone: "success" | "error" | "info") => void,
) {
  void navigator.clipboard.writeText(value)
    .then(() => {
      setFlash("クリップボードにコピーしました", "success");
    })
    .catch((caught) => {
      setFlash(toErrorMessage(caught), "error");
    });
}
