package jp.xhw.choseiqun.application.port

import jp.xhw.choseiqun.domain.DayAvailability
import jp.xhw.choseiqun.domain.PollRecord
import jp.xhw.choseiqun.domain.PollState
import kotlin.uuid.Uuid

interface PollRepository {
    suspend fun updateAnnouncementMessageId(
        pollId: String,
        messageId: Uuid,
    )

    suspend fun findById(id: String): PollRecord?

    suspend fun save(record: PollRecord): PollRecord

    suspend fun listOpenForViewer(viewerUserId: String): List<PollListRecord>
}

data class PollListRecord(
    val id: String,
    val title: String,
    val state: PollState,
    val candidateDates: List<String>,
    val participantCount: Int,
    val respondedByViewer: Boolean,
    val createdByViewer: Boolean,
    val viewerResponses: Map<String, DayAvailability>,
    val updatedAt: String,
)
