import type { PollDetail } from "../../../entities/poll/model";
import { requestJson } from "../../../shared/api/http";

export function createComment(pollId: string, comment: string) {
  return requestJson<PollDetail>(`/api/polls/${pollId}/comments`, {
    method: "POST",
    body: JSON.stringify({ comment }),
  });
}

export function updateComment(pollId: string, createdAt: string, comment: string) {
  return requestJson<PollDetail>(`/api/polls/${pollId}/comments`, {
    method: "PUT",
    body: JSON.stringify({ createdAt, comment }),
  });
}

export function deleteComment(pollId: string, createdAt: string) {
  return requestJson<PollDetail>(`/api/polls/${pollId}/comments`, {
    method: "DELETE",
    body: JSON.stringify({ createdAt }),
  });
}
