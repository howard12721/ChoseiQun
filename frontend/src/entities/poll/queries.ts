import { requestJson } from "../../shared/api/http";
import type { PollDetail, PollListItem } from "./model";

export function listPolls() {
  return requestJson<PollListItem[]>("/api/polls");
}

export function getPollDetail(id: string) {
  return requestJson<PollDetail>(`/api/polls/${id}`);
}

export function getSetupPoll(id: string) {
  return requestJson<PollDetail>(`/api/setup/${id}`);
}
