import type { EditorState } from "../app/types";
import { Avatar } from "../components/Avatar";
import { CommentPanel } from "../components/CommentPanel";
import { ParticipantComments } from "../components/ParticipantComments";
import { ResultStatusBadge } from "../components/AvailabilityStatus";
import type { PollDetail } from "../types";
import { formatMonthDay, sortDates } from "../utils/date";
import {
  bestSummaryDay,
  isViewerParticipant,
  participantCommentsForDisplay,
  resolveParticipantIconUrl,
  resolveTraqId,
} from "../utils/poll";

export function ResultsPage(props: {
  poll: PollDetail;
  editor: EditorState;
  onNoteInput: (value: string) => void;
  onEditComment: (createdAt: string, body: string) => void;
  onCancelCommentEdit: () => void;
  onDeleteComment: (createdAt: string) => void;
  isCommentBusy: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
  onCopy: (value: string) => void;
}) {
  const {
    poll,
    editor,
    onNoteInput,
    onEditComment,
    onCancelCommentEdit,
    onDeleteComment,
    isCommentBusy,
    onSubmit,
    onCopy,
  } = props;
  const sortedDates = sortDates(poll.candidateDates);
  const bestDay = poll.participants.length ? bestSummaryDay(poll) : undefined;
  const ownParticipant = poll.participants.find((participant) => isViewerParticipant(participant, poll));
  const ownComments = ownParticipant ? participantCommentsForDisplay(ownParticipant) : [];
  const isEditingComment = Boolean(editor.editingCommentCreatedAt);
  const commenters = poll.participants.filter(
    (participant) => participantCommentsForDisplay(participant).length > 0,
  );
  const totalCommentCount = commenters.reduce(
    (count, participant) => count + participantCommentsForDisplay(participant).length,
    0,
  );

  return (
    <>
      <section className="page-header">
        <div className="page-header-title-row">
          <h1>{poll.title}</h1>
          <div className="button-row page-header-actions">
            {poll.setupUrl ? (
              <a className="secondary-button" href={poll.setupUrl}>
                設定
              </a>
            ) : null}
            <button className="secondary-button" type="button" onClick={() => onCopy(window.location.href)}>
              リンクをコピー
            </button>
          </div>
        </div>
      </section>

      <section className="results-stack">
        <div className="dashboard-card stack">
          <div className="section-head">
            <h2>日別集計</h2>
          </div>
          {poll.summary.days.length ? (
            <div className="results-table-wrap">
              <table className="results-table">
                <caption className="visually-hidden">候補日ごとの回答集計</caption>
                <thead>
                  <tr>
                    <th scope="col">日付</th>
                    <th scope="col"><span className="table-status-heading"><ResultStatusBadge value="YES" decorative /><span>参加可</span></span></th>
                    <th scope="col"><span className="table-status-heading"><ResultStatusBadge value="MAYBE" decorative /><span>たぶん</span></span></th>
                    <th scope="col"><span className="table-status-heading"><ResultStatusBadge value="NO" decorative /><span>不可</span></span></th>
                  </tr>
                </thead>
                <tbody>
                  {[...poll.summary.days]
                    .sort((left, right) => left.date.localeCompare(right.date))
                    .map((day) => (
                      <tr className={day.date === bestDay?.date ? "is-best-day" : ""} key={day.date}>
                        <th scope="row">
                          <div className="availability-date">{day.label}</div>
                          <div className="availability-date-subtle">{day.date}</div>
                        </th>
                        <td>{day.yesCount}</td>
                        <td>{day.maybeCount}</td>
                        <td>{day.noCount}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">まだ集計できる回答がありません。</div>
          )}
        </div>

        <div className="dashboard-card stack">
          <div className="section-head">
            <h2>参加者ごとの回答</h2>
          </div>
          {poll.participants.length ? (
            <div className="results-table-wrap">
              <table className="results-table response-matrix">
                <caption className="visually-hidden">参加者ごとの候補日への回答</caption>
                <thead>
                  <tr>
                    <th scope="col">参加者</th>
                    {sortedDates.map((date) => (
                      <th scope="col" key={date}>{formatMonthDay(date)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {poll.participants.map((participant) => (
                    <tr key={participant.userId ?? participant.traqId ?? participant.name}>
                      <th scope="row">
                        <div className="participant-summary">
                          <Avatar
                            iconUrl={resolveParticipantIconUrl(participant, poll.viewerTraqId, poll.viewerIconUrl)}
                            name={participant.name}
                            traqId={resolveTraqId(participant.name, participant.traqId ?? undefined)}
                          />
                          <div className="stack tight">
                            <strong>{participant.name}</strong>
                            {participant.traqId && participant.traqId !== participant.name ? (
                              <span className="muted-text">@{participant.traqId}</span>
                            ) : null}
                          </div>
                        </div>
                      </th>
                      {sortedDates.map((date) => {
                        const value = participant.responses[date] ?? "NO";
                        return (
                          <td className={`response-cell response-cell--${value.toLowerCase()}`} key={date}>
                            <ResultStatusBadge value={value} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">まだ回答はありません。</div>
          )}
          <div className="button-row">
            <a className="secondary-button button-link" href={`/polls/${poll.id}`}>
              回答に戻る
            </a>
          </div>
        </div>

        <section className="results-comments-layout">
          <CommentPanel
            poll={poll}
            note={editor.note}
            isEditingComment={isEditingComment}
            ownComments={ownComments}
            headerTitle="コメントを投稿"
            onNoteInput={onNoteInput}
            onEditComment={onEditComment}
            onCancelCommentEdit={onCancelCommentEdit}
            onDeleteComment={onDeleteComment}
            isBusy={isCommentBusy}
            onSubmit={onSubmit}
            missingTraqMessage="traQ IDの取得に失敗しました"
          />

          <div className="dashboard-card stack">
            <div className="section-head">
              <h2>コメント {totalCommentCount}件</h2>
            </div>
            {commenters.length ? (
              commenters.map((participant) => (
                <article className="participant-card" key={`comment-${participant.userId ?? participant.traqId ?? participant.name}`}>
                  <Avatar
                    iconUrl={resolveParticipantIconUrl(participant, poll.viewerTraqId, poll.viewerIconUrl)}
                    name={participant.name}
                    traqId={resolveTraqId(participant.name, participant.traqId ?? undefined)}
                  />
                  <div className="stack tight">
                    <strong>{participant.name}</strong>
                    {participant.traqId && participant.traqId !== participant.name ? (
                      <span className="muted-text">@{participant.traqId}</span>
                    ) : null}
                    <ParticipantComments participant={participant} />
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">まだコメントはありません。</div>
            )}
          </div>
        </section>
      </section>
    </>
  );
}
