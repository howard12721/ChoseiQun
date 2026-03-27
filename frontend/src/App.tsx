import { startTransition, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { EditorState, SetupSelection } from "./app/types";
import { resolveRoute } from "./app/routing";
import { Shell, Hero } from "./components/Shell";
import { HomePage } from "./pages/HomePage";
import { PollPage } from "./pages/PollPage";
import { ResultsPage } from "./pages/ResultsPage";
import { SetupPage } from "./pages/SetupPage";
import type { DayAvailability, PollDetail, PollListItem } from "./types";
import { addMonths, initialMonthForDates, sortDates, startOfMonth } from "./utils/date";
import { hydrateEditor } from "./utils/poll";
import { copyAndFlash, toErrorMessage } from "./utils/ui";

const INITIAL_EDITOR_STATE: EditorState = {
  name: "",
  traqId: "",
  note: "",
  editingCommentCreatedAt: null,
  responses: {},
};

function App() {
  const route = useMemo(() => resolveRoute(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [poll, setPoll] = useState<PollDetail | null>(null);
  const [openPolls, setOpenPolls] = useState<PollListItem[]>([]);
  const [editor, setEditor] = useState<EditorState>(INITIAL_EDITOR_STATE);
  const [setupSelection, setSetupSelection] = useState<SetupSelection>({
    selectedDates: [],
    viewMonth: startOfMonth(new Date()),
  });
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    void loadInitialState();
  }, []);

  useEffect(() => {
    if (!flash) {
      return;
    }
    const timeout = window.setTimeout(() => setFlash(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [flash]);

  async function loadInitialState() {
    setLoading(true);
    setError(null);

    try {
      if (route.kind === "setup") {
        const nextPoll = await api<PollDetail>(`/api/setup/${route.id}?token=${encodeURIComponent(route.token)}`);
        startTransition(() => {
          setPoll(nextPoll);
          setSetupSelection({
            selectedDates: sortDates(nextPoll.candidateDates),
            viewMonth: initialMonthForDates(nextPoll.candidateDates),
          });
        });
        return;
      }

      if (route.kind === "poll" || route.kind === "results") {
        const nextPoll = await api<PollDetail>(`/api/polls/${route.id}`);
        startTransition(() => {
          setPoll(nextPoll);
          setEditor(
            hydrateEditor(nextPoll, nextPoll.viewerTraqId ?? "", {
              ...INITIAL_EDITOR_STATE,
              name: nextPoll.viewerTraqId ?? "",
              traqId: nextPoll.viewerTraqId ?? "",
            }),
          );
        });
        return;
      }

      const list = await api<PollListItem[]>("/api/polls");
      startTransition(() => setOpenPolls(list));
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function submitSetup(formData: FormData) {
    if (!poll || route.kind !== "setup") {
      return;
    }
    if (!setupSelection.selectedDates.length) {
      setFlash("候補日を1日以上選んでください");
      return;
    }

    const payload = {
      title: `${formData.get("title") ?? ""}`.trim(),
      description: `${formData.get("description") ?? ""}`.trim(),
      candidateDates: sortDates(setupSelection.selectedDates),
    };
    const nextPoll = await api<PollDetail>(`/api/setup/${poll.id}?token=${encodeURIComponent(route.token)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    startTransition(() => {
      setPoll(nextPoll);
      setSetupSelection((current) => ({
        ...current,
        selectedDates: sortDates(nextPoll.candidateDates),
      }));
    });
    setFlash("候補日を保存しました");
  }

  async function persistAvailability(nextResponses: Record<string, DayAvailability>) {
    if (!poll || route.kind !== "poll") {
      return;
    }

    const forwardedTraqId = poll.viewerTraqId ?? "";
    if (!forwardedTraqId) {
      setFlash("traQ 経由で開いたページから回答してください");
      return;
    }

    const nextPoll = await api<PollDetail>(`/api/polls/${poll.id}/availability`, {
      method: "POST",
      body: JSON.stringify({
        name: forwardedTraqId,
        responses: nextResponses,
      }),
    });
    startTransition(() => {
      setPoll(nextPoll);
      setEditor((current) =>
        hydrateEditor(nextPoll, nextPoll.viewerTraqId ?? current.traqId, {
          ...current,
          name: forwardedTraqId,
          traqId: nextPoll.viewerTraqId ?? current.traqId,
          responses: nextResponses,
        }),
      );
    });
    setFlash("日程を送信しました");
  }

  async function submitComment(formData: FormData) {
    if (!poll || (route.kind !== "poll" && route.kind !== "results")) {
      return;
    }

    const forwardedTraqId = poll.viewerTraqId ?? "";
    if (!forwardedTraqId) {
      setFlash("traQ 経由で開いたページから回答してください");
      return;
    }

    const comment = `${formData.get("note") ?? ""}`.trim();
    if (!comment) {
      setFlash("コメントを入力してください");
      return;
    }

    const isEditingComment = Boolean(editor.editingCommentCreatedAt);
    const nextPoll = await api<PollDetail>(`/api/polls/${poll.id}/comments`, {
      method: isEditingComment ? "PUT" : "POST",
      body: JSON.stringify(
        isEditingComment
          ? { createdAt: editor.editingCommentCreatedAt, comment }
          : { comment },
      ),
    });
    startTransition(() => {
      setPoll(nextPoll);
      setEditor((current) =>
        hydrateEditor(nextPoll, nextPoll.viewerTraqId ?? current.traqId, {
          ...current,
          note: "",
          editingCommentCreatedAt: null,
        }),
      );
    });
    setFlash(isEditingComment ? "コメントを更新しました" : "コメントを投稿しました");
  }

  async function deleteComment(createdAt: string) {
    if (!poll || (route.kind !== "poll" && route.kind !== "results")) {
      return;
    }

    const forwardedTraqId = poll.viewerTraqId ?? "";
    if (!forwardedTraqId) {
      setFlash("traQ 経由で開いたページから回答してください");
      return;
    }

    const nextPoll = await api<PollDetail>(`/api/polls/${poll.id}/comments`, {
      method: "DELETE",
      body: JSON.stringify({ createdAt }),
    });
    startTransition(() => {
      setPoll(nextPoll);
      setEditor((current) =>
        hydrateEditor(nextPoll, nextPoll.viewerTraqId ?? current.traqId, {
          ...current,
          note: current.editingCommentCreatedAt === createdAt ? "" : current.note,
          editingCommentCreatedAt:
            current.editingCommentCreatedAt === createdAt ? null : current.editingCommentCreatedAt,
        }),
      );
    });
    setFlash("コメントを削除しました");
  }

  function toggleSetupDate(date: string) {
    setSetupSelection((current) => {
      const selected = current.selectedDates.includes(date)
        ? current.selectedDates.filter((value) => value !== date)
        : [...current.selectedDates, date];
      return {
        ...current,
        selectedDates: sortDates(selected),
      };
    });
  }

  function replaceSetupDates(dates: string[]) {
    setSetupSelection((current) => ({
      ...current,
      selectedDates: sortDates(dates),
      viewMonth: initialMonthForDates(dates),
    }));
  }

  function setSetupDates(dates: string[]) {
    setSetupSelection((current) => {
      const nextSelectedDates = sortDates(dates);
      if (
        current.selectedDates.length === nextSelectedDates.length &&
        current.selectedDates.every((value, index) => value === nextSelectedDates[index])
      ) {
        return current;
      }
      return {
        ...current,
        selectedDates: nextSelectedDates,
      };
    });
  }

  function applyParticipantSelection(date: string, value: DayAvailability) {
    setEditor((current) => {
      const nextResponses = { ...current.responses, [date]: value };
      return { ...current, responses: nextResponses };
    });
  }

  async function submitAvailability() {
    if (!poll || route.kind !== "poll") {
      return;
    }
    await persistAvailability(editor.responses);
  }

  if (loading) {
    return (
      <Shell routeKind={route.kind}>
        <Hero title="読み込み中" body="調整データを取得しています。" />
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell flash={flash} routeKind={route.kind}>
        <Hero title="読み込みに失敗しました" body={error} />
      </Shell>
    );
  }

  if (route.kind === "home") {
    return (
      <Shell flash={flash} routeKind={route.kind}>
        <HomePage openPolls={openPolls} onCopy={(value) => copyAndFlash(value, setFlash)} />
      </Shell>
    );
  }

  if (!poll) {
    return (
      <Shell flash={flash} routeKind={route.kind}>
        <Hero title="調整が見つかりません" body="URL を確認してください。" />
      </Shell>
    );
  }

  if (route.kind === "setup") {
    return (
      <Shell flash={flash} routeKind={route.kind}>
        <SetupPage
          poll={poll}
          selection={setupSelection}
          onToggleDate={toggleSetupDate}
          onSetDates={setSetupDates}
          onShiftMonth={(amount) =>
            setSetupSelection((current) => ({
              ...current,
              viewMonth: addMonths(current.viewMonth, amount),
            }))
          }
          onClearDates={() => replaceSetupDates([])}
          onSubmit={(formData) =>
            submitSetup(formData).catch((caught) => {
              setFlash(toErrorMessage(caught));
            })
          }
          onCopy={(value) => copyAndFlash(value, setFlash)}
        />
      </Shell>
    );
  }

  return (
    <Shell flash={flash} routeKind={route.kind}>
      {route.kind === "results" ? (
        <ResultsPage
          poll={poll}
          editor={editor}
          onNoteInput={(value) => setEditor((current) => ({ ...current, note: value }))}
          onEditComment={(createdAt, body) =>
            setEditor((current) => ({
              ...current,
              note: body,
              editingCommentCreatedAt: createdAt,
            }))
          }
          onCancelCommentEdit={() =>
            setEditor((current) => ({
              ...current,
              note: "",
              editingCommentCreatedAt: null,
            }))
          }
          onDeleteComment={(createdAt) => {
            void deleteComment(createdAt).catch((caught) => {
              setFlash(toErrorMessage(caught));
            });
          }}
          onSubmit={(formData) =>
            submitComment(formData).catch((caught) => {
              setFlash(toErrorMessage(caught));
            })
          }
          onCopy={(value) => copyAndFlash(value, setFlash)}
        />
      ) : (
        <PollPage
          poll={poll}
          editor={editor}
          onNoteInput={(value) => setEditor((current) => ({ ...current, note: value }))}
          onEditComment={(createdAt, body) =>
            setEditor((current) => ({
              ...current,
              note: body,
              editingCommentCreatedAt: createdAt,
            }))
          }
          onCancelCommentEdit={() =>
            setEditor((current) => ({
              ...current,
              note: "",
              editingCommentCreatedAt: null,
            }))
          }
          onDeleteComment={(createdAt) => {
            void deleteComment(createdAt).catch((caught) => {
              setFlash(toErrorMessage(caught));
            });
          }}
          onPickAvailability={applyParticipantSelection}
          onSubmitAvailability={() =>
            submitAvailability().catch((caught) => {
              setFlash(toErrorMessage(caught));
            })
          }
          onSubmit={(formData) =>
            submitComment(formData).catch((caught) => {
              setFlash(toErrorMessage(caught));
            })
          }
          onCopy={(value) => copyAndFlash(value, setFlash)}
        />
      )}
    </Shell>
  );
}

export default App;
