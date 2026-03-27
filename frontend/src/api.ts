import type {
  ApiError,
  DayAvailability,
  DaySummary,
  ParticipantResponse,
  PollDetail,
  PollListItem,
  PollState,
  PollSummary,
} from "./types";

type StubParticipantRecord = {
  name: string;
  traqId?: string | null;
  note: string;
  comments: Array<{ body: string; createdAt: string }>;
  responses: Record<string, DayAvailability>;
  updatedAt: string;
};

type StubPollRecord = {
  id: string;
  setupToken: string;
  title: string;
  description: string;
  state: PollState;
  candidateDates: string[];
  createdAt: string;
  updatedAt: string;
  announcementMessageId: string | null;
  participants: StubParticipantRecord[];
};

const STUB_MODE = import.meta.env.VITE_USE_STUBS === "true";
const STUB_LATENCY_MS = 140;
const stubStore = createStubStore();

export const isStubMode = STUB_MODE;

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  if (STUB_MODE) {
    return mockApi<T>(url, init);
  }
  return fetchApi<T>(url, init);
}

async function fetchApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const data = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) {
    throw new Error(data.message ?? "API request failed");
  }
  return data;
}

async function mockApi<T>(url: string, init?: RequestInit): Promise<T> {
  await wait(STUB_LATENCY_MS);

  const requestUrl = new URL(url, window.location.origin);
  const method = (init?.method ?? "GET").toUpperCase();

  if (method === "GET" && requestUrl.pathname === "/api/polls") {
    return clone(listOpenPolls()) as T;
  }

  const publicPollMatch = requestUrl.pathname.match(/^\/api\/polls\/([^/]+)$/);
  if (publicPollMatch) {
    const poll = requirePoll(publicPollMatch[1]);
    if (method === "GET") {
      return clone(toPollDetail(poll)) as T;
    }
    if (method === "POST" && requestUrl.pathname.endsWith("/availability")) {
      throw new Error("Unexpected availability route");
    }
  }

  const availabilityMatch = requestUrl.pathname.match(/^\/api\/polls\/([^/]+)\/availability$/);
  if (availabilityMatch && method === "POST") {
    const poll = requirePoll(availabilityMatch[1]);
    const payload = parseJsonBody(init) as {
      name: string;
      responses?: Record<string, DayAvailability>;
    };
    const participantName = payload.name.trim();
    if (!participantName) {
      throw new Error("名前を入力してください");
    }

    const participant: StubParticipantRecord = {
      name: participantName,
      note: poll.participants[existingIndexOfParticipant(poll, participantName)]?.note ?? "",
      comments: poll.participants[existingIndexOfParticipant(poll, participantName)]?.comments ?? [],
      responses: { ...(payload.responses ?? {}) },
      updatedAt: nowIso(),
    };
    const existingIndex = existingIndexOfParticipant(poll, participantName);
    if (existingIndex >= 0) {
      poll.participants[existingIndex] = {
        ...poll.participants[existingIndex],
        ...participant,
      };
    } else {
      poll.participants.push(participant);
    }
    poll.updatedAt = nowIso();
    return clone(toPollDetail(poll)) as T;
  }

  const commentMatch = requestUrl.pathname.match(/^\/api\/polls\/([^/]+)\/comments$/);
  if (commentMatch && method === "POST") {
    const poll = requirePoll(commentMatch[1]);
    const payload = parseJsonBody(init) as {
      comment: string;
    };
    const participantName = "howard127";
    const comment = payload.comment.trim();
    if (!comment) {
      throw new Error("コメントを入力してください");
    }

    const existingIndex = existingIndexOfParticipant(poll, participantName)
    const existing = existingIndex >= 0 ? poll.participants[existingIndex] : null;
    const participant: StubParticipantRecord = {
      name: participantName,
      traqId: participantName,
      note: "",
      comments: [...materializeStubComments(existing), { body: comment, createdAt: nowIso() }],
      responses: buildDefaultResponses(poll.candidateDates, existing?.responses ?? {}),
      updatedAt: nowIso(),
    };
    if (existingIndex >= 0) {
      poll.participants[existingIndex] = participant;
    } else {
      poll.participants.push(participant);
    }
    poll.updatedAt = nowIso();
    return clone(toPollDetail(poll)) as T;
  }

  if (commentMatch && method === "PUT") {
    const poll = requirePoll(commentMatch[1]);
    const payload = parseJsonBody(init) as {
      createdAt: string;
      comment: string;
    };
    const participantName = "howard127";
    const existingIndex = existingIndexOfParticipant(poll, participantName);
    const existing = existingIndex >= 0 ? poll.participants[existingIndex] : null;
    if (!existing) {
      throw new Error("自分のコメントが見つかりません");
    }
    const createdAt = payload.createdAt.trim();
    const comment = payload.comment.trim();
    if (!createdAt || !comment) {
      throw new Error("編集するコメントが見つかりません");
    }

    const comments = materializeStubComments(existing);
    const commentIndex = comments.findIndex((entry) => entry.createdAt === createdAt);
    if (commentIndex < 0) {
      throw new Error("編集するコメントが見つかりません");
    }

    const updatedComments = [...comments];
    updatedComments[commentIndex] = { ...updatedComments[commentIndex], body: comment };
    poll.participants[existingIndex] = {
      ...existing,
      name: participantName,
      traqId: participantName,
      note: "",
      comments: updatedComments,
      updatedAt: nowIso(),
    };
    poll.updatedAt = nowIso();
    return clone(toPollDetail(poll)) as T;
  }

  if (commentMatch && method === "DELETE") {
    const poll = requirePoll(commentMatch[1]);
    const payload = parseJsonBody(init) as {
      createdAt: string;
    };
    const participantName = "howard127";
    const existingIndex = existingIndexOfParticipant(poll, participantName);
    const existing = existingIndex >= 0 ? poll.participants[existingIndex] : null;
    if (!existing) {
      throw new Error("自分のコメントが見つかりません");
    }
    const createdAt = payload.createdAt.trim();
    if (!createdAt) {
      throw new Error("削除するコメントが見つかりません");
    }

    const comments = materializeStubComments(existing);
    const updatedComments = comments.filter((entry) => entry.createdAt !== createdAt);
    if (updatedComments.length === comments.length) {
      throw new Error("削除するコメントが見つかりません");
    }

    poll.participants[existingIndex] = {
      ...existing,
      name: participantName,
      traqId: participantName,
      note: "",
      comments: updatedComments,
      updatedAt: nowIso(),
    };
    poll.updatedAt = nowIso();
    return clone(toPollDetail(poll)) as T;
  }

  const setupMatch = requestUrl.pathname.match(/^\/api\/setup\/([^/]+)$/);
  if (setupMatch) {
    const poll = requirePoll(setupMatch[1]);
    const token = requestUrl.searchParams.get("token");
    if (token !== poll.setupToken) {
      throw new Error("設定用 URL が無効です");
    }

    if (method === "GET") {
      return clone(toPollDetail(poll)) as T;
    }

    if (method === "POST") {
      const payload = parseJsonBody(init) as {
        title: string;
        description?: string;
        candidateDates: string[];
      };
      poll.title = payload.title.trim() || poll.title;
      poll.description = (payload.description ?? "").trim();
      poll.candidateDates = [...new Set(payload.candidateDates)].sort();
      poll.state = "OPEN";
      poll.updatedAt = nowIso();
      return clone(toPollDetail(poll)) as T;
    }
  }

  throw new Error(`Stub API has no handler for ${method} ${requestUrl.pathname}`);
}

