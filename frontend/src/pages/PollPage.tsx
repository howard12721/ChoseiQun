import type { EditorState } from "../app/types";
import { AvailabilityTable } from "../components/AvailabilityTable";
import { CommentPanel } from "../components/CommentPanel";
import type { DayAvailability, PollDetail } from "../types";
import { participantCommentsForDisplay } from "../utils/poll";

export function PollPage(props: {
  poll: PollDetail;
  editor: EditorState;
  onNoteInput: (value: string) => void;
  onEditComment: (createdAt: string, body: string) => void;
  onCancelCommentEdit: () => void;
  onDeleteComment: (createdAt: string) => void;
  onPickAvailability: (date: string, value: DayAvailability) => void;
  onSubmitAvailability: () => Promise<void>;
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
    onPickAvailability,
    onSubmitAvailability,
    onSubmit,
    onCopy,
  } = props;

  const hasForwardedUser = Boolean(poll.viewerTraqId);
  const registrationDisabled = !hasForwardedUser;
  const ownParticipant = poll.participants.find((participant) => participant.traqId === poll.viewerTraqId);
  const ownComments = ownParticipant ? participantCommentsForDisplay(ownParticipant) : [];
  const isEditingComment = Boolean(editor.editingCommentCreatedAt);

  return (
    <>
      <section className="page-header">
        <span className="eyebrow">Participant View</span>
        <div className="page-header-title-row">
          <h1>{poll.title}</h1>
          <button className="secondary-button" type="button" onClick={() => onCopy(window.location.href)}>
            リンクをコピー
          </button>
        </div>
        <p>{poll.description || "参加できる日を塗ってください。"}</p>
      </section>

      <section className="poll-layout">
        <div className="stack">
          <div className="dashboard-card stack">
            <div className="section-head">
              <div>
                <strong>日程選択</strong>
                <p className="section-caption">参加できる日程を回答してください</p>
              </div>
              <span className="count-badge">{poll.candidateDates.length}日</span>
            </div>
            <AvailabilityTable
              dates={poll.candidateDates}
              responses={editor.responses}
              onPickAvailability={onPickAvailability}
            />
            <div className="button-row">
              <button className="primary-button" type="button" disabled={registrationDisabled} onClick={() => void onSubmitAvailability()}>
                日程を送信する
              </button>
              <a className="secondary-button button-link" href={`/polls/${poll.id}/results`}>
                結果を見る
              </a>
            </div>
          </div>
        </div>

        <aside className="dashboard-column">
          <CommentPanel
            poll={poll}
            note={editor.note}
            isEditingComment={isEditingComment}
            ownComments={ownComments}
            onNoteInput={onNoteInput}
            onEditComment={onEditComment}
            onCancelCommentEdit={onCancelCommentEdit}
            onDeleteComment={onDeleteComment}
            onSubmit={onSubmit}
            missingTraqMessage="traQ IDの取得に失敗しました"
          />
        </aside>
      </section>
    </>
  );
}
