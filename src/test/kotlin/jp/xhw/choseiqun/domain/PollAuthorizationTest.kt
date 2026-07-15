package jp.xhw.choseiqun.domain

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PollAuthorizationTest {
    private val poll =
        PollRecord(
            id = "poll1234",
            title = "会議日程",
            createdAt = "2024-03-01T00:00:00Z",
            updatedAt = "2024-03-01T00:00:00Z",
            organizerUserId = "11111111-1111-4111-8111-111111111111",
            organizerTraqId = "creator",
        )

    @Test
    fun `organizer is authorized by user UUID`() {
        assertTrue(
            poll.isOrganizer(
                ViewerIdentity(
                    userId = "11111111-1111-4111-8111-111111111111",
                    traqId = "renamed-creator",
                ),
            ),
        )
    }

    @Test
    fun `matching traQ ID alone does not authorize another user`() {
        assertFalse(
            poll.isOrganizer(
                ViewerIdentity(
                    userId = "22222222-2222-4222-8222-222222222222",
                    traqId = "creator",
                ),
            ),
        )
    }
}
