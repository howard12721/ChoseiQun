import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { PollDetail } from "../../entities/poll/model";
import { formatDateLabel } from "../../shared/lib/date";
import { Icon } from "../../shared/ui/Icon";
import { CandidateDateCalendar } from "./CandidateDateCalendar";
import {
  commonTimeRanges,
  invalidTimeOrder,
  missingTimes,
  replaceTimeRanges,
  sortTimeRanges,
  validTimeRange,
  type SetupSelection,
  type TimeRange,
} from "./model";

const TIME_ORDER_ERROR = "終了時間は開始時間より後にしてください";

export function SetupPage(props: {
  poll: PollDetail;
  selection: SetupSelection;
  onChangeSelection: Dispatch<SetStateAction<SetupSelection>>;
  onSetDates: (dates: string[]) => void;
  onShiftMonth: (amount: number) => void;
  isSaving: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const {
    poll,
    selection,
    onChangeSelection,
    onSetDates,
    onShiftMonth,
    isSaving,
    onSubmit,
  } = props;
  const [expanded, setExpanded] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRanges, setBulkRanges] = useState<TimeRange[]>([
    { startTime: "18:00", endTime: "19:00" },
  ]);
  const isTimed = selection.scheduleType === "TIMED";
  const hasMissingTimes = missingTimes(selection);
  const hasInvalidTimeOrder = selection.selectedDates.some((date) =>
    (selection.timeRanges[date] ?? []).some(invalidTimeOrder),
  );
  const firstRanges = selection.timeRanges[selection.selectedDates[0]] ?? [];
  const common = commonTimeRanges(selection);

  function updateRanges(date: string, ranges: TimeRange[]) {
    onChangeSelection((current) => ({
      ...current,
      timeRanges: { ...current.timeRanges, [date]: ranges },
    }));
  }

  return (
    <form
      className="setup-page"
      aria-busy={isSaving}
      onSubmit={(event) => {
        event.preventDefault();
        if (!isSaving && !hasMissingTimes)
          void onSubmit(new FormData(event.currentTarget));
      }}
    >
      <div className="setup-heading">
        <label className="title-field">
          <span className="visually-hidden">イベント名</span>
          <input
            aria-label="イベント名"
            className="title-input"
            name="title"
            defaultValue={poll.title}
            maxLength={255}
            required
          />
        </label>
        <label className="field">
          <span>説明（任意）</span>
          <textarea
            name="description"
            defaultValue={poll.description}
            maxLength={4000}
            placeholder="イベントの説明を入力"
          />
        </label>
      </div>
      <div
        className={`candidate-editor${isTimed ? "" : " candidate-editor--date-only"}`}
      >
        <section className="calendar-column">
          <div className="calendar-controls">
            <h2>候補日を選択</h2>
            <div
              className="schedule-mode"
              role="group"
              aria-label="日程の指定方法"
            >
              {(
                [
                  ["DATE_ONLY", "日付のみ", "calendar"],
                  ["TIMED", "時間も指定", "clock"],
                ] as const
              ).map(([mode, label, icon]) => (
                <button
                  type="button"
                  key={mode}
                  aria-pressed={selection.scheduleType === mode}
                  disabled={isSaving}
                  onClick={() =>
                    onChangeSelection((current) => ({
                      ...current,
                      scheduleType: mode,
                    }))
                  }
                >
                  <Icon name={icon} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <CandidateDateCalendar
            monthDate={selection.viewMonth}
            selectedDates={selection.selectedDates}
            onShiftMonth={onShiftMonth}
            onSetDates={onSetDates}
          />
          <div className="selected-dates-summary">
            <p>選択中の日程</p>
            <p>
              {selection.selectedDates.length
                ? selection.selectedDates.map(formatDateLabel).join("、")
                : "候補日を選択してください"}
            </p>
          </div>
        </section>
        <div
          className="time-column"
          aria-hidden={!isTimed}
          inert={!isTimed}
        >
          <div className="time-column__content">
            <section className="time-accordion">
              <button
                className="time-toggle"
                type="button"
                aria-expanded={expanded}
                aria-controls="daily-time-editors"
                onClick={() => setExpanded(!expanded)}
              >
                <span className="time-toggle__heading">
                  <Icon name="clock" />
                  <span className="section-title">時間帯を設定</span>
                  <span
                    className={`disclosure${expanded ? " is-expanded" : ""}`}
                  >
                    <Icon name="down" />
                  </span>
                </span>
                {!selection.selectedDates.length ? (
                  <span className="time-summary">候補日を選択してください</span>
                ) : hasMissingTimes ? (
                  <span className="time-error" role="status">
                    {hasInvalidTimeOrder
                      ? TIME_ORDER_ERROR
                      : "未設定の日付があります！"}
                  </span>
                ) : (
                  <>
                    <span className="time-summary">
                      {common ? "全日程共通" : "カスタム時間帯"}
                    </span>
                    {common && (
                      <span className="time-summary">
                        {common
                          .map((range) => `${range.startTime}–${range.endTime}`)
                          .join(" / ")}
                      </span>
                    )}
                  </>
                )}
              </button>
              <div
                id="daily-time-editors"
                className="daily-time-editors"
                aria-hidden={!expanded}
                inert={!expanded}
              >
                <div className="daily-time-editors__content">
                  {selection.selectedDates.length ? (
                    selection.selectedDates.map((date) => (
                      <div className="day-time-editor" key={date}>
                        <div className="day-time-editor__heading">
                          <p>{formatDateLabel(date)}</p>
                          <button
                            className="text-action danger-button"
                            type="button"
                            aria-label={`${formatDateLabel(date)}を候補日から削除`}
                            disabled={isSaving || !isTimed}
                            onClick={() =>
                              onSetDates(
                                selection.selectedDates.filter(
                                  (value) => value !== date,
                                ),
                              )
                            }
                          >
                            日付を削除
                          </button>
                        </div>
                        <TimeRangeEditor
                          label={formatDateLabel(date)}
                          ranges={selection.timeRanges[date] ?? []}
                          onChange={(ranges) => updateRanges(date, ranges)}
                          disabled={isSaving || !isTimed || !expanded}
                        />
                      </div>
                    ))
                  ) : (
                    <p className="empty-state">候補日を選択してください</p>
                  )}
                </div>
              </div>
            </section>
            <button
              className="primary-button bulk-trigger"
              type="button"
              disabled={!selection.selectedDates.length || isSaving}
              onClick={() => {
                setBulkRanges(
                  firstRanges.length
                    ? firstRanges.map((range) => ({ ...range }))
                    : [{ startTime: "18:00", endTime: "19:00" }],
                );
                setBulkOpen(true);
              }}
            >
              <Icon name="layers" />
              まとめて設定
            </button>
          </div>
        </div>
      </div>
      <div className="publish-actions">
        <button
          className="primary-button"
          type="submit"
          disabled={
            isSaving || !selection.selectedDates.length || hasMissingTimes
          }
        >
          <Icon name="check" />
          {isSaving ? "保存中…" : "公開する"}
        </button>
      </div>
      <BulkTimeDialog
        open={bulkOpen}
        ranges={bulkRanges}
        onChange={setBulkRanges}
        onClose={() => setBulkOpen(false)}
        onApply={() => {
          onChangeSelection((current) => ({
            ...current,
            timeRanges: {
              ...current.timeRanges,
              ...replaceTimeRanges(current.selectedDates, bulkRanges),
            },
          }));
          setBulkOpen(false);
        }}
      />
    </form>
  );
}

function TimeRangeEditor({
  label,
  ranges,
  onChange,
  disabled = false,
}: {
  label: string;
  ranges: TimeRange[];
  onChange: (ranges: TimeRange[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  function change(index: number, field: keyof TimeRange, value: string) {
    onChange(
      ranges.map((range, i) =>
        i === index ? { ...range, [field]: value } : range,
      ),
    );
  }
  return (
    <div
      className="time-range-editor"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onChange(sortTimeRanges(ranges));
        }
      }}
    >
      {ranges.length > 0 && (
        <div className="time-labels" aria-hidden="true">
          <span>開始</span>
          <span />
          <span>終了</span>
          <span />
        </div>
      )}
      {ranges.map((range, index) => (
        <div className="time-range" key={index}>
          {(["startTime", "endTime"] as const).map((field, fieldIndex) => (
            <span className="time-field-group" key={field}>
              {fieldIndex === 1 && (
                <span className="time-separator" aria-hidden="true">
                  –
                </span>
              )}
              <span className="time-field">
                <input
                  type="time"
                  lang="ja-JP"
                  step={60}
                  min={
                    field === "endTime" ? range.startTime || undefined : undefined
                  }
                  aria-label={`${label} ${index + 1} ${field === "startTime" ? "開始" : "終了"}`}
                  aria-invalid={field === "endTime" && invalidTimeOrder(range)}
                  aria-describedby={
                    invalidTimeOrder(range) ? `${id}-${index}-error` : undefined
                  }
                  value={range[field]}
                  disabled={disabled}
                  ref={(input) => {
                    input?.setCustomValidity(
                      field === "endTime" && invalidTimeOrder(range)
                        ? TIME_ORDER_ERROR
                        : "",
                    );
                  }}
                  onChange={(event) => change(index, field, event.target.value)}
                />
                <Icon name="down" />
              </span>
            </span>
          ))}
          <button
            type="button"
            className="icon-button"
            aria-label={`${label} ${index + 1}の時間帯を削除`}
            disabled={disabled}
            onClick={() => onChange(ranges.filter((_, i) => i !== index))}
          >
            <Icon name="close" />
          </button>
          {invalidTimeOrder(range) && (
            <p className="time-error" id={`${id}-${index}-error`} role="status">
              {TIME_ORDER_ERROR}
            </p>
          )}
        </div>
      ))}
      <button
        className="text-action add-time"
        type="button"
        disabled={disabled}
        onClick={() => onChange([...ranges, { startTime: "", endTime: "" }])}
      >
        時間帯を追加
        <Icon name="plus" />
      </button>
    </div>
  );
}

function BulkTimeDialog({
  open,
  ranges,
  onChange,
  onClose,
  onApply,
}: {
  open: boolean;
  ranges: TimeRange[];
  onChange: (ranges: TimeRange[]) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="bulk-dialog"
      aria-labelledby="bulk-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bulk-dialog__surface">
        <div className="section-head">
          <h2 id="bulk-title">まとめて設定</h2>
          <button
            className="icon-button outlined"
            type="button"
            aria-label="閉じる"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <TimeRangeEditor
          label="まとめて設定"
          ranges={ranges}
          onChange={onChange}
        />
        <div className="bulk-dialog__actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!ranges.length || !ranges.every(validTimeRange)}
            onClick={onApply}
          >
            <Icon name="check" />
            適用
          </button>
        </div>
      </div>
    </dialog>
  );
}
