package jp.xhw.choseiqun.application.poll

import jp.xhw.choseiqun.application.ForbiddenException
import jp.xhw.choseiqun.application.port.PollAnnouncementGateway
import jp.xhw.choseiqun.application.port.PollListRecord
import jp.xhw.choseiqun.application.port.PollRepository
import jp.xhw.choseiqun.domain.DayAvailability
import jp.xhw.choseiqun.domain.ParticipantCommentRecord
import jp.xhw.choseiqun.domain.ParticipantRecord
import jp.xhw.choseiqun.domain.PollRecord
import jp.xhw.choseiqun.domain.PollState
import jp.xhw.choseiqun.domain.ViewerIdentity
import jp.xhw.choseiqun.domain.materializedComments
import kotlinx.coroutines.CancellationException
import kotlin.time.Clock
import kotlin.uuid.Uuid

class PollService(
    private val repository: PollRepository,
    private val announcementGateway: PollAnnouncementGateway? = null,
    private val summaryCalculator: PollSummaryCalculator = PollSummaryCalculator(),
    private val now: () -> String = { Clock.System.now().toString() },
    private val newPollId: () -> String = { Uuid.random().toString().replace("-", "") },
) : PollUseCases {
    override suspend fun createDraftPoll(command: CreateDraftPollCommand): PollRecord {
        val timestamp = now()
        val title = command.title.trim().ifBlank { "日程調整" }
        require(title.length <= MAX_TITLE_LENGTH) { "タイトルは $MAX_TITLE_LENGTH 文字以内にしてください" }
        val poll =
            PollRecord(
                id = newPollId(),
                title = title,
                createdAt = timestamp,
                updatedAt = timestamp,
                organizerUserId = command.organizerUserId,
                organizerTraqId = command.organizerTraqId,
                traqChannelId = command.traqChannelId,
            )
        return syncAnnouncement(repository.save(poll))
    }

    override suspend fun listOpenPolls(viewerIdentity: ViewerIdentity?): List<PollListRecord> {
        val viewer = viewerIdentity ?: return emptyList()
        return repository.listOpenForViewer(viewer.userId)
    }

    override suspend fun getSetupPoll(
        id: String,
        viewerIdentity: ViewerIdentity?,
    ): PollDetails {
        val viewer = requireSetupViewer(viewerIdentity)
        val poll = requireSetupAccess(id, viewer)
        return poll.toDetails(viewer)
    }

    override suspend fun completeSetup(
        id: String,
        command: CompleteSetupCommand,
        viewerIdentity: ViewerIdentity?,
    ): PollDetails {
        val viewer = requireSetupViewer(viewerIdentity)
        val existing = requireSetupAccess(id, viewer)
        val title = command.title.trim()
        require(title.isNotBlank()) { "タイトルを入力してください" }
        require(title.length <= MAX_TITLE_LENGTH) { "タイトルは $MAX_TITLE_LENGTH 文字以内にしてください" }
        val description = command.description.trim()
        require(description.length <= MAX_DESCRIPTION_LENGTH) {
            "説明は $MAX_DESCRIPTION_LENGTH 文字以内にしてください"
        }
        require(command.candidateDates.size <= MAX_CANDIDATE_DATES) {
            "候補日は $MAX_CANDIDATE_DATES 日以内にしてください"
        }

        val candidateDates =
            command.candidateDates
                .map(String::trim)
                .filter(String::isNotBlank)
                .map(summaryCalculator::parseDate)
                .distinct()
                .sorted()
                .map { it.toString() }
        require(candidateDates.isNotEmpty()) { "候補日を1日以上選んでください" }

        val updated =
            repository.save(
                existing.copy(
                    title = title,
                    description = description,
                    state = PollState.OPEN,
                    candidateDates = candidateDates,
                    organizerTraqId = existing.organizerTraqId ?: viewer.traqId,
                    updatedAt = now(),
                ),
            )
        return syncAnnouncement(updated).toDetails(viewer)
    }

    override suspend fun getPublicPoll(
        id: String,
        viewerIdentity: ViewerIdentity?,
    ): PollDetails = requireOpenPoll(id).toDetails(viewerIdentity)

    override suspend fun upsertAvailability(
        id: String,
        command: UpsertAvailabilityCommand,
        viewerIdentity: ViewerIdentity?,
    ): PollDetails {
        val poll = requireOpenPoll(id)
        val viewer = requireViewer(viewerIdentity)
        val timestamp = now()
        val existingParticipant = poll.participantFor(viewer)
        val updatedParticipant =
            ParticipantRecord(
                name = viewer.traqId,
                traqId = viewer.traqId,
                userId = viewer.userId,
                note = existingParticipant?.note.orEmpty(),
                comments = existingParticipant?.comments.orEmpty(),
                responses = buildParticipantResponses(poll.candidateDates, command.responses),
                updatedAt = timestamp,
            )
        val updatedPoll =
            repository.save(
                poll.replacingParticipant(viewer, updatedParticipant, timestamp),
            )
        return syncAnnouncement(updatedPoll).toDetails(viewer)
    }

    override suspend fun postComment(
        id: String,
        command: PostCommentCommand,
        viewerIdentity: ViewerIdentity?,
    ): PollDetails {
        val poll = requireOpenPoll(id)
        val viewer = requireViewer(viewerIdentity)
        val commentBody = command.comment.trim()
        require(commentBody.isNotBlank()) { "コメントを入力してください" }
        require(commentBody.length <= MAX_COMMENT_LENGTH) {
            "コメントは $MAX_COMMENT_LENGTH 文字以内にしてください"
        }

        val existingParticipant = poll.participantFor(viewer)
        val existingComments = existingParticipant.materializedComments()
        require(existingComments.size < MAX_COMMENTS_PER_PARTICIPANT) {
            "コメントは1人 $MAX_COMMENTS_PER_PARTICIPANT 件までです"
        }
        val timestamp = now()
        val updatedParticipant =
            ParticipantRecord(
                name = viewer.traqId,
                traqId = viewer.traqId,
                userId = viewer.userId,
                note = "",
                comments =
                    existingComments +
                        ParticipantCommentRecord(
                            body = commentBody,
                            createdAt = timestamp,
                        ),
                responses = buildParticipantResponses(poll.candidateDates, existingParticipant?.responses.orEmpty()),
                updatedAt = timestamp,
            )
        val updatedPoll =
            repository.save(
                poll.replacingParticipant(viewer, updatedParticipant, timestamp),
            )
        return syncAnnouncement(updatedPoll).toDetails(viewer)
    }

    override suspend fun updateComment(
        id: String,
        command: UpdateCommentCommand,
        viewerIdentity: ViewerIdentity?,
    ): PollDetails {
        val poll = requireOpenPoll(id)
        val viewer = requireViewer(viewerIdentity)
        val commentBody = command.comment.trim()
        require(commentBody.isNotBlank()) { "コメントを入力してください" }
        require(commentBody.length <= MAX_COMMENT_LENGTH) {
            "コメントは $MAX_COMMENT_LENGTH 文字以内にしてください"
        }
        val createdAt = command.createdAt.trim()
        require(createdAt.isNotBlank()) { "編集するコメントが見つかりません" }
        require(createdAt.length <= MAX_TIMESTAMP_LENGTH) { "編集するコメントが見つかりません" }

        val existingParticipant =
            poll.participantFor(viewer)
                ?: throw NoSuchElementException("自分のコメントが見つかりません")
        val comments = existingParticipant.materializedComments()
        val commentIndex = comments.indexOfFirst { it.createdAt == createdAt }
        require(commentIndex >= 0) { "編集するコメントが見つかりません" }

        val timestamp = now()
        val updatedComments =
            comments.toMutableList().apply {
                this[commentIndex] = this[commentIndex].copy(body = commentBody)
            }
        val updatedParticipant =
            existingParticipant.copy(
                name = viewer.traqId,
                traqId = viewer.traqId,
                userId = viewer.userId,
                note = "",
                comments = updatedComments,
                responses = buildParticipantResponses(poll.candidateDates, existingParticipant.responses),
                updatedAt = timestamp,
            )
        val updatedPoll =
            repository.save(
                poll.replacingParticipant(viewer, updatedParticipant, timestamp),
            )
        return syncAnnouncement(updatedPoll).toDetails(viewer)
    }

    override suspend fun deleteComment(
        id: String,
        command: DeleteCommentCommand,
        viewerIdentity: ViewerIdentity?,
    ): PollDetails {
        val poll = requireOpenPoll(id)
        val viewer = requireViewer(viewerIdentity)
        val createdAt = command.createdAt.trim()
        require(createdAt.isNotBlank()) { "削除するコメントが見つかりません" }
        require(createdAt.length <= MAX_TIMESTAMP_LENGTH) { "削除するコメントが見つかりません" }

        val existingParticipant =
            poll.participantFor(viewer)
                ?: throw NoSuchElementException("自分のコメントが見つかりません")
        val materializedComments = existingParticipant.materializedComments()
        val updatedComments = materializedComments.filterNot { it.createdAt == createdAt }
        require(updatedComments.size != materializedComments.size) { "削除するコメントが見つかりません" }

        val timestamp = now()
        val updatedParticipant =
            existingParticipant.copy(
                name = viewer.traqId,
                traqId = viewer.traqId,
                userId = viewer.userId,
                note = "",
                comments = updatedComments,
                responses = buildParticipantResponses(poll.candidateDates, existingParticipant.responses),
                updatedAt = timestamp,
            )
        val updatedPoll =
            repository.save(
                poll.replacingParticipant(viewer, updatedParticipant, timestamp),
            )
        return syncAnnouncement(updatedPoll).toDetails(viewer)
    }

    private suspend fun requireSetupAccess(
        id: String,
        viewerIdentity: ViewerIdentity,
    ): PollRecord {
        val poll = repository.findById(id) ?: throw NoSuchElementException("調整が見つかりません")
        if (!poll.isOrganizer(viewerIdentity)) {
            throw ForbiddenException("この日程調整を設定できるのは作成者だけです")
        }
        return poll
    }

    private suspend fun requireOpenPoll(id: String): PollRecord {
        val poll = repository.findById(id) ?: throw NoSuchElementException("調整が見つかりません")
        require(poll.state == PollState.OPEN) { "まだ公開されていない調整です" }
        return poll
    }

    private suspend fun syncAnnouncement(poll: PollRecord): PollRecord {
        val gateway = announcementGateway ?: return poll
        if (poll.traqChannelId == null) {
            return poll
        }

        return try {
            val messageId = gateway.publishOrUpdate(poll) ?: return poll
            if (messageId == poll.announcementMessageId) {
                return poll
            }
            repository.updateAnnouncementMessageId(poll.id, messageId)
            poll.copy(announcementMessageId = messageId)
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            println("Failed to sync traQ announcement for poll=${poll.id}: ${error.message}")
            poll
        }
    }

    private fun PollRecord.toDetails(
        viewerIdentity: ViewerIdentity?,
    ): PollDetails =
        PollDetails(
            poll = this,
            summary = summaryCalculator.calculate(this),
            viewerIdentity = viewerIdentity,
        )

    private fun buildParticipantResponses(
        candidateDates: List<String>,
        responses: Map<String, DayAvailability>,
    ): Map<String, DayAvailability> = candidateDates.associateWith { date -> responses[date] ?: DayAvailability.NO }

    private fun requireViewer(viewerIdentity: ViewerIdentity?): ViewerIdentity =
        requireNotNull(viewerIdentity) {
            "traQ ユーザーを取得できませんでした。traQ から開き直してください"
        }

    private fun requireSetupViewer(viewerIdentity: ViewerIdentity?): ViewerIdentity =
        viewerIdentity ?: throw ForbiddenException("traQ から設定画面を開いてください")

    private companion object {
        const val MAX_TITLE_LENGTH = 255
        const val MAX_DESCRIPTION_LENGTH = 4_000
        const val MAX_CANDIDATE_DATES = 90
        const val MAX_COMMENT_LENGTH = 1_000
        const val MAX_COMMENTS_PER_PARTICIPANT = 50
        const val MAX_TIMESTAMP_LENGTH = 64
    }
}
