import type {
  DayAvailability,
  ParticipantResponse,
  PollDetail,
  PollCandidate,
} from "./model";

export function resolveTraqId(name: string, traqId?: string) {
  if (traqId) {
    return traqId;
  }
  return /^[a-zA-Z0-9_-]+$/.test(name) ? name : undefined;
}

export function buildDefaultResponses(
  dates: string[],
  current: Record<string, DayAvailability>,
) {
  return Object.fromEntries(
    [...dates]
      .sort((left, right) => left.localeCompare(right))
      .map((date) => [date, current[date] ?? "NO"]),
  ) as Record<string, DayAvailability>;
}

export function isViewerParticipant(
  participant: ParticipantResponse,
  poll: PollDetail,
) {
  if (participant.isViewer !== undefined) {
    return participant.isViewer;
  }
  return Boolean(poll.viewerTraqId && participant.traqId === poll.viewerTraqId);
}

export function viewerResponses(
  poll: PollDetail,
  fallback: Record<string, DayAvailability> = {},
) {
  const existing = poll.participants.find((participant) =>
    isViewerParticipant(participant, poll),
  );
  return buildDefaultResponses(
    pollCandidates(poll).map((candidate) => candidate.candidateKey),
    existing?.responses ?? fallback,
  );
}

export function bestSummaryDay(poll: PollDetail) {
  return [...poll.summary.days].sort(
    (left, right) =>
      right.score - left.score ||
      right.yesCount - left.yesCount ||
      left.noCount - right.noCount ||
      (left.candidateKey ?? left.date).localeCompare(
        right.candidateKey ?? right.date,
      ),
  )[0];
}

export function participantCommentsForDisplay(
  participant: ParticipantResponse,
) {
  const comments = participant.comments ?? [];
  if (comments.length) {
    return comments;
  }
  return participant.note
    ? [{ body: participant.note, createdAt: participant.updatedAt }]
    : [];
}

export function resolveParticipantIconUrl(
  participant: ParticipantResponse,
  viewerTraqId?: string | null,
  viewerIconUrl?: string | null,
) {
  if (viewerTraqId && viewerIconUrl && participant.traqId === viewerTraqId) {
    return viewerIconUrl;
  }
  return participant.iconUrl ?? undefined;
}

export function pollCandidates(poll: {
  candidates?: PollCandidate[];
  candidateDates: string[];
}): PollCandidate[] {
  return (
    poll.candidates ??
    poll.candidateDates.map((date) => ({
      candidateKey: date,
      date,
      startTime: null,
      endTime: null,
    }))
  );
}

export function candidateTime(candidate: PollCandidate) {
  return candidate.startTime
    ? `${candidate.startTime}–${candidate.endTime}`
    : "日付のみ";
}

export function groupCandidates(candidates: PollCandidate[]) {
  const days = new Map<string, PollCandidate[]>();
  for (const candidate of candidates)
    days.set(candidate.date, [...(days.get(candidate.date) ?? []), candidate]);
  return [...days.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
}
