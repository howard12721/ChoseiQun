export type ScheduleType = "DATE_ONLY" | "TIMED";
export type PollCandidate = {
  candidateKey: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
};

export type PollState = "DRAFT" | "OPEN" | "CLOSED";
export type DayAvailability = "YES" | "MAYBE" | "NO";

export type ParticipantResponse = {
  name: string;
  traqId?: string | null;
  isViewer?: boolean;
  iconUrl?: string | null;
  note: string;
  comments: ParticipantComment[];
  responses: Record<string, DayAvailability>;
  updatedAt: string;
};

export type ParticipantComment = {
  body: string;
  createdAt: string;
};

export type DaySummary = PollCandidate & {
  date: string;
  label: string;
  yesCount: number;
  maybeCount: number;
  noCount: number;
  score: number;
};

export type PollSummary = {
  participantCount: number;
  recommendedDates: DaySummary[];
  days: DaySummary[];
};

export type PollDetail = {
  id: string;
  title: string;
  description: string;
  state: PollState;
  candidateDates: string[];
  scheduleType: ScheduleType;
  candidates: PollCandidate[];
  participantUrl: string;
  setupUrl?: string | null;
  viewerTraqId?: string | null;
  viewerIconUrl?: string | null;
  participants: ParticipantResponse[];
  summary: PollSummary;
};

export type PollListItem = {
  id: string;
  title: string;
  state: PollState;
  candidateDates: string[];
  scheduleType: ScheduleType;
  candidates: PollCandidate[];
  participantCount: number;
  respondedByViewer: boolean;
  createdByViewer: boolean;
  viewerResponses: Record<string, DayAvailability>;
  participantUrl: string;
  updatedAt: string;
};
