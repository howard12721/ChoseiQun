import type { PollListItem } from "../../entities/poll/model";
import { selectHomePollLists } from "../../entities/poll/listSelectors";
import { formatCandidateSummary } from "../../shared/lib/date";
import { Icon } from "../../shared/ui/Icon";

export function HomePage({
  openPolls,
  onCopy,
  list,
}: {
  openPolls: PollListItem[];
  onCopy: (value: string) => void;
  list?: "created" | "answered";
}) {
  const { createdPolls, answeredPolls } = selectHomePollLists(openPolls);
  if (list)
    return (
      <div className="event-list-page">
        <a className="text-action" href="/">
          <Icon name="left" />
          ホームに戻る
        </a>
        <h1>イベント一覧</h1>
        <nav className="event-kind-switcher" aria-label="イベントの種類">
          <a
            className={list === "created" ? "is-selected" : ""}
            aria-current={list === "created" ? "page" : undefined}
            href="/created"
          >
            作成したイベント
          </a>
          <a
            className={list === "answered" ? "is-selected" : ""}
            aria-current={list === "answered" ? "page" : undefined}
            href="/answered"
          >
            回答したイベント
          </a>
        </nav>
        <PollListSection
          title={list === "created" ? "作成したイベント" : "回答したイベント"}
          polls={list === "created" ? createdPolls : answeredPolls}
          created={list === "created"}
          all
        />
      </div>
    );
  return (
    <div className="home-stack">
      <PollListSection
        title="作成したイベント"
        polls={createdPolls}
        created
        all={false}
      />
      <PollListSection
        title="回答したイベント"
        polls={answeredPolls}
        all={false}
      />
      <section className="command-box">
        <strong>新しい日程調整をはじめる</strong>
        <button
          type="button"
          className="command-copy"
          aria-label="日程調整コマンドをコピー"
          onClick={() => onCopy("@chosei イベント名")}
        >
          <code>@chosei イベント名</code>
          <Icon name="copy" />
        </button>
      </section>
    </div>
  );
}

function PollListSection({
  title,
  polls,
  created = false,
  all,
}: {
  title: string;
  polls: PollListItem[];
  created?: boolean;
  all: boolean;
}) {
  return (
    <section className="poll-list-section">
      {!all && (
        <div className="section-head">
          <h2>
            <Icon name={created ? "edit" : "check"} />
            {title}
          </h2>
          <a className="text-action" href={created ? "/created" : "/answered"}>
            もっと見る
            <Icon name="right" />
          </a>
        </div>
      )}
      {polls.length ? (
        <ul className="poll-list">
          {(all ? polls : polls.slice(0, 2)).map((poll) => (
            <li className="poll-card" key={poll.id}>
              <span className="poll-card__icon">
                <Icon name="calendar" />
              </span>
              <div className="poll-card__body">
                <strong>{poll.title}</strong>
                <p className="poll-card__dates">
                  {formatCandidateSummary(poll.candidateDates)}
                </p>
                <div className="poll-card__actions">
                  <a href={created ? `/setup/${poll.id}` : `/polls/${poll.id}`}>
                    {created ? "日時を変更" : "回答を変更"} →
                  </a>
                  <a href={`/polls/${poll.id}/results`}>結果を見る →</a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">
          {created
            ? "作成したイベントはありません"
            : "回答したイベントはありません"}
        </p>
      )}
    </section>
  );
}
