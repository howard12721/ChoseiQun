import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import type { EditorState, SetupSelection } from "./app/types";
import { resolveRoute } from "./app/routing";
import { Shell, Hero, type FlashMessage } from "./components/Shell";
import { AnswerCalendarPage } from "./pages/AnswerCalendarPage";
import { HomePage } from "./pages/HomePage";
import { PollPage } from "./pages/PollPage";
import { ResultsPage } from "./pages/ResultsPage";
import { SetupPage } from "./pages/SetupPage";
import type { DayAvailability, PollDetail, PollListItem } from "./types";
import { addMonths, initialMonthForDates, sortDates, startOfMonth } from "./utils/date";
import { hydrateEditor, isViewerParticipant } from "./utils/poll";
import { copyAndFlash, toErrorMessage } from "./utils/ui";

const INITIAL_EDITOR_STATE: EditorState = {
  name: "",
  traqId: "",
  note: "",
  editingCommentCreatedAt: null,
  responses: {},
};

type PendingAction = "setup" | "availability" | "comment" | "delete-comment";

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
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const allowSavedNavigationRef = useRef(false);
  const hasUnsavedAvailability = useMemo(() => {
    if (!poll || route.kind !== "poll") {
      return false;
    }
    const savedResponses = poll.participants.find((participant) =>
      isViewerParticipant(participant, poll)
    )?.responses;
    return poll.candidateDates.some(
      (date) => editor.responses[date] !== (savedResponses?.[date] ?? "NO"),
    );
  }, [editor.responses, poll, route.kind]);

  useEffect(() => {
    void loadInitialState();
  }, []);

  useEffect(() => {
    if (!flash) {
      return;
    }
    if (flash.tone === "error") {
      return;
    }
    const timeout = window.setTimeout(() => setFlash(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [flash]);

  useEffect(() => {
    if (!hasUnsavedAvailability) {
      return;
    }
    function confirmLeave(event: BeforeUnloadEvent) {
      if (allowSavedNavigationRef.current) {
        return;
      }
      event.preventDefault();
    }
    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  }, [hasUnsavedAvailability]);

  function showFlash(message: string, tone: FlashMessage["tone"] = "info") {
    setFlash({ message, tone });
  }

  async function loadInitialState() {
    setLoading(true);
    setError(null);

    try {
      if (route.kind === "setup") {
        const nextPoll = await api<PollDetail>(`/api/setup/${route.id}`);
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
    if (!poll || route.kind !== "setup" || pendingAction) {
      return;
    }
    if (!setupSelection.selectedDates.length) {
      showFlash("候補日を1日以上選んでください", "error");
      return;
    }

    const payload = {
      title: `${formData.get("title") ?? ""}`.trim(),
      description: `${formData.get("description") ?? ""}`.trim(),
      candidateDates: sortDates(setupSelection.selectedDates),
    };
    setPendingAction("setup");
    try {
      const nextPoll = await api<PollDetail>(`/api/setup/${poll.id}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      window.location.assign(nextPoll.participantUrl);
    } finally {
      setPendingAction(null);
    }
  }

  async function persistAvailability(nextResponses: Record<string, DayAvailability>) {
    if (!poll || route.kind !== "poll" || pendingAction) {
      return;
    }

    const forwardedTraqId = poll.viewerTraqId ?? "";
    if (!forwardedTraqId) {
      showFlash("traQ 経由で開いたページから回答してください", "error");
      return;
    }

    const isInitialResponse = !poll.participants.some((participant) =>
      isViewerParticipant(participant, poll)
    );
    setPendingAction("availability");
    try {
      const nextPoll = await api<PollDetail>(`/api/polls/${poll.id}/availability`, {
        method: "POST",
        body: JSON.stringify({
          name: forwardedTraqId,
          responses: nextResponses,
        }),
      });
      if (isInitialResponse) {
        allowSavedNavigationRef.current = true;
        window.location.assign(`/polls/${poll.id}/results`);
        return;
      }
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
      showFlash("回答を保存しました", "success");
    } finally {
      setPendingAction(null);
    }
  }

  async function submitComment(formData: FormData) {
    if (!poll || pendingAction || (route.kind !== "poll" && route.kind !== "results")) {
      return;
    }

    const forwardedTraqId = poll.viewerTraqId ?? "";
    if (!forwardedTraqId) {
      showFlash("traQ 経由で開いたページから回答してください", "error");
      return;
    }

    const comment = `${formData.get("note") ?? ""}`.trim();
    if (!comment) {
      showFlash("コメントを入力してください", "error");
      return;
    }

    const isEditingComment = Boolean(editor.editingCommentCreatedAt);
    setPendingAction("comment");
    try {
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
      showFlash(isEditingComment ? "コメントを更新しました" : "コメントを投稿しました", "success");
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteComment(createdAt: string) {
    if (!poll || pendingAction || (route.kind !== "poll" && route.kind !== "results")) {
      return;
    }

    const forwardedTraqId = poll.viewerTraqId ?? "";
    if (!forwardedTraqId) {
      showFlash("traQ 経由で開いたページから回答してください", "error");
      return;
    }

    setPendingAction("delete-comment");
    try {
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
      showFlash("コメントを削除しました", "success");
    } finally {
      setPendingAction(null);
    }
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
    allowSavedNavigationRef.current = false;
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
      <Shell onDismissFlash={() => setFlash(null)}>
        <Hero title="読み込み中" body="調整データを取得しています。" loading />
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell flash={flash} onDismissFlash={() => setFlash(null)}>
        <Hero
          title="読み込みに失敗しました"
          body={error}
          actionLabel="もう一度試す"
          onAction={() => void loadInitialState()}
        />
      </Shell>
    );
  }

  if (route.kind === "home") {
    return (
      <Shell flash={flash} onDismissFlash={() => setFlash(null)}>
        <HomePage openPolls={openPolls} onCopy={(value) => copyAndFlash(value, showFlash)} />
      </Shell>
    );
  }

  if (route.kind === "answers") {
    return (
      <Shell flash={flash} onDismissFlash={() => setFlash(null)}>
        <AnswerCalendarPage openPolls={openPolls} />
      </Shell>
    );
  }

  if (!poll) {
    return (
      <Shell flash={flash} onDismissFlash={() => setFlash(null)}>
        <Hero title="調整が見つかりません" body="URL を確認してください。" />
      </Shell>
    );
  }

  if (route.kind === "setup") {
    return (
      <Shell flash={flash} onDismissFlash={() => setFlash(null)}>
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
          onGoToCurrentMonth={() =>
            setSetupSelection((current) => ({
              ...current,
              viewMonth: startOfMonth(new Date()),
            }))
          }
          onClearDates={() => replaceSetupDates([])}
          isSaving={pendingAction === "setup"}
          onSubmit={(formData) =>
            submitSetup(formData).catch((caught) => {
              showFlash(toErrorMessage(caught), "error");
            })
          }
          onCopy={(value) => copyAndFlash(value, showFlash)}
        />
      </Shell>
    );
  }

  return (
    <Shell flash={flash} onDismissFlash={() => setFlash(null)}>
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
              showFlash(toErrorMessage(caught), "error");
            });
          }}
          isCommentBusy={pendingAction === "comment" || pendingAction === "delete-comment"}
          onSubmit={(formData) =>
            submitComment(formData).catch((caught) => {
              showFlash(toErrorMessage(caught), "error");
            })
          }
          onCopy={(value) => copyAndFlash(value, showFlash)}
        />
      ) : (
        <PollPage
          poll={poll}
          editor={editor}
          onPickAvailability={applyParticipantSelection}
          hasUnsavedChanges={hasUnsavedAvailability}
          isSavingAvailability={pendingAction === "availability"}
          onSubmitAvailability={() =>
            submitAvailability().catch((caught) => {
              showFlash(toErrorMessage(caught), "error");
            })
          }
          onCopy={(value) => copyAndFlash(value, showFlash)}
        />
      )}
    </Shell>
  );
}

export default App;
