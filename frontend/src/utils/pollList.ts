import type { PollListItem } from "../types";

export function belongsToAnsweredPollList(poll: Pick<PollListItem, "respondedByViewer">) {
  return poll.respondedByViewer;
}
