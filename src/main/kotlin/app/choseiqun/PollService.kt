package app.choseiqun

import io.ktor.http.*
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.*

class PollService(
    private val repository: PollRepository,
    private val baseUrl: String,
    private val traqBaseUrl: String,
    private val announcementGateway: PollAnnouncementGateway? = null,
) {
    private val dayFormatter = DateTimeFormatter.ofPattern("M/d(E)")

    suspend fun createDraftPoll(command: CreateDraftPollCommand): PollRecord {
        val title = command.title.trim().ifBlank { "日程調整" }
        val now = Instant.now().toString()
        val poll =
            PollRecord(
                id = UUID.randomUUID().toString().take(8),
                setupToken = UUID.randomUUID().toString(),
                title = title,
                createdAt = now,
                updatedAt = now,
                organizerUserId = command.organizerUserId,
                traqChannelId = command.traqChannelId,
            )
        return repository.save(poll)
    }

    suspend fun listOpenPolls(): List<PollListItemResponse> =
        repository
            .list()
            .filter { it.state == PollState.OPEN }
            .map { it.toListItemResponse(baseUrl) }

    suspend fun getSetupPoll(
        id: String,
        token: String,
        viewerTraqId: String? = null,
    ): PollDetailResponse {
        val poll = requireSetupAccess(id, token)
        return poll.toDetailResponse(baseUrl, traqBaseUrl, buildSummary(poll), viewerTraqId, includeSetupUrl = true)
    }

    suspend fun completeSetup(
        id: String,
        token: String,
        request: CompleteSetupRequest,
    ): PollDetailResponse {
        val existing = requireSetupAccess(id, token)
        val title = request.title.trim()
        require(title.isNotBlank()) { "タイトルを入力してください" }

        val candidateDates =
            request.candidateDates
                .map { it.trim() }
                .filter { it.isNotBlank() }
                .map(::parseDate)
                .distinct()
                .sorted()
                .map { it.toString() }
        require(candidateDates.isNotEmpty()) { "候補日を1日以上選んでください" }
        require(candidateDates.size <= 90) { "候補日は 90 日以内にしてください" }

        val updated =
            repository.save(
                existing.copy(
                    title = title,
                    description = request.description.trim(),
                    state = PollState.OPEN,
                    candidateDates = candidateDates,
                    updatedAt = Instant.now().toString(),
                ),
            )
        val synced = syncAnnouncement(updated)
        return synced.toDetailResponse(baseUrl, traqBaseUrl, buildSummary(synced), includeSetupUrl = true)
    }

    suspend fun getPublicPoll(
        id: String,
        viewerTraqId: String? = null,
    ): PollDetailResponse {
        val poll = requireOpenPoll(id)
        return poll.toDetailResponse(baseUrl, traqBaseUrl, buildSummary(poll), viewerTraqId)
    }

    suspend fun upsertAvailability(
        id: String,
        request: UpsertAvailabilityRequest,
        viewerTraqId: String? = null,
    ): PollDetailResponse {
        val poll = requireOpenPoll(id)
        val normalizedTraqId = viewerTraqId?.trim()?.takeIf { it.isNotBlank() }
        require(normalizedTraqId != null) { "traQ ID を取得できませんでした。traQ から開き直してください" }
        val participantName = normalizedTraqId

        val normalizedName = participantName.lowercase()
        val existingParticipant =
            poll.participants.firstOrNull {
                it.traqId == normalizedTraqId || it.name.trim().lowercase() == normalizedName
            }
        val updatedParticipant =
            ParticipantRecord(
                name = participantName,
                traqId = normalizedTraqId,
                note = existingParticipant?.note.orEmpty(),
                comments = existingParticipant?.comments.orEmpty(),
                responses = buildParticipantResponses(poll.candidateDates, request.responses),
                updatedAt = Instant.now().toString(),
            )
        val mergedParticipants =
            poll.participants
                .toMutableList()
                .apply {
                    val index =
                        indexOfFirst {
                            it.traqId == normalizedTraqId || it.name.trim().lowercase() == normalizedName
                        }
                    if (index >= 0) {
                        this[index] = updatedParticipant
                    } else {
                        add(updatedParticipant)
                    }
                }.sortedBy { (it.traqId ?: it.name).lowercase() }

        val updatedPoll =
            repository.save(
                poll.copy(
                    participants = mergedParticipants,
                    updatedAt = Instant.now().toString(),
                ),
            )
        val synced = syncAnnouncement(updatedPoll)
        return synced.toDetailResponse(baseUrl, traqBaseUrl, buildSummary(synced), normalizedTraqId)
    }

    suspend fun postComment(
        id: String,
        request: PostCommentRequest,
        viewerTraqId: String? = null,
    ): PollDetailResponse {
        val poll = requireOpenPoll(id)
        val normalizedTraqId = viewerTraqId?.trim()?.takeIf { it.isNotBlank() }
        require(normalizedTraqId != null) { "traQ ID を取得できませんでした。traQ から開き直してください" }

        val commentBody = request.comment.trim()
        require(commentBody.isNotBlank()) { "コメントを入力してください" }

        val normalizedName = normalizedTraqId.lowercase()
        val existingParticipant =
            poll.participants.firstOrNull {
                it.traqId == normalizedTraqId || it.name.trim().lowercase() == normalizedName
            }
        val now = Instant.now().toString()
        val updatedParticipant =
            ParticipantRecord(
                name = normalizedTraqId,
                traqId = normalizedTraqId,
                note = "",
                comments =
                    existingParticipant.materializedComments() +
                        ParticipantCommentRecord(
                            body = commentBody,
                            createdAt = now,
                        ),
                responses = buildParticipantResponses(poll.candidateDates, existingParticipant?.responses.orEmpty()),
                updatedAt = now,
            )
        val mergedParticipants =
            poll.participants
                .toMutableList()
                .apply {
                    val index =
                        indexOfFirst {
                            it.traqId == normalizedTraqId || it.name.trim().lowercase() == normalizedName
                        }
                    if (index >= 0) {
                        this[index] = updatedParticipant
                    } else {
                        add(updatedParticipant)
                    }
                }.sortedBy { (it.traqId ?: it.name).lowercase() }

        val updatedPoll =
            repository.save(
                poll.copy(
                    participants = mergedParticipants,
                    updatedAt = now,
                ),
            )
        val synced = syncAnnouncement(updatedPoll)
        return synced.toDetailResponse(baseUrl, traqBaseUrl, buildSummary(synced), normalizedTraqId)
    }

    suspend fun updateComment(
        id: String,
        request: UpdateCommentRequest,
        viewerTraqId: String? = null,
    ): PollDetailResponse {
        val poll = requireOpenPoll(id)
        val normalizedTraqId = viewerTraqId?.trim()?.takeIf { it.isNotBlank() }
        require(normalizedTraqId != null) { "traQ ID を取得できませんでした。traQ から開き直してください" }

        val commentBody = request.comment.trim()
        require(commentBody.isNotBlank()) { "コメントを入力してください" }
        val createdAt = request.createdAt.trim()
        require(createdAt.isNotBlank()) { "編集するコメントが見つかりません" }

        val normalizedName = normalizedTraqId.lowercase()
        val existingParticipant =
            poll.participants.firstOrNull {
                it.traqId == normalizedTraqId || it.name.trim().lowercase() == normalizedName
            } ?: throw NoSuchElementException("自分のコメントが見つかりません")

        val materializedComments = existingParticipant.materializedComments()
        val commentIndex = materializedComments.indexOfFirst { it.createdAt == createdAt }
        require(commentIndex >= 0) { "編集するコメントが見つかりません" }

        val now = Instant.now().toString()
        val updatedComments =
            materializedComments.toMutableList().apply {
                this[commentIndex] = this[commentIndex].copy(body = commentBody)
            }
        val updatedParticipant =
            ParticipantRecord(
                name = normalizedTraqId,
                traqId = normalizedTraqId,
                note = "",
                comments = updatedComments,
                responses = buildParticipantResponses(poll.candidateDates, existingParticipant.responses),
                updatedAt = now,
            )
        val mergedParticipants =
            poll.participants
                .toMutableList()
                .apply {
                    val index =
                        indexOfFirst {
                            it.traqId == normalizedTraqId || it.name.trim().lowercase() == normalizedName
                        }
                    this[index] = updatedParticipant
                }.sortedBy { (it.traqId ?: it.name).lowercase() }

        val updatedPoll =
            repository.save(
                poll.copy(
                    participants = mergedParticipants,
                    updatedAt = now,
                ),
            )
        val synced = syncAnnouncement(updatedPoll)
        return synced.toDetailResponse(baseUrl, traqBaseUrl, buildSummary(synced), normalizedTraqId)
    }

    suspend fun deleteComment(
        id: String,
        request: DeleteCommentRequest,
        viewerTraqId: String? = null,
    ): PollDetailResponse {
        val poll = requireOpenPoll(id)
        val normalizedTraqId = viewerTraqId?.trim()?.takeIf { it.isNotBlank() }
        require(normalizedTraqId != null) { "traQ ID を取得できませんでした。traQ から開き直してください" }

        val createdAt = request.createdAt.trim()
        require(createdAt.isNotBlank()) { "削除するコメントが見つかりません" }

        val normalizedName = normalizedTraqId.lowercase()
        val existingParticipant =
            poll.participants.firstOrNull {
                it.traqId == normalizedTraqId || it.name.trim().lowercase() == normalizedName
            } ?: throw NoSuchElementException("自分のコメントが見つかりません")

        val materializedComments = existingParticipant.materializedComments()
        val updatedComments = materializedComments.filterNot { it.createdAt == createdAt }
        require(updatedComments.size != materializedComments.size) { "削除するコメントが見つかりません" }

        val now = Instant.now().toString()
        val updatedParticipant =
            ParticipantRecord(
                name = normalizedTraqId,
                traqId = normalizedTraqId,
                note = "",
                comments = updatedComments,
                responses = buildParticipantResponses(poll.candidateDates, existingParticipant.responses),
                updatedAt = now,
            )
        val mergedParticipants =
            poll.participants
                .toMutableList()
                .apply {
                    val index =
                        indexOfFirst {
                            it.traqId == normalizedTraqId || it.name.trim().lowercase() == normalizedName
                        }
                    this[index] = updatedParticipant
                }.sortedBy { (it.traqId ?: it.name).lowercase() }

        val updatedPoll =
            repository.save(
                poll.copy(
                    participants = mergedParticipants,
                    updatedAt = now,
                ),
            )
        val synced = syncAnnouncement(updatedPoll)
        return synced.toDetailResponse(baseUrl, traqBaseUrl, buildSummary(synced), normalizedTraqId)
    }

    private suspend fun requireSetupAccess(
        id: String,
        token: String,
    ): PollRecord {
        val poll = repository.findById(id) ?: throw NoSuchElementException("調整が見つかりません")
        require(token == poll.setupToken) { "設定用 URL が無効です" }
        return poll
    }

    private suspend fun requireOpenPoll(id: String): PollRecord {
        val poll = repository.findById(id) ?: throw NoSuchElementException("調整が見つかりません")
        require(poll.state == PollState.OPEN) { "まだ公開されていない調整です" }
        return poll
    }

    private suspend fun syncAnnouncement(poll: PollRecord): PollRecord {
        val gateway = announcementGateway ?: return poll
        if (poll.state != PollState.OPEN || poll.traqChannelId.isNullOrBlank()) {
            return poll
        }

        return try {
            val summary = buildSummary(poll)
            val content = TraqAnnouncementFormatter.format(poll, summary, baseUrl)
            val messageId = gateway.publishOrUpdate(poll, content) ?: poll.announcementMessageId
            val updated =
                poll.copy(
                    announcementMessageId = messageId,
                    updatedAt = Instant.now().toString(),
                )
            repository.save(updated)
        } catch (error: Throwable) {
            println("Failed to sync traQ announcement for poll=${poll.id}: ${error.message}")
            poll
        }
    }

    private fun buildSummary(poll: PollRecord): PollSummaryResponse {
        val candidateDates = poll.candidateDates
        if (candidateDates.isEmpty()) {
            return PollSummaryResponse(
                participantCount = poll.participants.size,
                recommendedDates = emptyList(),
                days = emptyList(),
            )
        }

        val days =
            candidateDates.map { key ->
                val day = parseDate(key)
                val responses = poll.participants.mapNotNull { it.responses[key] }
                val yesCount = responses.count { it == DayAvailability.YES }
                val maybeCount = responses.count { it == DayAvailability.MAYBE }
                val noCount = responses.count { it == DayAvailability.NO }
                DaySummaryResponse(
                    date = key,
                    label = day.format(dayFormatter),
                    yesCount = yesCount,
                    maybeCount = maybeCount,
                    noCount = noCount,
                    score = yesCount + maybeCount,
                )
            }
        val recommended =
            days
                .sortedWith(
                    compareByDescending<DaySummaryResponse> { it.score }
                        .thenByDescending { it.yesCount }
                        .thenBy { it.noCount }
                        .thenBy { it.date },
                ).take(3)

        return PollSummaryResponse(
            participantCount = poll.participants.size,
            recommendedDates = recommended,
            days = days,
        )
    }

    private fun parseDate(value: String): LocalDate =
        try {
            LocalDate.parse(value)
        } catch (_: Throwable) {
            throw IllegalArgumentException("日付は YYYY-MM-DD 形式で入力してください")
        }

    private fun buildParticipantResponses(
        candidateDates: List<String>,
        responses: Map<String, DayAvailability>,
    ): Map<String, DayAvailability> = candidateDates.associateWith { date -> responses[date] ?: DayAvailability.NO }
}

