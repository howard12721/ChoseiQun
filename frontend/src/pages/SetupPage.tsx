import type { SetupSelection } from "../app/types";
import { CalendarMonth, SelectedDatesPanel } from "../components/CalendarMonth";
import { MetricCard } from "../components/MetricCard";
import type { PollDetail } from "../types";

export function SetupPage(props: {
  poll: PollDetail;
  selection: SetupSelection;
  onToggleDate: (date: string) => void;
  onSetDates: (dates: string[]) => void;
  onShiftMonth: (amount: number) => void;
  onClearDates: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  onCopy: (value: string) => void;
}) {
  const { poll, selection, onToggleDate, onSetDates, onShiftMonth, onClearDates, onSubmit, onCopy } = props;
  const hasPublished = poll.state === "OPEN";

  return (
    <>
      <section className="page-header">
        <span className="eyebrow">Organizer Setup</span>
        <h1>初期設定画面</h1>
        <p>候補日と概要を入力してください</p>
      </section>

      <section className="metrics-grid metrics-grid--single">
        <MetricCard label="State" value={hasPublished ? "OPEN" : "DRAFT"} hint="公開状態" accent={hasPublished} />
      </section>

      <section className={hasPublished ? "dashboard-layout" : "stack"}>
        <form
          className="dashboard-card stack"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit(new FormData(event.currentTarget));
          }}
        >
          <label className="field">
            <span>タイトル</span>
            <input name="title" defaultValue={poll.title} maxLength={80} required />
          </label>
          <label className="field">
            <span>説明</span>
            <textarea name="description" defaultValue={poll.description} placeholder="イベントの概要を説明してください（任意）" />
          </label>

          <div className="subsection-card stack">
            <div className="section-head">
              <div>
                <strong>候補日を選ぶ</strong>
                <p className="section-caption">日付をクリックすると候補に追加・削除できます</p>
              </div>
              <span className="count-badge">{selection.selectedDates.length}日</span>
            </div>
            <div className="button-row">
              <button type="button" className="secondary-button" onClick={onClearDates}>
                クリア
              </button>
            </div>
            <CalendarMonth
              monthDate={selection.viewMonth}
              mode="setup"
              selectedDates={selection.selectedDates}
              onShiftMonth={onShiftMonth}
              onSetupSetDates={onSetDates}
            />
            <SelectedDatesPanel dates={selection.selectedDates} onRemove={onToggleDate} />
          </div>

          <div className="button-row">
            <button className="primary-button" type="submit">
              {hasPublished ? "設定を更新する" : "設定を完了して公開"}
            </button>
            <button className="secondary-button" type="button" onClick={() => onCopy(window.location.href)}>
              設定URLをコピー
            </button>
          </div>
        </form>

        {hasPublished ? (
          <aside className="dashboard-column">
            <div className="dashboard-card stack">
              <div className="section-head">
                <h2>公開済み</h2>
                <span className="count-badge">OPEN</span>
              </div>
              <div className="message-box url-wrap">{poll.participantUrl}</div>
              <button className="secondary-button" type="button" onClick={() => onCopy(poll.participantUrl)}>
                参加者URLをコピー
              </button>
            </div>
          </aside>
        ) : null}
      </section>
    </>
  );
}
