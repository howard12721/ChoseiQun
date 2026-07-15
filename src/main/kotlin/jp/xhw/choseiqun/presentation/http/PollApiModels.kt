package jp.xhw.choseiqun.presentation.http

import jp.xhw.choseiqun.application.poll.CompleteSetupCommand
import jp.xhw.choseiqun.application.poll.DeleteCommentCommand
import jp.xhw.choseiqun.application.poll.PostCommentCommand
import jp.xhw.choseiqun.application.poll.UpdateCommentCommand
import jp.xhw.choseiqun.application.poll.UpsertAvailabilityCommand
import jp.xhw.choseiqun.domain.DayAvailability
import jp.xhw.choseiqun.domain.PollState
import kotlinx.serialization.Serializable

@Serializable
data class ApiError(
    val message: String,
)

@Serializable
data class CompleteSetupRequest(
    val title: String,
    val description: String = "",
    val candidateDates: List<String> = emptyList(),
) {
    fun toCommand(): CompleteSetupCommand =
        CompleteSetupCommand(
            title = title,
            description = description,
            candidateDates = candidateDates,
        )
}

@Serializable
data class UpsertAvailabilityRequest(
    val name: String = "",
    val note: String = "",
    val responses: Map<String, DayAvailability> = emptyMap(),
) {
    fun toCommand(): UpsertAvailabilityCommand = UpsertAvailabilityCommand(responses = responses)
}

@Serializable
data class PostCommentRequest(
    val comment: String = "",
) {
    fun toCommand(): PostCommentCommand = PostCommentCommand(comment = comment)
}

@Serializable
data class UpdateCommentRequest(
    val createdAt: String = "",
    val comment: String = "",
) {
    fun toCommand(): UpdateCommentCommand = UpdateCommentCommand(createdAt = createdAt, comment = comment)
}

@Serializable
data class DeleteCommentRequest(
    val createdAt: String = "",
) {
    fun toCommand(): DeleteCommentCommand = DeleteCommentCommand(createdAt = createdAt)
}

@Serializable
data class DaySummaryResponse(
    val date: String,
    val label: String,
    val yesCount: Int,
    val maybeCount: Int,
    val noCount: Int,
    val score: Int,
)

@Serializable
data class PollSummaryResponse(
    val participantCount: Int,
    val recommendedDates: List<DaySummaryResponse>,
    val days: List<DaySummaryResponse>,
)

@Serializable
data class ParticipantResponse(
    val name: String,
    val traqId: String? = null,
    val isViewer: Boolean = false,
    val iconUrl: String? = null,
    val note: String,
    val comments: List<ParticipantCommentResponse> = emptyList(),
    val responses: Map<String, DayAvailability>,
    val updatedAt: String,
)

@Serializable
data class ParticipantCommentResponse(
    val body: String,
    val createdAt: String,
)

@Serializable
data class PollDetailResponse(
    val id: String,
    val title: String,
    val description: String,
    val state: PollState,
    val candidateDates: List<String> = emptyList(),
    val createdAt: String,
    val updatedAt: String,
    val participantUrl: String,
    val setupUrl: String? = null,
    val viewerTraqId: String? = null,
    val viewerIconUrl: String? = null,
    val participants: List<ParticipantResponse>,
    val summary: PollSummaryResponse,
)

@Serializable
data class PollListItemResponse(
    val id: String,
    val title: String,
    val state: PollState,
    val candidateDates: List<String> = emptyList(),
    val participantCount: Int,
    val respondedByViewer: Boolean = false,
    val createdByViewer: Boolean = false,
    val viewerResponses: Map<String, DayAvailability> = emptyMap(),
    val participantUrl: String,
    val updatedAt: String,
)
