import { useEffect, useRef, useState } from "react";
import { Avatar } from "../../../entities/poll/Avatar";
import type { ParticipantComment } from "../../../entities/poll/model";
import { formatCommentTimestamp } from "../../../shared/lib/date";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";

export function CommentPanel(props: {
  viewerTraqId?: string | null;
  viewerIconUrl?: string | null;
  note: string;
  isEditingComment: boolean;
  ownComments: ParticipantComment[];
  headerTitle?: string;
  onNoteInput: (value: string) => void;
  onEditComment: (createdAt: string, body: string) => void;
  onCancelCommentEdit: () => void;
  onDeleteComment: (createdAt: string) => void;
  isBusy: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
  missingTraqMessage: string;
}) {
  const {
    viewerTraqId,
    viewerIconUrl,
    note,
    isEditingComment,
    ownComments,
    headerTitle,
    onNoteInput,
    onEditComment,
    onCancelCommentEdit,
    onDeleteComment,
    isBusy,
    onSubmit,
    missingTraqMessage,
  } = props;
  const hasForwardedUser = Boolean(viewerTraqId);
  const registrationDisabled = !hasForwardedUser;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [commentPendingDeletion, setCommentPendingDeletion] = useState<string | null>(null);

  useEffect(() => {
    if (isEditingComment) {
      textareaRef.current?.focus();
    }
  }, [isEditingComment]);

  return (
    <form
      className="dashboard-card stack"
      aria-busy={isBusy}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
    >
      <div className="section-head">
        <h2>{headerTitle ?? "コメント"}</h2>
      </div>

      {hasForwardedUser ? (
        <div className="identity-box">
          <Avatar
            iconUrl={viewerIconUrl ?? undefined}
            name={viewerTraqId ?? ""}
            traqId={viewerTraqId ?? undefined}
          />
          <div className="stack tight">
            <strong>{viewerTraqId}</strong>
          </div>
        </div>
      ) : (
        <div className="identity-box">
          <div className="stack tight">
            <strong>{missingTraqMessage}</strong>
          </div>
        </div>
      )}

      <label className="field">
        <span className="visually-hidden">{isEditingComment ? "コメントを編集" : "コメント"}</span>
        <textarea
          ref={textareaRef}
          name="note"
          value={note}
          rows={4}
          placeholder="コメントを入力"
          disabled={registrationDisabled || isBusy}
          onChange={(event) => onNoteInput(event.target.value)}
        />
      </label>
      <div className="button-row">
        <button
          className="primary-button"
          type="submit"
          disabled={registrationDisabled || isBusy || !note.trim()}
        >
          {isBusy ? "処理中…" : isEditingComment ? "コメントを更新" : "コメントを投稿"}
        </button>
        {isEditingComment ? (
          <button
            className="secondary-button"
            type="button"
            disabled={isBusy}
            onClick={() => {
              onCancelCommentEdit();
              window.requestAnimationFrame(() => textareaRef.current?.focus());
            }}
          >
            編集をやめる
          </button>
        ) : null}
      </div>

      {hasForwardedUser && ownComments.length ? (
        <div className="subsection-card stack">
          <div className="section-head">
            <h2>自分のコメント {ownComments.length}件</h2>
          </div>
          {ownComments.length ? (
            ownComments.map((comment) => (
              <div className="participant-comment" key={`${comment.createdAt}-${comment.body}`}>
                <div className="comment-meta">
                  <span>{formatCommentTimestamp(comment.createdAt)}</span>
                  <div className="comment-actions">
                    <button
                      className="secondary-button comment-edit-button"
                      type="button"
                      disabled={isBusy}
                      onClick={() => onEditComment(comment.createdAt, comment.body)}
                    >
                      編集
                    </button>
                    <button
                      className="secondary-button danger-button comment-edit-button"
                      type="button"
                      disabled={isBusy}
                      onClick={() => setCommentPendingDeletion(comment.createdAt)}
                    >
                      削除
                    </button>
                  </div>
                </div>
                <div>{comment.body}</div>
              </div>
            ))
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={commentPendingDeletion !== null}
        title="コメントを削除しますか？"
        confirmLabel="削除"
        disabled={isBusy}
        onCancel={() => setCommentPendingDeletion(null)}
        onConfirm={() => {
          if (commentPendingDeletion === null) {
            return;
          }
          const createdAt = commentPendingDeletion;
          setCommentPendingDeletion(null);
          onDeleteComment(createdAt);
        }}
      />
    </form>
  );
}
