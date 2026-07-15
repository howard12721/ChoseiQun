package jp.xhw.choseiqun.application.poll

import jp.xhw.choseiqun.domain.DayAvailability
import jp.xhw.choseiqun.domain.ParticipantRecord
import jp.xhw.choseiqun.domain.PollRecord
import kotlin.test.Test
import kotlin.test.assertEquals

class PollSummaryCalculatorTest {
    private val calculator = PollSummaryCalculator()

    @Test
    fun `recommended dates follow score yes no and date tie breakers`() {
        val poll =
            poll(
                candidateDates = listOf("2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04"),
                participantResponses =
                    listOf(
                        mapOf(
                            "2026-07-01" to DayAvailability.YES,
                            "2026-07-02" to DayAvailability.YES,
                            "2026-07-03" to DayAvailability.YES,
                            "2026-07-04" to DayAvailability.YES,
                        ),
                        mapOf(
                            "2026-07-01" to DayAvailability.MAYBE,
                            "2026-07-02" to DayAvailability.YES,
                            "2026-07-03" to DayAvailability.YES,
                            "2026-07-04" to DayAvailability.YES,
                        ),
                        mapOf(
                            "2026-07-01" to DayAvailability.NO,
                            "2026-07-02" to DayAvailability.NO,
                            "2026-07-03" to DayAvailability.MAYBE,
                            "2026-07-04" to DayAvailability.YES,
                        ),
                    ),
            )

        val summary = calculator.calculate(poll)

        assertEquals(
            listOf("2026-07-04", "2026-07-03", "2026-07-02"),
            summary.recommendedDates.map(DaySummary::date),
        )
        assertEquals(3, summary.participantCount)
    }

    @Test
    fun `empty candidate dates still report participant count`() {
        val summary = calculator.calculate(poll(candidateDates = emptyList(), participantResponses = listOf(emptyMap())))

        assertEquals(1, summary.participantCount)
        assertEquals(emptyList(), summary.days)
    }

    private fun poll(
        candidateDates: List<String>,
        participantResponses: List<Map<String, DayAvailability>>,
    ): PollRecord =
        PollRecord(
            id = "poll1234",
            title = "会議日程",
            candidateDates = candidateDates,
            createdAt = "2026-07-01T00:00:00Z",
            updatedAt = "2026-07-01T00:00:00Z",
            organizerUserId = "organizer",
            participants =
                participantResponses.mapIndexed { index, responses ->
                    ParticipantRecord(
                        name = "user$index",
                        responses = responses,
                        updatedAt = "2026-07-01T00:00:00Z",
                    )
                },
        )
}
