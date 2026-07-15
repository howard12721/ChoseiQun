import type { DayAvailability, PollDetail } from "../../entities/poll/model";
import { requestJson } from "../../shared/api/http";
import { buildAvailabilityRequest } from "./request";

export function saveAvailability(
  pollId: string,
  responses: Record<string, DayAvailability>,
) {
  const request = buildAvailabilityRequest(pollId, responses);
  return requestJson<PollDetail>(request.url, request.init);
}
