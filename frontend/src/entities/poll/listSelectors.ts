import type { PollListItem } from "./model";

export function selectHomePollLists(openPolls: PollListItem[]) {
  return {
    createdPolls: openPolls.filter((poll) => poll.createdByViewer),
    answeredPolls: openPolls.filter((poll) => poll.respondedByViewer),
  };
}
