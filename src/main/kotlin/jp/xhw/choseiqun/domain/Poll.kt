package jp.xhw.choseiqun.domain

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

data class ViewerIdentity(
    val userId: String,
    val traqId: String,
)

data class ParticipantRecord(
    val name: String,
    val traqId: String? = null,
    val userId: String? = null,
    val note: String = "",
    val comments: List<ParticipantCommentRecord> = emptyList(),
    val responses: Map<String, DayAvailability> = emptyMap(),
    val updatedAt: String,
)

data class ParticipantCommentRecord(
    val body: String,
    val createdAt: String,
)

data class PollRecord(
    val id: String,
    val title: String,
    val description: String = "",
    val state: PollState = PollState.DRAFT,
    val candidateDates: List<String> = emptyList(),
    val createdAt: String,
    val updatedAt: String,
    val organizerUserId: String,
    val organizerTraqId: String? = null,
    val traqChannelId: Uuid? = null,
    val announcementMessageId: Uuid? = null,
    val participants: List<ParticipantRecord> = emptyList(),
) {
    fun isOrganizer(viewerIdentity: ViewerIdentity): Boolean =
        organizerUserId == viewerIdentity.userId

    fun participantFor(viewerIdentity: ViewerIdentity): ParticipantRecord? =
        participants.firstOrNull { it.belongsTo(viewerIdentity) }

    fun replacingParticipant(
        viewerIdentity: ViewerIdentity,
        participant: ParticipantRecord,
        updatedAt: String,
    ): PollRecord {
        val mergedParticipants =
            participants
                .toMutableList()
                .apply {
                    val index = indexOfFirst { it.belongsTo(viewerIdentity) }
                    if (index >= 0) {
                        this[index] = participant
                    } else {
                        add(participant)
                    }
                }.sortedBy { (it.traqId ?: it.name).lowercase() }
        return copy(participants = mergedParticipants, updatedAt = updatedAt)
    }
}

fun ParticipantRecord.belongsTo(viewerIdentity: ViewerIdentity): Boolean =
    userId == viewerIdentity.userId ||
        (
            userId == null &&
                (
                    traqId.equals(viewerIdentity.traqId, ignoreCase = true) ||
                        name.equals(viewerIdentity.traqId, ignoreCase = true)
                )
        )

fun ParticipantRecord?.materializedComments(): List<ParticipantCommentRecord> {
    if (this == null) {
        return emptyList()
    }
    val legacyComments =
        note
            .takeIf { it.isNotBlank() }
            ?.let {
                listOf(
                    ParticipantCommentRecord(
                        body = it,
                        createdAt = updatedAt,
                    ),
                )
            }.orEmpty()
    return legacyComments + comments
}
