package jp.xhw.choseiqun.presentation.http

import io.ktor.http.encodeURLPathPart
import jp.xhw.choseiqun.application.poll.DaySummary
import jp.xhw.choseiqun.application.poll.PollDetails
import jp.xhw.choseiqun.application.poll.PollSummary
import jp.xhw.choseiqun.application.port.PollListRecord
import jp.xhw.choseiqun.domain.ParticipantRecord
import jp.xhw.choseiqun.domain.ViewerIdentity
import jp.xhw.choseiqun.domain.belongsTo
import jp.xhw.choseiqun.domain.materializedComments
import kotlinx.datetime.LocalDate

class PollHttpPresenter(
    private val publicBaseUrl: String,
    private val traqBaseUrl: String,
) {
    fun detail(
        details: PollDetails,
        includeSetupUrl: Boolean = false,
    ): PollDetailResponse {
        val poll = details.poll
        val viewer = details.viewerIdentity
        return PollDetailResponse(
            id = poll.id,
            title = poll.title,
            description = poll.description,
            state = poll.state,
            candidateDates = poll.candidateDates,
            createdAt = poll.createdAt,
            updatedAt = poll.updatedAt,
            participantUrl = participantUrl(poll.id),
            setupUrl =
                if (includeSetupUrl || (viewer != null && poll.isOrganizer(viewer))) {
                    "${publicBaseUrl.trimEnd('/')}/setup/${poll.id}"
                } else {
                    null
                },
            viewerTraqId = viewer?.traqId,
            viewerIconUrl = viewer?.traqId?.let(::traqIconUrl),
            participants = poll.participants.map { record -> participant(record, viewer) },
            summary = summary(details.summary),
        )
    }

    fun listItem(record: PollListRecord): PollListItemResponse =
        PollListItemResponse(
            id = record.id,
            title = record.title,
            state = record.state,
            candidateDates = record.candidateDates,
            participantCount = record.participantCount,
            respondedByViewer = record.respondedByViewer,
            createdByViewer = record.createdByViewer,
            viewerResponses = record.viewerResponses,
            participantUrl = participantUrl(record.id),
            updatedAt = record.updatedAt,
        )

    private fun participant(
        participant: ParticipantRecord,
        viewer: ViewerIdentity?,
    ): ParticipantResponse {
        val resolvedTraqId =
            participant.traqId
                ?: participant.name.takeIf { it.matches(TRAQ_ID_PATTERN) }
        return ParticipantResponse(
            name = resolvedTraqId ?: participant.name,
            traqId = resolvedTraqId,
            isViewer = viewer != null && participant.belongsTo(viewer),
            iconUrl = resolvedTraqId?.let(::traqIconUrl),
            note = participant.note,
            comments =
                participant.materializedComments().map {
                    ParticipantCommentResponse(body = it.body, createdAt = it.createdAt)
                },
            responses = participant.responses,
            updatedAt = participant.updatedAt,
        )
    }

    private fun summary(summary: PollSummary): PollSummaryResponse =
        PollSummaryResponse(
            participantCount = summary.participantCount,
            recommendedDates = summary.recommendedDates.map(::daySummary),
            days = summary.days.map(::daySummary),
        )

    private fun daySummary(day: DaySummary): DaySummaryResponse =
        DaySummaryResponse(
            date = day.date,
            label = formatDateLabel(LocalDate.parse(day.date)),
            yesCount = day.yesCount,
            maybeCount = day.maybeCount,
            noCount = day.noCount,
            score = day.score,
        )

    private fun participantUrl(id: String): String = "${publicBaseUrl.trimEnd('/')}/polls/$id"

    private fun traqIconUrl(traqId: String): String =
        "${traqBaseUrl.trimEnd('/')}/api/v3/public/icon/${traqId.encodeURLPathPart()}"

    private companion object {
        val TRAQ_ID_PATTERN = Regex("^[a-zA-Z0-9_\\-]+$")
    }
}

private val JAPANESE_WEEKDAYS = listOf("月", "火", "水", "木", "金", "土", "日")

private fun formatDateLabel(date: LocalDate): String =
    "${date.month.ordinal + 1}/${date.day}(${JAPANESE_WEEKDAYS[date.dayOfWeek.ordinal]})"
