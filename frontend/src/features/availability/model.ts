import type { DayAvailability } from "../../entities/poll/model";

export type AvailabilityDraft = {
  responses: Record<string, DayAvailability>;
};
