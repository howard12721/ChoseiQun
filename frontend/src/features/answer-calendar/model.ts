import type {
  DayAvailability,
  PollCandidate,
  PollListItem,
} from "../../entities/poll/model";

export type AnswerEntry = PollCandidate & {
  pollId: string;
  title: string;
  response: DayAvailability;
};

export function groupAnswersByDate(polls: PollListItem[]) {
  const answers = new Map<string, AnswerEntry[]>();
  for (const poll of polls.filter((poll) => poll.respondedByViewer)) {
    for (const candidate of poll.candidates) {
      const response = poll.viewerResponses[candidate.candidateKey];
      if (!response) continue;
      const entries = answers.get(candidate.date) ?? [];
      entries.push({
        ...candidate,
        pollId: poll.id,
        title: poll.title,
        response,
      });
      answers.set(candidate.date, entries);
    }
  }
  answers.forEach((entries) =>
    entries.sort(
      (a, b) =>
        (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
        a.title.localeCompare(b.title),
    ),
  );
  return answers;
}
