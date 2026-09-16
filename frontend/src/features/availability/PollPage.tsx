import { Icon } from "../../shared/ui/Icon";
import type { DayAvailability, PollDetail } from "../../entities/poll/model";
import {
  isViewerParticipant,
  pollCandidates,
} from "../../entities/poll/selectors";
import { AvailabilityTable } from "./AvailabilityTable";
import type { AvailabilityDraft } from "./model";

export function PollPage(props: {
  poll: PollDetail;
  draft: AvailabilityDraft;
  onPickAvailability: (date: string, value: DayAvailability) => void;
  hasUnsavedChanges: boolean;
  isSavingAvailability: boolean;
  onSubmitAvailability: () => Promise<void>;
  onCopy: (value: string) => void;
}) {
  const {
    poll,
    draft,
    onPickAvailability,
    hasUnsavedChanges,
    isSavingAvailability,
    onSubmitAvailability,
    onCopy,
  } = props;

  const hasForwardedUser = Boolean(poll.viewerTraqId);
  const registrationDisabled = !hasForwardedUser;
  const ownParticipant = poll.participants.find((participant) =>
    isViewerParticipant(participant, poll),
  );
  const canSubmitAvailability =
    hasForwardedUser &&
    !isSavingAvailability &&
    (!ownParticipant || hasUnsavedChanges);

  return (
    <>
      <section className="page-header">
        <h1>{poll.title}</h1>
        {poll.description ? <p>{poll.description}</p> : null}
        <div className="button-row page-header-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => onCopy(poll.participantUrl)}
          >
            リンクをコピー
            <Icon name="copy" />
          </button>
          {poll.setupUrl && (
            <a className="secondary-button" href={poll.setupUrl}>
              設定
              <Icon name="settings" />
            </a>
          )}
        </div>
      </section>

      <section className="dashboard-card stack">
        <div className="section-head">
          <h2>{poll.scheduleType === "TIMED" ? "候補日時" : "候補日"}</h2>
        </div>

        {!hasForwardedUser ? (
          <div className="inline-notice inline-notice--warning" role="alert">
            traQから開くと回答できます
          </div>
        ) : null}

        <AvailabilityTable
          candidates={pollCandidates(poll)}
          responses={draft.responses}
          disabled={registrationDisabled || isSavingAvailability}
          onPickAvailability={onPickAvailability}
        />

        <div className="response-submit-bar">
          <div className="button-row">
            <button
              className="primary-button"
              type="button"
              disabled={!canSubmitAvailability}
              onClick={() => void onSubmitAvailability()}
            >
              <Icon name="send" />
              {isSavingAvailability ? "保存中…" : "回答を送信"}
            </button>
            <a
              className="secondary-button button-link"
              href={`/polls/${poll.id}/results`}
            >
              <Icon name="chart" />
              結果を見る
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
