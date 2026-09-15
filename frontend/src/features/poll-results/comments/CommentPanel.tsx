import { useEffect, useRef } from "react";
import { Avatar } from "../../../entities/poll/Avatar";
import { Icon } from "../../../shared/ui/Icon";

export function CommentPanel({
  viewerTraqId,
  viewerIconUrl,
  note,
  isEditingComment,
  onNoteInput,
  onCancelCommentEdit,
  isBusy,
  onSubmit,
}: {
  viewerTraqId?: string | null;
  viewerIconUrl?: string | null;
  note: string;
  isEditingComment: boolean;
  onNoteInput: (value: string) => void;
  onCancelCommentEdit: () => void;
  isBusy: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (isEditingComment) textareaRef.current?.focus();
  }, [isEditingComment]);
  return (
    <form
      className="comment-form stack"
      aria-busy={isBusy}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
    >
      <h2>
        <Icon name="comment" />
        {isEditingComment ? "コメントを編集" : "コメントを投稿"}
      </h2>
      {viewerTraqId ? (
        <div className="identity-box">
          <Avatar
            name={viewerTraqId}
            traqId={viewerTraqId}
            iconUrl={viewerIconUrl ?? undefined}
          />
          <strong>{viewerTraqId}</strong>
        </div>
      ) : (
        <p className="inline-notice">traQから開くとコメントできます</p>
      )}
      <textarea
        ref={textareaRef}
        aria-label={isEditingComment ? "コメントを編集" : "コメント"}
        name="note"
        value={note}
        onChange={(event) => onNoteInput(event.target.value)}
        placeholder="コメントを入力"
        maxLength={1000}
        disabled={!viewerTraqId || isBusy}
      />
      <div className="button-row">
        <button
          className="primary-button"
          type="submit"
          disabled={!viewerTraqId || isBusy || !note.trim()}
        >
          <Icon name="send" />
          {isBusy
            ? "処理中…"
            : isEditingComment
              ? "コメントを更新"
              : "コメントを投稿"}
        </button>
        {isEditingComment && (
          <button
            className="secondary-button"
            type="button"
            onClick={onCancelCommentEdit}
            disabled={isBusy}
          >
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}
