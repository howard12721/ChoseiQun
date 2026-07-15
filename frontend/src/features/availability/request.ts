import type { DayAvailability } from "../../entities/poll/model";

export function buildAvailabilityRequest(
  pollId: string,
  responses: Record<string, DayAvailability>,
) {
  return {
    url: `/api/polls/${pollId}/availability`,
    init: {
      method: "POST",
      body: JSON.stringify({ responses }),
    } satisfies RequestInit,
  };
}
