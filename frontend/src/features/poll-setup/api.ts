import type { PollDetail, ScheduleType } from "../../entities/poll/model";
import { requestJson } from "../../shared/api/http";

export type SetupPayload = {
  title: string;
  description: string;
  candidateDates: string[];
  scheduleType: ScheduleType;
  candidates: {
    date: string;
    startTime: string | null;
    endTime: string | null;
  }[];
};

export function saveSetup(id: string, payload: SetupPayload) {
  return requestJson<PollDetail>(`/api/setup/${id}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
