import type { ParticipantComment, PollDetail } from "../types";
import { formatCommentTimestamp } from "../utils/date";
import { Avatar } from "./Avatar";

export function CommentPanel(props: {
  poll: PollDetail;
  note: string;
  isEditingComment: boolean;
  ownComments: ParticipantComment[];
  headerTitle?: string;
  onNoteInput: (value: string) => void;
  onEditComment: (createdAt: string, body: string) => void;
  onCancelCommentEdit: () => void;
  onDeleteComment: (createdAt: string) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  missingTraqMessage: string;
}) {
  const {
    poll,
    note,
    isEditingComment,
    ownComments,
    headerTitle,
    onNoteInput,
    onEditComment,
    onCancelCommentEdit,
    onDeleteComment,
    onSubmit,
    missingTraqMessage,
  } = props;
  const hasForwardedUser = Boolean(poll.viewerTraqId);
  const registrationDisabled = !hasForwardedUser;

  return (
    <form
      className="dashboard-card stack"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
    >
      {headerTitle ? (
        <div className="section-head">
          <h2>{headerTitle}</h2>
          <span className="count-badge">{ownComments.length}件</span>
        </div>
      ) : null}

      {hasForwardedUser ? (
        <div className="identity-box">
          <Avatar
            iconUrl={poll.viewerIconUrl ?? undefined}
            name={poll.viewerTraqId ?? ""}
            traqId={poll.viewerTraqId ?? undefined}
          />
          <div className="stack tight">
            <strong>{poll.viewerTraqId}</strong>
          </div>
        </div>
      ) : (
        <div className="identity-box">
          <div className="stack tight">
            <strong>traQ ID を取得できませんでした</strong>
            <span className="muted-text">{missingTraqMessage}</span>
          </div>
        </div>
      )}

      <label className="field">
        <span>{isEditingComment ? "コメントを編集" : "コメント"}</span>
        <textarea
          name="note"
          value={note}
          placeholder="コメントを投稿できます"
          disabled={registrationDisabled}
          onChange={(event) => onNoteInput(event.target.value)}
        />
      </label>
      <div className="button-row">
        <button className="primary-button" type="submit" disabled={registrationDisabled}>
          {isEditingComment ? "コメントを更新する" : "コメントを投稿する"}
        </button>
        {isEditingComment ? (
          <button className="secondary-button" type="button" onClick={onCancelCommentEdit}>
            編集をやめる
          </button>
        ) : null}
      </div>

      {hasForwardedUser ? (
        <div className="subsection-card stack">
          <div className="section-head">
            <h2>自分のコメント</h2>
            <span className="count-badge">{ownComments.length}件</span>
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
                      onClick={() => onEditComment(comment.createdAt, comment.body)}
                    >
                      編集
                    </button>
                    <button
                      className="secondary-button comment-edit-button"
                      type="button"
                      onClick={() => onDeleteComment(comment.createdAt)}
                    >
                      削除
                    </button>
                  </div>
                </div>
                <div>{comment.body}</div>
              </div>
            ))
          ) : (
            <div className="empty-state">まだコメントはありません。</div>
          )}
        </div>
      ) : null}
    </form>
  );
}
