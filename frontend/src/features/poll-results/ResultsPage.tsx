import { useState } from "react";
import { ResultStatusBadge } from "../../entities/poll/AvailabilityStatus";
import { Avatar } from "../../entities/poll/Avatar";
import type { PollDetail } from "../../entities/poll/model";
import {
  bestSummaryDay,
  candidateTime,
  isViewerParticipant,
  participantCommentsForDisplay,
  pollCandidates,
  resolveParticipantIconUrl,
} from "../../entities/poll/selectors";
import { formatCommentTimestamp, formatDateLabel } from "../../shared/lib/date";
import { Icon } from "../../shared/ui/Icon";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { CommentPanel } from "./comments/CommentPanel";
import type { CommentDraft } from "./comments/model";

export function ResultsPage(props: {
  poll: PollDetail;
  commentDraft: CommentDraft;
  onNoteInput: (value: string) => void;
  onEditComment: (createdAt: string, body: string) => void;
  onCancelCommentEdit: () => void;
  onDeleteComment: (createdAt: string) => void;
  isCommentBusy: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const {
    poll,
    commentDraft,
    onNoteInput,
    onEditComment,
    onCancelCommentEdit,
    onDeleteComment,
    isCommentBusy,
    onSubmit,
  } = props;
  const [pendingDeletion, setPendingDeletion] = useState<string | null>(null);
  const candidates = pollCandidates(poll);
  const bestDay = poll.participants.length ? bestSummaryDay(poll) : undefined;
  const comments = poll.participants
    .flatMap((participant) =>
      participantCommentsForDisplay(participant).map((comment) => ({
        participant,
        comment,
      })),
    )
    .sort((a, b) => a.comment.createdAt.localeCompare(b.comment.createdAt));

  return (
    <>
      <header className="page-header">
        <h1>{poll.title}</h1>
      </header>
      <div className="results-stack">
        <section className="stack results-matrix-section">
          <div className="section-head">
            <h2>
              <Icon name="users" />
              参加者ごとの回答
            </h2>
          </div>
          <p className="scroll-hint">左右にスクロールして確認</p>
          <div
            className="results-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="参加者ごとの回答表"
          >
            <table className="response-matrix">
              <caption className="visually-hidden">
                参加者ごとの候補日時への回答
              </caption>
              <thead>
                <tr>
                  <th scope="col">参加者</th>
                  {candidates.map((candidate) => (
                    <th
                      key={candidate.candidateKey}
                      scope="col"
                      className={
                        candidate.candidateKey === bestDay?.candidateKey
                          ? "is-best-day"
                          : ""
                      }
                    >
                      <span>
                        {candidate.candidateKey === bestDay?.candidateKey && (
                          <Icon name="star" />
                        )}
                        {formatDateLabel(candidate.date)}
                      </span>
                      {candidate.startTime && (
                        <small>{candidateTime(candidate)}</small>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {poll.participants.map((participant) => (
                  <tr key={participant.traqId ?? participant.name}>
                    <th scope="row" title={participant.name}>
                      <div className="participant-summary">
                        <Avatar
                          name={participant.name}
                          iconUrl={resolveParticipantIconUrl(
                            participant,
                            poll.viewerTraqId,
                            poll.viewerIconUrl,
                          )}
                          traqId={participant.traqId ?? undefined}
                        />
                        <span className="participant-summary__name">{participant.name}</span>
                      </div>
                    </th>
                    {candidates.map((candidate) => (
                      <td key={candidate.candidateKey}>
                        <ResultStatusBadge
                          value={
                            participant.responses[candidate.candidateKey] ??
                            "NO"
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!poll.participants.length && (
            <p className="empty-state">まだ回答はありません。</p>
          )}
        </section>
        <section className="results-comments-layout">
          <CommentPanel
            viewerTraqId={poll.viewerTraqId}
            viewerIconUrl={poll.viewerIconUrl}
            note={commentDraft.body}
            isEditingComment={Boolean(commentDraft.editingCreatedAt)}
            onNoteInput={onNoteInput}
            onCancelCommentEdit={onCancelCommentEdit}
            isBusy={isCommentBusy}
            onSubmit={onSubmit}
          />
          <section className="comments-list stack">
            <h2>コメント {comments.length}件</h2>
            {comments.length ? (
              comments.map(({ participant, comment }, index) => (
                <article
                  className="comment-item"
                  key={`${participant.name}-${comment.createdAt}-${index}`}
                >
                  <header className="comment-item__header">
                    <Avatar
                      name={participant.name}
                      iconUrl={resolveParticipantIconUrl(
                        participant,
                        poll.viewerTraqId,
                        poll.viewerIconUrl,
                      )}
                      traqId={participant.traqId ?? undefined}
                    />
                    <div>
                      <strong>{participant.name}</strong>
                      <time dateTime={comment.createdAt}>
                        {formatCommentTimestamp(comment.createdAt)}
                      </time>
                    </div>
                  </header>
                  <p>{comment.body}</p>
                  {isViewerParticipant(participant, poll) && (
                    <div className="comment-actions">
                      <button
                        className="text-action"
                        type="button"
                        disabled={isCommentBusy}
                        onClick={() =>
                          onEditComment(comment.createdAt, comment.body)
                        }
                      >
                        編集
                        <Icon name="edit" />
                      </button>
                      <button
                        className="text-action danger-button"
                        type="button"
                        disabled={isCommentBusy}
                        onClick={() => setPendingDeletion(comment.createdAt)}
                      >
                        削除
                        <Icon name="trash" />
                      </button>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <p className="empty-state">まだコメントはありません。</p>
            )}
          </section>
        </section>
        <a className="secondary-button results-back" href={`/polls/${poll.id}`}>
          <Icon name="left" />
          回答画面へ戻る
        </a>
      </div>
      <ConfirmDialog
        open={pendingDeletion !== null}
        title="コメントを削除しますか？"
        confirmLabel="削除"
        disabled={isCommentBusy}
        onCancel={() => setPendingDeletion(null)}
        onConfirm={() => {
          if (pendingDeletion) onDeleteComment(pendingDeletion);
          setPendingDeletion(null);
        }}
      />
    </>
  );
}
