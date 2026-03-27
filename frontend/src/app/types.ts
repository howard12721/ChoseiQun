import type { DayAvailability } from "../types";

export type SetupSelection = {
  selectedDates: string[];
  viewMonth: Date;
};

export type EditorState = {
  name: string;
  traqId: string;
  note: string;
  editingCommentCreatedAt: string | null;
  responses: Record<string, DayAvailability>;
};

export type AppRoute =
  | { kind: "home" }
  | { kind: "setup"; id: string; token: string }
  | { kind: "poll"; id: string }
  | { kind: "results"; id: string };
