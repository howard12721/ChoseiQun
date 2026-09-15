import type { CSSProperties } from "react";

export type IconName =
  | "plus"
  | "close"
  | "down"
  | "clock"
  | "right"
  | "left"
  | "calendar"
  | "layers"
  | "check"
  | "yes"
  | "maybe"
  | "no"
  | "settings"
  | "copy"
  | "send"
  | "chart"
  | "edit"
  | "comment"
  | "star"
  | "users"
  | "trash";

export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`icon ${className}`}
      style={{ "--icon-url": `url("/icons/${name}.svg")` } as CSSProperties}
    />
  );
}
