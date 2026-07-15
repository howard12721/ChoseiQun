package jp.xhw.choseiqun.application.poll

import jp.xhw.choseiqun.domain.DayAvailability
import jp.xhw.choseiqun.domain.PollRecord
import jp.xhw.choseiqun.domain.ViewerIdentity
import kotlin.uuid.Uuid

data class CreateDraftPollCommand(
    val title: String,
    val organizerUserId: String,
    val organizerTraqId: String,
    val traqChannelId: Uuid,
)

data class CompleteSetupCommand(
    val title: String,
    val description: String = "",
    val candidateDates: List<String> = emptyList(),
)

data class UpsertAvailabilityCommand(
    val responses: Map<String, DayAvailability> = emptyMap(),
)

data class PostCommentCommand(
    val comment: String = "",
)

data class UpdateCommentCommand(
    val createdAt: String = "",
    val comment: String = "",
)

data class DeleteCommentCommand(
    val createdAt: String = "",
)

data class DaySummary(
    val date: String,
    val yesCount: Int,
    val maybeCount: Int,
    val noCount: Int,
    val score: Int,
)

data class PollSummary(
    val participantCount: Int,
    val recommendedDates: List<DaySummary>,
    val days: List<DaySummary>,
)

data class PollDetails(
    val poll: PollRecord,
    val summary: PollSummary,
    val viewerIdentity: ViewerIdentity? = null,
)
