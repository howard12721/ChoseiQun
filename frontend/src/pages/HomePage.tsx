import type { PollListItem } from "../types";
import { formatCandidateSummary } from "../utils/date";
import { belongsToAnsweredPollList } from "../utils/pollList";

export function HomePage({ openPolls, onCopy }: { openPolls: PollListItem[]; onCopy: (value: string) => void }) {
  const createdPolls = openPolls.filter((poll) => poll.createdByViewer);
  const answeredPolls = openPolls.filter(belongsToAnsweredPollList);

  return (
    <section className="home-stack">
      <div className="hero-card stack">
        <h1>調整くん</h1>
        <div className="command-box" aria-label="日程調整を開始するコマンド">
          <code>@BOT_chosei イベント名</code>
          <button className="primary-button" type="button" onClick={() => onCopy("@BOT_chosei イベント名")}>
            コピー
          </button>
        </div>
      </div>

      <PollListSection
        id="created-polls"
        title="作成した日程調整"
        polls={createdPolls}
        actionLabel="結果を確認"
        emptyMessage="作成した日程調整はありません"
        pollHref={(poll) => `/polls/${poll.id}/results`}
      />

      <PollListSection
        id="answered-polls"
        title="回答した日程調整"
        polls={answeredPolls}
        actionLabel="回答を確認"
        emptyMessage="回答した日程調整はありません"
        calendarHref="/answers"
        pollHref={(poll) => `/polls/${poll.id}`}
      />
    </section>
  );
}

function PollListSection(props: {
  id: string;
  title: string;
  polls: PollListItem[];
  actionLabel: string;
  emptyMessage: string;
  calendarHref?: string;
  pollHref: (poll: PollListItem) => string;
}) {
  const { id, title, polls, actionLabel, emptyMessage, calendarHref, pollHref } = props;
  const headingId = `${id}-title`;

  return (
    <section className="dashboard-card stack open-polls" id={id} aria-labelledby={headingId}>
      <div className="section-head">
        <h2 id={headingId}>{title}</h2>
        {calendarHref ? <a className="text-link" href={calendarHref}>カレンダー →</a> : null}
      </div>

      {polls.length ? (
        <ul className="poll-list">
          {polls.map((poll) => (
            <li key={poll.id}>
              <PollCard poll={poll} actionLabel={actionLabel} href={pollHref(poll)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">{emptyMessage}</div>
      )}
    </section>
  );
}

function PollCard({ poll, actionLabel, href }: { poll: PollListItem; actionLabel: string; href: string }) {
  return (
    <a className="poll-card" href={href}>
      <div className="poll-card__header">
        <strong>{poll.title}</strong>
      </div>
      <span className="poll-card__dates">{formatCandidateSummary(poll.candidateDates)}</span>
      <span className="text-link">{actionLabel} →</span>
    </a>
  );
}