private fun PollRecord.toDetailResponse(
    baseUrl: String,
    traqBaseUrl: String,
    summary: PollSummaryResponse,
    viewerTraqId: String? = null,
    includeSetupUrl: Boolean = false,
): PollDetailResponse =
    PollDetailResponse(
        id = id,
        title = title,
        description = description,
        state = state,
        candidateDates = candidateDates,
        createdAt = createdAt,
        updatedAt = updatedAt,
        participantUrl = "${baseUrl.trimEnd('/')}/polls/$id",
        setupUrl =
            if (includeSetupUrl) {
                "${baseUrl.trimEnd('/')}/setup/$id?token=$setupToken"
            } else {
                null
            },
        announcementMessageId = announcementMessageId,
        viewerTraqId = viewerTraqId,
        viewerIconUrl = viewerTraqId?.let { traqIconUrl(traqBaseUrl, it) },
        participants =
            participants.map {
                val resolvedTraqId = it.traqId ?: it.name.takeIf { name -> name.matches(Regex("^[a-zA-Z0-9_\\-]+$")) }
                ParticipantResponse(
                    name = resolvedTraqId ?: it.name,
                    traqId = resolvedTraqId,
                    iconUrl = resolvedTraqId?.let { traqId -> traqIconUrl(traqBaseUrl, traqId) },
                    note = it.note,
                    comments = it.toCommentResponses(),
                    responses = it.responses,
                    updatedAt = it.updatedAt,
                )
            },
        summary = summary,
    )

private fun PollRecord.toListItemResponse(baseUrl: String): PollListItemResponse =
    PollListItemResponse(
        id = id,
        title = title,
        state = state,
        candidateDates = candidateDates,
        participantCount = participants.size,
        participantUrl = "${baseUrl.trimEnd('/')}/polls/$id",
        updatedAt = updatedAt,
    )

private fun traqIconUrl(
    traqBaseUrl: String,
    traqId: String,
): String = "${traqBaseUrl.trimEnd('/')}/api/v3/public/icon/${traqId.encodeURLPathPart()}"

private fun ParticipantRecord.toCommentResponses(): List<ParticipantCommentResponse> =
    materializedComments().map {
        ParticipantCommentResponse(
            body = it.body,
            createdAt = it.createdAt,
        )
    }

private fun ParticipantRecord?.materializedComments(): List<ParticipantCommentRecord> {
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
