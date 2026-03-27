package app.choseiqun

import jp.xhw.trakt.bot.scope.fetchChannel
import jp.xhw.trakt.bot.scope.fetchMessage
import jp.xhw.trakt.bot.scope.sendMessage
import jp.xhw.trakt.bot.scope.update
import jp.xhw.trakt.bot.trakt
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.uuid.Uuid

interface PollAnnouncementGateway {
    suspend fun publishOrUpdate(
        poll: PollRecord,
        content: String,
    ): String?
}

class LoggingAnnouncementGateway : PollAnnouncementGateway {
    override suspend fun publishOrUpdate(
        poll: PollRecord,
        content: String,
    ): String? {
        println("Announcement skipped for poll=${poll.id}: $content")
        return poll.announcementMessageId
    }
}

class TraqAnnouncementGateway(
    private val config: TraqBotConfig,
) : PollAnnouncementGateway {
    private val client =
        trakt(
            token = config.token,
            botId = config.botId,
            origin = config.traqOrigin,
        ) {}

    override suspend fun publishOrUpdate(
        poll: PollRecord,
        content: String,
    ): String? {
        var messageId: String? = poll.announcementMessageId
        client.execute {
            if (poll.announcementMessageId.isNullOrBlank()) {
                val channelId = poll.traqChannelId ?: return@execute
                val channel = fetchChannel(Uuid.parse(channelId))
                val message = channel.sendMessage(content)
                messageId = message.id.toString()
            } else {
                val message = fetchMessage(Uuid.parse(poll.announcementMessageId))
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
        if (poll.candidateDates.isNotEmpty()) {
            val preview =
                poll.candidateDates
                    .take(5)
                    .joinToString(", ") { date ->
                        LocalDate.parse(date).format(dateLabelFormatter)
                    }
            val suffix = if (poll.candidateDates.size > 5) " ほか${poll.candidateDates.size - 5}日" else ""
            lines += "候補日: $preview$suffix"
        }
        lines += "参加者向けリンク: $participantUrl"
        lines += "回答者: ${summary.participantCount}人"
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
        if (summary.recommendedDates.isNotEmpty()) {
            lines += ""
            lines += "おすすめ候補:"
            summary.recommendedDates.take(3).forEachIndexed { index, day ->
                val label = LocalDate.parse(day.date).format(dateLabelFormatter)
                lines += "${index + 1}. $label :o:${day.yesCount} :iketara:${day.maybeCount} :x:${day.noCount}"
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
