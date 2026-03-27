import type { EditorState } from "../app/types";
import type { DayAvailability, ParticipantResponse, PollDetail } from "../types";
import { sortDates } from "./date";

export function resolveTraqId(name: string, traqId?: string) {
  if (traqId) {
    return traqId;
  }
  return /^[a-zA-Z0-9_-]+$/.test(name) ? name : undefined;
}

export function buildDefaultResponses(dates: string[], current: Record<string, DayAvailability>) {
  return Object.fromEntries(
    sortDates(dates).map((date) => [date, current[date] ?? "NO"]),
  ) as Record<string, DayAvailability>;
}

export function hydrateEditor(poll: PollDetail, viewerTraqId: string, current: EditorState): EditorState {
  const existing = poll.participants.find((participant) => {
    if (viewerTraqId) {
      return participant.traqId === viewerTraqId;
    }
    return participant.name.trim().toLowerCase() === current.name.trim().toLowerCase();
  });
  const defaultResponses = buildDefaultResponses(poll.candidateDates, existing?.responses ?? current.responses);

  if (!existing) {
    return {
      ...current,
      name: viewerTraqId || current.name,
      traqId: viewerTraqId,
      note: current.note,
      responses: defaultResponses,
    };
  }

  return {
    name: existing.name,
    traqId: existing.traqId ?? viewerTraqId,
    note: current.note,
    editingCommentCreatedAt: current.editingCommentCreatedAt,
    responses: defaultResponses,
  };
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
