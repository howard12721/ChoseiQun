import { useState } from "react";
import { useFlash } from "../shared/ui/useFlash";
import { usePollDetail } from "../entities/poll/usePollResource";
import { createComment, deleteComment, updateComment } from "../features/poll-results/comments/api";
import { EMPTY_COMMENT_DRAFT, type CommentDraft } from "../features/poll-results/comments/model";
import { ResultsPage } from "../features/poll-results/ResultsPage";
import { copyAndNotify } from "../shared/lib/clipboard";
import { toErrorMessage } from "../shared/lib/errors";
import { ErrorRoute, LoadingRoute, MissingPollRoute } from "../shared/ui/RouteState";
import { Shell } from "../shared/ui/Shell";

type PendingCommentAction = "save" | "delete" | null;

export function ResultsRoute({ pollId }: { pollId: string }) {
  const resource = usePollDetail(pollId);
  const { flash, dismissFlash, showFlash } = useFlash();
  const [draft, setDraft] = useState<CommentDraft>(EMPTY_COMMENT_DRAFT);
  const [pendingAction, setPendingAction] = useState<PendingCommentAction>(null);

  async function submitComment(formData: FormData) {
    const poll = resource.data;
    if (!poll || pendingAction) {
      return;
    }
    if (!poll.viewerTraqId) {
      showFlash("traQ 経由で開いたページから回答してください", "error");
      return;
    }
    const comment = `${formData.get("note") ?? ""}`.trim();
    if (!comment) {
      showFlash("コメントを入力してください", "error");
      return;
    }

    setPendingAction("save");
    try {
      const nextPoll = draft.editingCreatedAt
        ? await updateComment(poll.id, draft.editingCreatedAt, comment)
        : await createComment(poll.id, comment);
      resource.replace(nextPoll);
      setDraft(EMPTY_COMMENT_DRAFT);
      showFlash(draft.editingCreatedAt ? "コメントを更新しました" : "コメントを投稿しました", "success");
    } finally {
      setPendingAction(null);
    }
  }

  async function removeComment(createdAt: string) {
    const poll = resource.data;
    if (!poll || pendingAction) {
      return;
    }
    if (!poll.viewerTraqId) {
      showFlash("traQ 経由で開いたページから回答してください", "error");
      return;
    }

    setPendingAction("delete");
    try {
      resource.replace(await deleteComment(poll.id, createdAt));
      setDraft((current) =>
        current.editingCreatedAt === createdAt ? EMPTY_COMMENT_DRAFT : current
      );
      showFlash("コメントを削除しました", "success");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <Shell flash={flash} onDismissFlash={dismissFlash}>
      {resource.loading ? <LoadingRoute /> : null}
      {!resource.loading && resource.error ? (
        <ErrorRoute error={resource.error} onRetry={resource.reload} />
      ) : null}
      {!resource.loading && !resource.error && !resource.data ? <MissingPollRoute /> : null}
      {!resource.loading && !resource.error && resource.data ? (
        <ResultsPage
          poll={resource.data}
          commentDraft={draft}
          onNoteInput={(body) => setDraft((current) => ({ ...current, body }))}
          onEditComment={(editingCreatedAt, body) => setDraft({ body, editingCreatedAt })}
          onCancelCommentEdit={() => setDraft(EMPTY_COMMENT_DRAFT)}
          onDeleteComment={(createdAt) => {
            void removeComment(createdAt).catch((caught) => showFlash(toErrorMessage(caught), "error"));
          }}
          isCommentBusy={pendingAction !== null}
          onSubmit={(formData) =>
            submitComment(formData).catch((caught) => showFlash(toErrorMessage(caught), "error"))
          }
          onCopy={(value) => copyAndNotify(value, showFlash)}
        />
      ) : null}
    </Shell>
  );
}
