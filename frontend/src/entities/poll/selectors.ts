import type { DayAvailability, ParticipantResponse, PollDetail } from "./model";

export function resolveTraqId(name: string, traqId?: string) {
  if (traqId) {
    return traqId;
  }
  return /^[a-zA-Z0-9_-]+$/.test(name) ? name : undefined;
}

export function buildDefaultResponses(dates: string[], current: Record<string, DayAvailability>) {
  return Object.fromEntries(
    [...dates].sort((left, right) => left.localeCompare(right)).map((date) => [date, current[date] ?? "NO"]),
  ) as Record<string, DayAvailability>;
}

export function isViewerParticipant(participant: ParticipantResponse, poll: PollDetail) {
  if (participant.isViewer !== undefined) {
    return participant.isViewer;
  }
  return Boolean(poll.viewerTraqId && participant.traqId === poll.viewerTraqId);
}

export function viewerResponses(
  poll: PollDetail,
  fallback: Record<string, DayAvailability> = {},
) {
  const existing = poll.participants.find((participant) => isViewerParticipant(participant, poll));
  return buildDefaultResponses(poll.candidateDates, existing?.responses ?? fallback);
}

export function bestSummaryDay(poll: PollDetail) {
  return [...poll.summary.days].sort((left, right) =>
    right.score - left.score ||
    right.yesCount - left.yesCount ||
    left.noCount - right.noCount ||
    left.date.localeCompare(right.date),
  )[0];
}

export function participantCommentsForDisplay(participant: ParticipantResponse) {
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
