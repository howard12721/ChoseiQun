import type { EditorState } from "../app/types";
import { Avatar } from "../components/Avatar";
import { CommentPanel } from "../components/CommentPanel";
import { MetricCard } from "../components/MetricCard";
import { ParticipantComments } from "../components/ParticipantComments";
import { ResultStatusBadge } from "../components/AvailabilityStatus";
import type { PollDetail } from "../types";
import { formatMonthDay, sortDates } from "../utils/date";
import {
  bestSummaryDay,
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
    onSubmit,
    onCopy,
  } = props;
  const sortedDates = sortDates(poll.candidateDates);
  const bestDay = bestSummaryDay(poll);
  const ownParticipant = poll.participants.find((participant) => participant.traqId === poll.viewerTraqId);
  const ownComments = ownParticipant ? participantCommentsForDisplay(ownParticipant) : [];
  const isEditingComment = Boolean(editor.editingCommentCreatedAt);

  return (
    <>
      <section className="page-header">
        <span className="eyebrow">Results</span>
        <div className="page-header-title-row">
          <h1>{poll.title}</h1>
          <button className="secondary-button" type="button" onClick={() => onCopy(window.location.href)}>
            リンクをコピー
          </button>
        </div>
        <p>集計結果</p>
      </section>

      <section className="metrics-grid">
        <MetricCard
          label="Top Match"
          value={bestDay ? formatMonthDay(bestDay.date) : "--"}
          hint={bestDay ? `${bestDay.yesCount}人可能 / ${bestDay.maybeCount}人多分 / ${bestDay.noCount}人不可` : "まだ集計対象がありません"}
          accent={Boolean(bestDay)}
        />
        <MetricCard label="Participants" value={`${poll.participants.length}`} hint="回答した参加者数" />
        <MetricCard label="Candidates" value={`${sortedDates.length}`} hint="設定されている候補日数" />
      </section>

      <section className="results-stack">
        <div className="dashboard-card stack">
          <div className="button-row">
            <a className="secondary-button button-link" href={`/polls/${poll.id}`}>
              入力ページへ戻る
            </a>
          </div>
          <div className="section-head">
            <h2>日別集計</h2>
            <span className="count-badge">{sortedDates.length}日</span>
          </div>
          {poll.summary.days.length ? (
            <div className="results-table-wrap">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>日付</th>
                    <th><ResultStatusBadge value="YES" compact /></th>
                    <th><ResultStatusBadge value="MAYBE" compact /></th>
                    <th><ResultStatusBadge value="NO" compact /></th>
                  </tr>
                </thead>
                <tbody>
                  {[...poll.summary.days]
                    .sort((left, right) => left.date.localeCompare(right.date))
                    .map((day) => (
                      <tr key={day.date}>
                        <td>
                          <div className="availability-date">{day.label}</div>
                          <div className="availability-date-subtle">{day.date}</div>
                        </td>
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
            <span className="count-badge">{poll.participants.length}人</span>
          </div>
          {poll.participants.length ? (
            <div className="results-table-wrap">
              <table className="results-table response-matrix">
                <thead>
                  <tr>
                    <th>参加者</th>
                    {sortedDates.map((date) => (
                      <th key={date}>{formatMonthDay(date)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {poll.participants.map((participant) => (
                    <tr key={participant.traqId ?? participant.name}>
                      <td>
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
                      </td>
                      {sortedDates.map((date) => {
                        const value = participant.responses[date] ?? "NO";
                        return (
                          <td key={date}>
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
            onSubmit={onSubmit}
            missingTraqMessage="traQ IDの取得に失敗しました"
          />

          <div className="dashboard-card stack">
            <div className="section-head">
              <h2>コメント</h2>
              <span className="count-badge">
                {poll.participants.reduce((count, participant) => count + participantCommentsForDisplay(participant).length, 0)}件
              </span>
            </div>
            {poll.participants.length ? (
              poll.participants.map((participant) => (
                <article className="participant-card" key={`comment-${participant.traqId ?? participant.name}`}>
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
