package jp.xhw.choseiqun

import jp.xhw.trakt.bot.context.base.*
import jp.xhw.trakt.bot.infrastructure.client.TraktClient
import jp.xhw.trakt.bot.model.ChannelId
import jp.xhw.trakt.bot.model.MessageId
import kotlinx.datetime.LocalDate
import kotlin.uuid.Uuid

interface PollAnnouncementGateway {
    suspend fun publishOrUpdate(
        poll: PollRecord,
        content: String,
    ): Uuid?
}

class TraqAnnouncementGateway(
    private val client: TraktClient,
) : PollAnnouncementGateway {
    override suspend fun publishOrUpdate(
        poll: PollRecord,
        content: String,
    ): Uuid? {
        var messageId: Uuid? = poll.announcementMessageId
        client.execute {
            if (poll.announcementMessageId == null) {
                val channelId = poll.traqChannelId?.let(::ChannelId) ?: return@execute
                val channel = fetchChannel(channelId)
                val message = channel.sendMessage(content)
                messageId = message.id.value
            } else {
                val message = fetchMessage(MessageId(poll.announcementMessageId))
                message.update(content)
            }
        }
        return messageId
    }
}

object TraqAnnouncementFormatter {
    fun format(
        poll: PollRecord,
        summary: PollSummaryResponse,
        baseUrl: String,
    ): String {
        val lines = mutableListOf<String>()
        val participantUrl = "${baseUrl.trimEnd('/')}/polls/${poll.id}"
        lines += "## :calendar: ${poll.title}"
        if (poll.description.isNotBlank()) {
            lines += poll.description
        }
        if (poll.state == PollState.DRAFT) {
            lines += "設定URL: ${baseUrl.trimEnd('/')}/setup/${poll.id}"
            return lines.joinToString("\n")
        }
        lines += "参加者向けリンク: $participantUrl"
        lines += "回答者: ${poll.participants.map { it.traqId }.joinToString("") { ":@$it:" }}"
        if (poll.candidateDates.isNotEmpty()) {
            lines += ""
            lines += "日ごとの回答:"
            poll.candidateDates.forEach { date ->
                val label = formatDateLabel(LocalDate.parse(date))
                val yesParticipants = poll.participants.filterByAvailability(date, DayAvailability.YES)
                val maybeParticipants = poll.participants.filterByAvailability(date, DayAvailability.MAYBE)
                lines += "$label: ${formatAvailabilityLine(yesParticipants, maybeParticipants)}"
            }
        }
        val participantComments = poll.participants.flatMap(::formatParticipantComments)
        if (participantComments.isNotEmpty()) {
            lines += ""
            lines += "コメント:"
            lines += participantComments
        }
        return lines.joinToString("\n")
    }

    private fun List<ParticipantRecord>.filterByAvailability(
        date: String,
        availability: DayAvailability,
    ): List<String> =
        filter { it.responses[date] == availability }
            .map(::formatParticipant)

    private fun formatParticipant(participant: ParticipantRecord): String = participant.traqId?.let { ":@$it:" } ?: participant.name

    private fun formatParticipantComments(participant: ParticipantRecord): List<String> {
        val commentBodies =
            buildList {
                participant.note.takeIf { it.isNotBlank() }?.let(::add)
                participant.comments.mapTo(this) { it.body }
            }.map(::formatCommentBody)
                .filter { it.isNotBlank() }
        return commentBodies.map { "- ${formatParticipant(participant)} — $it" }
    }

    private fun formatCommentBody(body: String): String =
        body.lineSequence()
            .map(String::trim)
            .filter(String::isNotEmpty)
            .joinToString(" / ")

    private fun formatAvailabilityLine(
        yesParticipants: List<String>,
        maybeParticipants: List<String>,
    ): String =
        buildString {
            append(yesParticipants.joinToString(" ").ifBlank { "-" })
            if (maybeParticipants.isNotEmpty()) {
                append(" (${maybeParticipants.joinToString(" ")})")
            }
        }
}
