import type { PollDetail } from "../../entities/poll/model";
import { requestJson } from "../../shared/api/http";

export type SetupPayload = {
  title: string;
  description: string;
  candidateDates: string[];
};

export function saveSetup(id: string, payload: SetupPayload) {
  return requestJson<PollDetail>(`/api/setup/${id}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
