import type { ParticipantResponse } from "../../../entities/poll/model";
import { participantCommentsForDisplay } from "../../../entities/poll/selectors";

export function ParticipantComments({ participant }: { participant: ParticipantResponse }) {
  const comments = participantCommentsForDisplay(participant);

  return (
    <div className="participant-comments">
      {comments.length ? (
        comments.map((comment) => (
          <div className="participant-comment" key={`${comment.createdAt}-${comment.body}`}>
            {comment.body}
          </div>
        ))
      ) : (
        <span className="muted-text">コメントなし</span>
      )}
    </div>
  );
}
