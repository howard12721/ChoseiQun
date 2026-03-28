package jp.xhw.choseiqun

import jp.xhw.trakt.bot.TraktClient
import jp.xhw.trakt.bot.scope.fetchChannel
import jp.xhw.trakt.bot.scope.fetchMessage
import jp.xhw.trakt.bot.scope.sendMessage
import jp.xhw.trakt.bot.scope.update
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.*
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
                val channelId = poll.traqChannelId ?: return@execute
                val channel = fetchChannel(channelId)
                val message = channel.sendMessage(content)
                messageId = message.id.value
            } else {
                val message = fetchMessage(poll.announcementMessageId)
                message.update(content)
            }
        }
        return messageId
    }
}

object TraqAnnouncementFormatter {
    private val dateLabelFormatter = DateTimeFormatter.ofPattern("M/d(E)", Locale.JAPANESE)

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
        lines += "参加者向けリンク: $participantUrl"
        lines += "回答者: ${poll.participants.map { it.traqId }.joinToString("") { ":@$it:" }}"
        if (poll.candidateDates.isNotEmpty()) {
            lines += ""
            lines += "日ごとの回答:"
            poll.candidateDates.forEach { date ->
                val label = LocalDate.parse(date).format(dateLabelFormatter)
                val yesParticipants = poll.participants.filterByAvailability(date, DayAvailability.YES)
                val maybeParticipants = poll.participants.filterByAvailability(date, DayAvailability.MAYBE)
                lines += "$label: ${formatAvailabilityLine(yesParticipants, maybeParticipants)}"
            }
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