function createStubStore(): { polls: StubPollRecord[] } {
  const start = addDays(new Date(), 2);
  const end = addDays(start, 8);
  const days = buildDateRange(toIsoDate(start), toIsoDate(end));
  const record: StubPollRecord = {
    id: "lab-mtg",
    setupToken: "stub-token",
    title: "研究室MTG 4月前半",
    description: "UI スタブ用のサンプルです。候補日をいじって見た目を確認できます。",
    state: "OPEN",
    candidateDates: [days[0], days[1], days[3], days[4], days[6], days[8]],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    announcementMessageId: "stub-message",
    participants: [
      {
        name: "howard127",
        traqId: "howard127",
        note: "",
        comments: [{ body: "18時以降なら参加できます", createdAt: nowIso() }],
        updatedAt: nowIso(),
        responses: {
          [days[0]]: "YES",
          [days[1]]: "YES",
          [days[2]]: "MAYBE",
          [days[4]]: "NO",
        },
      },
      {
        name: "みかん",
        note: "",
        comments: [{ body: "対面だとありがたいです", createdAt: nowIso() }],
        updatedAt: nowIso(),
        responses: {
          [days[1]]: "YES",
          [days[2]]: "YES",
          [days[3]]: "MAYBE",
          [days[5]]: "NO",
        },
      },
      {
        name: "r7kamura",
        traqId: "r7kamura",
        note: "",
        comments: [],
        updatedAt: nowIso(),
        responses: {
          [days[0]]: "MAYBE",
          [days[2]]: "YES",
          [days[3]]: "YES",
          [days[6]]: "NO",
        },
      },
    ],
  };

  return { polls: [record] };
}

