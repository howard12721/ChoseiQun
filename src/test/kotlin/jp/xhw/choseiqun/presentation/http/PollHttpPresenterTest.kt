package jp.xhw.choseiqun.presentation.http

import jp.xhw.choseiqun.application.poll.PollDetails
import jp.xhw.choseiqun.application.poll.PollSummary
import jp.xhw.choseiqun.domain.ParticipantRecord
import jp.xhw.choseiqun.domain.PollRecord
import jp.xhw.choseiqun.domain.ViewerIdentity
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class PollHttpPresenterTest {
    private val presenter = PollHttpPresenter("https://chosei.example/", "https://q.example/")

    @Test
    fun `organizer receives setup url and encoded viewer icon url`() {
        val viewer = ViewerIdentity("organizer-id", "alice/renamed")
        val response = presenter.detail(details(viewer))

        assertEquals("https://chosei.example/setup/poll1234", response.setupUrl)
        assertEquals("https://q.example/api/v3/public/icon/alice%2Frenamed", response.viewerIconUrl)
        assertEquals("https://chosei.example/polls/poll1234", response.participantUrl)
    }

    @Test
    fun `non organizer does not receive setup url`() {
        val response = presenter.detail(details(ViewerIdentity("another-user", "bob")))

        assertNull(response.setupUrl)
    }

    private fun details(viewer: ViewerIdentity): PollDetails =
        PollDetails(
            poll =
                PollRecord(
                    id = "poll1234",
                    title = "会議日程",
                    createdAt = "2026-07-01T00:00:00Z",
                    updatedAt = "2026-07-01T00:00:00Z",
                    organizerUserId = "organizer-id",
                    participants =
                        listOf(
                            ParticipantRecord(
                                name = "guest user",
                                updatedAt = "2026-07-01T00:00:00Z",
                            ),
                        ),
                ),
            summary = PollSummary(1, emptyList(), emptyList()),
            viewerIdentity = viewer,
        )
}
