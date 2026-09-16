package jp.xhw.choseiqun.application.poll

import jp.xhw.choseiqun.domain.DayAvailability
import jp.xhw.choseiqun.domain.PollRecord
import kotlinx.datetime.LocalDate

class PollSummaryCalculator {
    fun calculate(poll: PollRecord): PollSummary {
        if (poll.candidates.isEmpty()) {
            return PollSummary(
                participantCount = poll.participants.size,
                recommendedDates = emptyList(),
                days = emptyList(),
            )
        }

        val days =
            poll.candidates.map { candidate ->
                val key = candidate.candidateKey
                val responses = poll.participants.mapNotNull { it.responses[key] }
                val yesCount = responses.count { it == DayAvailability.YES }
                val maybeCount = responses.count { it == DayAvailability.MAYBE }
                val noCount = responses.count { it == DayAvailability.NO }
                DaySummary(
                    date = candidate.date,
                    candidateKey = key,
                    startTime = candidate.startTime,
                    endTime = candidate.endTime,
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
                        .thenBy { it.candidateKey },
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