function listOpenPolls(): PollListItem[] {
  return stubStore.polls
    .filter((poll) => poll.state === "OPEN")
    .map((poll) => ({
      id: poll.id,
      title: poll.title,
      state: poll.state,
      candidateDates: [...poll.candidateDates],
      participantCount: poll.participants.length,
      participantUrl: absoluteUrl(`/polls/${poll.id}`),
      updatedAt: poll.updatedAt,
    }));
}

function toPollDetail(record: StubPollRecord): PollDetail {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    state: record.state,
    candidateDates: [...record.candidateDates],
    participantUrl: absoluteUrl(`/polls/${record.id}`),
    setupUrl: absoluteUrl(`/setup/${record.id}?token=${record.setupToken}`),
    announcementMessageId: record.announcementMessageId,
    viewerTraqId: "howard127",
    viewerIconUrl: "https://q.trap.jp/api/v3/public/icon/howard127",
    participants: record.participants.map((participant) => toParticipantResponse(participant)),
    summary: buildSummary(record),
  };
}

function toParticipantResponse(participant: StubParticipantRecord): ParticipantResponse {
  const resolvedTraqId = resolveStubTraqId(participant);
  return {
    name: resolvedTraqId ?? participant.name,
    traqId: resolvedTraqId,
    iconUrl: resolvedTraqId ? `https://q.trap.jp/api/v3/public/icon/${encodeURIComponent(resolvedTraqId)}` : null,
    note: participant.note,
    comments: clone(participant.comments),
    responses: { ...participant.responses },
    updatedAt: participant.updatedAt,
  };
}

function resolveStubTraqId(participant: StubParticipantRecord): string | null {
  if (participant.traqId) {
    return participant.traqId;
  }
  return /^[a-zA-Z0-9_-]+$/.test(participant.name) ? participant.name : null;
}

function materializeStubComments(participant?: StubParticipantRecord | null) {
  if (!participant) {
    return [];
  }
  const legacyComments = participant.note
    ? [{ body: participant.note, createdAt: participant.updatedAt }]
    : [];
  return [...legacyComments, ...(participant.comments ?? [])];
}

function buildSummary(record: StubPollRecord): PollSummary {
  const days = record.candidateDates.map((date) => {
    const responses = record.participants.map((participant) => participant.responses[date]).filter(Boolean) as DayAvailability[];
    const yesCount = responses.filter((value) => value === "YES").length;
    const maybeCount = responses.filter((value) => value === "MAYBE").length;
    const noCount = responses.filter((value) => value === "NO").length;
    return {
      date,
      label: formatDateLabel(date),
      yesCount,
      maybeCount,
      noCount,
      score: yesCount + maybeCount,
    } satisfies DaySummary;
  });

  const recommendedDates = [...days]
    .sort((left, right) =>
      right.score - left.score ||
      right.yesCount - left.yesCount ||
      left.noCount - right.noCount ||
      left.date.localeCompare(right.date),
    )
    .slice(0, 3);

  return {
    participantCount: record.participants.length,
    recommendedDates,
    days,
  };
}

function existingIndexOfParticipant(store: StubPollRecord, participantName: string) {
  return store.participants.findIndex(
    (entry) => entry.traqId === participantName || entry.name.trim().toLowerCase() === participantName.toLowerCase(),
  );
}

function buildDefaultResponses(candidateDates: string[], current: Record<string, DayAvailability>) {
  return Object.fromEntries(candidateDates.map((date) => [date, current[date] ?? "NO"])) as Record<string, DayAvailability>;
}

function requirePoll(id: string): StubPollRecord {
  const poll = stubStore.polls.find((entry) => entry.id === id);
  if (!poll) {
    throw new Error("調整が見つかりません");
  }
  return poll;
}

function parseJsonBody(init?: RequestInit): unknown {
  if (!init?.body || typeof init.body !== "string") {
    return {};
  }
  return JSON.parse(init.body);
}

function absoluteUrl(pathname: string): string {
  return new URL(pathname, window.location.origin).toString();
}

function buildDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = new Date(`${start}T00:00:00`);
  const limit = new Date(`${end}T00:00:00`);
  while (cursor <= limit) {
    dates.push(toIsoDate(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(date: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));
}

function nowIso(): string {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
