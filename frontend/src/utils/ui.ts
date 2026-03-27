import type { AppRoute } from "../app/types";
import type { DayAvailability } from "../types";

export function availabilityLabel(value: DayAvailability) {
  if (value === "YES") return "参加可";
  if (value === "MAYBE") return "たぶん";
  return "不可";
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

export function copyAndFlash(value: string, setFlash: (message: string) => void) {
  void navigator.clipboard.writeText(value)
    .then(() => {
      setFlash("コピーしました");
    })
    .catch((caught) => {
      setFlash(toErrorMessage(caught));
    });
}

export function routeKindLabel(kind: AppRoute["kind"]) {
  if (kind === "home") return "Home";
  if (kind === "setup") return "Setup";
  if (kind === "results") return "Results";
  return "Poll";
}
