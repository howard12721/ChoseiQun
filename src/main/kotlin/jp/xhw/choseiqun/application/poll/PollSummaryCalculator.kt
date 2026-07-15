package jp.xhw.choseiqun.application.poll

import jp.xhw.choseiqun.domain.DayAvailability
import jp.xhw.choseiqun.domain.PollRecord
import kotlinx.datetime.LocalDate

class PollSummaryCalculator {
    fun calculate(poll: PollRecord): PollSummary {
        if (poll.candidateDates.isEmpty()) {
            return PollSummary(
                participantCount = poll.participants.size,
                recommendedDates = emptyList(),
                days = emptyList(),
            )
        }

        val days =
            poll.candidateDates.map { key ->
                parseDate(key)
                val responses = poll.participants.mapNotNull { it.responses[key] }
                val yesCount = responses.count { it == DayAvailability.YES }
                val maybeCount = responses.count { it == DayAvailability.MAYBE }
                val noCount = responses.count { it == DayAvailability.NO }
                DaySummary(
                    date = key,
                    yesCount = yesCount,
                    maybeCount = maybeCount,
                    noCount = noCount,
                    score = yesCount + maybeCount,
                )
            }
        val recommended =
            days
                .sortedWith(
                    compareByDescending<DaySummary> { it.score }
                        .thenByDescending { it.yesCount }
                        .thenBy { it.noCount }
                        .thenBy { it.date },
                ).take(3)

        return PollSummary(
            participantCount = poll.participants.size,
            recommendedDates = recommended,
            days = days,
        )
    }

    fun parseDate(value: String): LocalDate =
        try {
            LocalDate.parse(value)
        } catch (_: Throwable) {
            throw IllegalArgumentException("日付は YYYY-MM-DD 形式で入力してください")
        }
}
