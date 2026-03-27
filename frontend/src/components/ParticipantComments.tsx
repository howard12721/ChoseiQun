import type { ParticipantResponse } from "../types";
import { participantCommentsForDisplay } from "../utils/poll";

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
