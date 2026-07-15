package jp.xhw.choseiqun.infrastructure.traq

import jp.xhw.choseiqun.domain.DayAvailability
import jp.xhw.choseiqun.domain.ParticipantCommentRecord
import jp.xhw.choseiqun.domain.ParticipantRecord
import jp.xhw.choseiqun.domain.PollRecord
import jp.xhw.choseiqun.domain.PollState
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertFalse
import kotlin.uuid.Uuid

class TraqAnnouncementFormatterTest {
    @Test
    fun `format includes voters for each candidate date`() {
        val poll =
            PollRecord(
                id = "poll1234",
                title = "会議日程",
                state = PollState.OPEN,
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
        val message = TraqAnnouncementFormatter.format(poll, "https://example.com")

        assertContains(message, "日ごとの回答:")
        assertContains(message, "3/3(日): :@howard127: (:@howard128:)")
        assertContains(message, "3/4(月): :@howard128:")
    }

    @Test
    fun `format lists materialized comments separately without breaking markdown across lines`() {
        val poll =
            PollRecord(
                id = "poll1234",
                title = "会議日程",
                state = PollState.OPEN,
                candidateDates = emptyList(),
                createdAt = "2024-03-01T00:00:00Z",
                updatedAt = "2024-03-01T00:00:00Z",
                organizerUserId = "organizer",
                participants =
                    listOf(
                        ParticipantRecord(
                            name = "howard127",
                            traqId = "howard127",
                            note = "以前の補足\n  2行目",
                            comments =
                                listOf(
                                    ParticipantCommentRecord(
                                        body = "最初のコメント",
                                        createdAt = "2024-03-01T12:00:00Z",
                                    ),
                                    ParticipantCommentRecord(
                                        body = "新しいコメント\n\n- Markdownの箇条書き",
                                        createdAt = "2024-03-02T00:00:00Z",
                                    ),
                                ),
                            updatedAt = "2024-03-01T00:00:00Z",
                        ),
                        ParticipantRecord(
                            name = "ゲスト参加者",
                            note = "legacy note only",
                            updatedAt = "2024-03-01T00:00:00Z",
                        ),
                    ),
            )
        val message = TraqAnnouncementFormatter.format(poll, "https://example.com")

        assertContains(message, "コメント:")
        assertContains(
            message,
            "- :@howard127: — 以前の補足 / 2行目\n" +
                "- :@howard127: — 最初のコメント\n" +
                "- :@howard127: — 新しいコメント / - Markdownの箇条書き",
        )
        assertContains(message, "- ゲスト参加者 — legacy note only")
        assertFalse(message.contains(" · "))
        assertFalse(message.contains("\n- Markdownの箇条書き"))
    }

    @Test
    fun `draft summary includes tokenless setup url instead of participant url`() {
        val poll =
            PollRecord(
                id = "poll1234",
                title = "会議日程",
                state = PollState.DRAFT,
                createdAt = "2024-03-01T00:00:00Z",
                updatedAt = "2024-03-01T00:00:00Z",
                organizerUserId = "organizer",
            )
        val message = TraqAnnouncementFormatter.format(poll, "https://example.com")

        assertContains(message, "設定URL: https://example.com/setup/poll1234")
        assertFalse(message.contains("?token="))
        assertFalse(message.contains("参加者向けリンク:"))
    }
}
