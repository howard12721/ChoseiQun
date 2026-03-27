export type PollState = "DRAFT" | "OPEN" | "CLOSED";
export type DayAvailability = "YES" | "MAYBE" | "NO";

export type ParticipantResponse = {
  name: string;
  traqId?: string | null;
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

export type DaySummary = {
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
  participantUrl: string;
  setupUrl?: string | null;
  announcementMessageId?: string | null;
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
  participantCount: number;
  participantUrl: string;
  updatedAt: string;
};

export type ApiError = {
  message?: string;
};
