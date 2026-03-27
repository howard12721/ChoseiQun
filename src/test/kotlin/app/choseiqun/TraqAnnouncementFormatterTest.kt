package app.choseiqun

import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.uuid.Uuid

class TraqAnnouncementFormatterTest {
    @Test
    fun `format includes voters for each candidate date`() {
        val poll =
            PollRecord(
                id = "poll1234",
                setupToken = "setup-token",
                title = "会議日程",
                candidateDates = listOf("2024-03-03", "2024-03-04"),
                createdAt = "2024-03-01T00:00:00Z",
                updatedAt = "2024-03-01T00:00:00Z",
                organizerUserId = "organizer",
                traqChannelId = Uuid.parse("0199bd73-6e35-7c81-9d8e-7b0d243ad4ac"),
                participants =
                    listOf(
                        ParticipantRecord(
                            name = "howard127",
                            traqId = "howard127",
                            responses =
                                mapOf(
                                    "2024-03-03" to DayAvailability.YES,
                                    "2024-03-04" to DayAvailability.NO,
                                ),
                            updatedAt = "2024-03-01T00:00:00Z",
                        ),
                        ParticipantRecord(
                            name = "howard128",
                            traqId = "howard128",
                            responses =
                                mapOf(
                                    "2024-03-03" to DayAvailability.MAYBE,
                                    "2024-03-04" to DayAvailability.YES,
                                ),
                            updatedAt = "2024-03-01T00:00:00Z",
                        ),
                    ),
            )
        val summary =
            PollSummaryResponse(
                participantCount = 2,
                recommendedDates = emptyList(),
                days = emptyList(),
            )

        val message = TraqAnnouncementFormatter.format(poll, summary, "https://example.com")

        assertContains(message, "日ごとの回答:")
        assertContains(message, "3/3(日): :@howard127: (:@howard128:)")
        assertContains(message, "3/4(月): :@howard128:")
    }
}
