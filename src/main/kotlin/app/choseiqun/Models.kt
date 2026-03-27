package app.choseiqun

import kotlinx.serialization.Serializable
import kotlin.uuid.Uuid

@Serializable
enum class PollState {
    DRAFT,
    OPEN,
    CLOSED,
}

@Serializable
enum class DayAvailability {
    YES,
    MAYBE,
    NO,
}

@Serializable
data class ParticipantRecord(
    val name: String,
    val traqId: String? = null,
    val note: String = "",
    val comments: List<ParticipantCommentRecord> = emptyList(),
    val responses: Map<String, DayAvailability> = emptyMap(),
    val updatedAt: String,
)

@Serializable
data class ParticipantCommentRecord(
    val body: String,
    val createdAt: String,
)

@Serializable
data class PollRecord(
    val id: String,
    val setupToken: String,
    val title: String,
    val description: String = "",
    val state: PollState = PollState.DRAFT,
    val candidateDates: List<String> = emptyList(),
    val createdAt: String,
    val updatedAt: String,
    val organizerUserId: String,
    val traqChannelId: Uuid? = null,
    val announcementMessageId: Uuid? = null,
    val participants: List<ParticipantRecord> = emptyList(),
)

@Serializable
data class ApiError(
    val message: String,
)

@Serializable
data class CreateDraftPollCommand(
    val title: String,
    val organizerUserId: String,
    val traqChannelId: Uuid,
)

@Serializable
data class CompleteSetupRequest(
    val title: String,
    val description: String = "",
    val candidateDates: List<String> = emptyList(),
)

@Serializable
data class UpsertAvailabilityRequest(
    val name: String = "",
    val note: String = "",
    val responses: Map<String, DayAvailability> = emptyMap(),
)

@Serializable
data class PostCommentRequest(
    val comment: String = "",
)

@Serializable
data class UpdateCommentRequest(
    val createdAt: String = "",
    val comment: String = "",
)

@Serializable
data class DeleteCommentRequest(
    val createdAt: String = "",
)

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
    val announcementMessageId: String? = null,
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
    val participantUrl: String,
    val updatedAt: String,
)
