import type { SetupSelection } from "../app/types";
import { CalendarMonth, SelectedDatesPanel } from "../components/CalendarMonth";
import type { PollDetail } from "../types";

export function SetupPage(props: {
  poll: PollDetail;
  selection: SetupSelection;
  onToggleDate: (date: string) => void;
  onSetDates: (dates: string[]) => void;
  onShiftMonth: (amount: number) => void;
  onGoToCurrentMonth: () => void;
  onClearDates: () => void;
  isSaving: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
  onCopy: (value: string) => void;
}) {
  const {
    poll,
    selection,
    onToggleDate,
    onSetDates,
    onShiftMonth,
    onGoToCurrentMonth,
    onClearDates,
    isSaving,
    onSubmit,
    onCopy,
  } = props;
  const hasPublished = poll.state === "OPEN";

  return (
    <>
      <section className="page-header">
        <h1>{hasPublished ? "日程調整を編集" : "日程調整を作成"}</h1>
      </section>

      <section className="dashboard-layout">
        <form
          className="dashboard-card stack"
          aria-busy={isSaving}
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit(new FormData(event.currentTarget));
          }}
        >
          <label className="field">
            <span>タイトル <strong className="required-mark">必須</strong></span>
            <input name="title" defaultValue={poll.title} maxLength={80} required />
          </label>
          <label className="field">
            <span>説明</span>
            <textarea name="description" defaultValue={poll.description} />
          </label>

          <div className="subsection-card stack">
            <div className="section-head">
              <h2>候補日</h2>
            </div>
            <div className="button-row calendar-tools">
              <button type="button" className="tertiary-button" onClick={onGoToCurrentMonth}>
                今月
              </button>
              <button
                type="button"
                className="tertiary-button"
                disabled={!selection.selectedDates.length}
                onClick={onClearDates}
              >
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
            <button
              className="primary-button"
              type="submit"
              disabled={isSaving || !selection.selectedDates.length}
            >
              {isSaving ? "保存中…" : hasPublished ? "保存" : "公開"}
            </button>
          </div>
        </form>

        <aside className="dashboard-column">
          <div className="dashboard-card stack">
            <div className="section-head">
              <h2>参加者向けリンク</h2>
            </div>
            <div className="message-box url-wrap">
              {hasPublished ? poll.participantUrl : "公開後に表示"}
            </div>
            <div className="button-row">
              <button
                className="secondary-button"
                type="button"
                disabled={!hasPublished}
                onClick={() => onCopy(poll.participantUrl)}
              >
                コピー
              </button>
              {hasPublished ? (
                <a
                  className="secondary-button"
                  href={poll.participantUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  開く
                </a>
              ) : (
                <button className="secondary-button" type="button" disabled>
                  開く
                </button>
              )}
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}
