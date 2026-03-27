import type { PollListItem } from "../types";
import { formatCandidateSummary } from "../utils/date";

export function HomePage({ openPolls, onCopy }: { openPolls: PollListItem[]; onCopy: (value: string) => void }) {
  return (
    <section className="home-stack">
      <div className="hero-card stack">
        <span className="eyebrow">Overview</span>
        <h1>調整くん</h1>
        <p><code>chosei start イベント名</code> で日程調整を開始</p>
        <div className="button-row">
          <button className="primary-button" type="button" onClick={() => onCopy("chosei start 研究室MTG")}>
            コマンドをコピー
          </button>
        </div>
      </div>

      <div className="dashboard-card stack" id="open-polls">
        <div className="section-head">
          <div>
            <h2>公開中の日程調整</h2>
            <p className="section-caption">進行中の調整一覧</p>
          </div>
          <span className="count-badge">{openPolls.length}件</span>
        </div>
        <div className="poll-list">
          {openPolls.length ? (
            openPolls.map((poll) => (
              <article className="poll-card" key={poll.id}>
                <div className="poll-card__header">
                  <strong>{poll.title}</strong>
                  <span className="count-badge">{poll.participantCount}人</span>
                </div>
                <span className="muted-text">{formatCandidateSummary(poll.candidateDates)}</span>
                <a className="text-link" href={`/polls/${poll.id}`}>
                  参加ページを開く
                </a>
              </article>
            ))
          ) : (
            <div className="empty-state">まだ公開中の調整はありません</div>
          )}
        </div>
      </div>
    </section>
  );
}
