package jp.xhw.choseiqun.application.poll

import jp.xhw.choseiqun.application.port.PollListRecord
import jp.xhw.choseiqun.application.port.PollRepository
import jp.xhw.choseiqun.domain.DayAvailability
import jp.xhw.choseiqun.domain.ParticipantCommentRecord
import jp.xhw.choseiqun.domain.ParticipantRecord
import jp.xhw.choseiqun.domain.PollRecord
import jp.xhw.choseiqun.domain.PollState
import jp.xhw.choseiqun.domain.ViewerIdentity
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue
import kotlin.uuid.Uuid

class PollServiceTest {
    private val viewer =
        ViewerIdentity(
            userId = "11111111-1111-4111-8111-111111111111",
            traqId = "alice",
        )

    @Test
    fun `new poll ids use a full UUID instead of a short prefix`() =
        runBlocking {
            val repository = FakePollRepository(draftPoll())
            val service = PollService(repository, now = { "2026-07-15T10:00:00Z" })

            val poll =
                service.createDraftPoll(
                    CreateDraftPollCommand(
                        title = "会議",
                        organizerUserId = viewer.userId,
                        organizerTraqId = viewer.traqId,
                        traqChannelId = Uuid.parse("33333333-3333-4333-8333-333333333333"),
                    ),
                )

            assertEquals(32, poll.id.length)
            assertTrue(poll.id.matches(Regex("^[0-9a-f]{32}$")))
        }

    @Test
    fun `setup normalizes candidate dates before persistence`() =
        runBlocking {
            val repository = FakePollRepository(draftPoll())
            val service = service(repository)

            val details =
                service.completeSetup(
                    id = "poll1234",
                    command =
                        CompleteSetupCommand(
                            title = "  定例会  ",
                            description = "  説明  ",
                            candidateDates = listOf(" 2026-07-03 ", "2026-07-01", "2026-07-03"),
                        ),
                    viewerIdentity = viewer,
                )

            assertEquals(PollState.OPEN, details.poll.state)
            assertEquals("定例会", details.poll.title)
            assertEquals("説明", details.poll.description)
            assertEquals(listOf("2026-07-01", "2026-07-03"), details.poll.candidateDates)
            assertEquals("2026-07-15T10:00:00Z", details.poll.updatedAt)
            assertEquals(details.poll, repository.poll)
        }

    @Test
    fun `setup rejects oversized text before persistence`() =
        runBlocking {
            val repository = FakePollRepository(draftPoll())
            val service = service(repository)

            assertFailsWith<IllegalArgumentException> {
                service.completeSetup(
                    id = "poll1234",
                    command =
                        CompleteSetupCommand(
                            title = "x".repeat(256),
                            candidateDates = listOf("2026-07-20"),
                        ),
                    viewerIdentity = viewer,
                )
            }
            assertEquals(draftPoll(), repository.poll)
        }

    @Test
    fun `comments reject oversized bodies before persistence`() =
        runBlocking {
            val openPoll = draftPoll().copy(state = PollState.OPEN)
            val repository = FakePollRepository(openPoll)
            val service = service(repository)

            assertFailsWith<IllegalArgumentException> {
                service.postComment(
                    id = "poll1234",
                    command = PostCommentCommand("x".repeat(1_001)),
                    viewerIdentity = viewer,
                )
            }
            assertEquals(openPoll, repository.poll)
        }

    @Test
    fun `availability keeps comments and limits responses to candidate dates`() =
        runBlocking {
            val existingComment = ParticipantCommentRecord("既存コメント", "2026-07-01T00:00:00Z")
            val repository =
                FakePollRepository(
                    draftPoll().copy(
                        state = PollState.OPEN,
                        candidateDates = listOf("2026-07-20", "2026-07-21"),
                        participants =
                            listOf(
                                ParticipantRecord(
                                    name = viewer.traqId,
                                    traqId = viewer.traqId,
                                    userId = viewer.userId,
                                    note = "旧コメント",
                                    comments = listOf(existingComment),
                                    responses = emptyMap(),
                                    updatedAt = "2026-07-01T00:00:00Z",
                                ),
                            ),
                    ),
                )
            val service = service(repository)

            val details =
                service.upsertAvailability(
                    id = "poll1234",
                    command =
                        UpsertAvailabilityCommand(
                            responses =
                                mapOf(
                                    "2026-07-20" to DayAvailability.YES,
                                    "2099-01-01" to DayAvailability.MAYBE,
                                ),
                        ),
                    viewerIdentity = viewer,
                )

            val participant = details.poll.participants.single()
            assertEquals("旧コメント", participant.note)
            assertEquals(listOf(existingComment), participant.comments)
            assertEquals(
                mapOf(
                    "2026-07-20" to DayAvailability.YES,
                    "2026-07-21" to DayAvailability.NO,
                ),
                participant.responses,
            )
            assertFalse("2099-01-01" in participant.responses)
        }

    @Test
    fun `new announcement id is persisted through repository port`() =
        runBlocking {
            val messageId = Uuid.parse("22222222-2222-4222-8222-222222222222")
            val repository = FakePollRepository(draftPoll())
            val service =
                PollService(
                    repository = repository,
                    announcementGateway = { messageId },
                    now = { "2026-07-15T10:00:00Z" },
                    newPollId = { "poll1234" },
                )

            val poll =
                service.createDraftPoll(
                    CreateDraftPollCommand(
                        title = "会議",
                        organizerUserId = viewer.userId,
                        organizerTraqId = viewer.traqId,
                        traqChannelId = Uuid.parse("33333333-3333-4333-8333-333333333333"),
                    ),
                )

            assertEquals(messageId, poll.announcementMessageId)
            assertEquals(listOf("poll1234" to messageId), repository.announcementUpdates)
        }

    @Test
    fun `announcement cancellation is propagated`() =
        runBlocking {
            val repository = FakePollRepository(draftPoll())
            val service =
                PollService(
                    repository = repository,
                    announcementGateway = { throw CancellationException("stopping") },
                    now = { "2026-07-15T10:00:00Z" },
                    newPollId = { "poll1234" },
                )

            assertFailsWith<CancellationException> {
                service.createDraftPoll(
                    CreateDraftPollCommand(
                        title = "会議",
                        organizerUserId = viewer.userId,
                        organizerTraqId = viewer.traqId,
                        traqChannelId = Uuid.parse("33333333-3333-4333-8333-333333333333"),
                    ),
                )
            }
            Unit
        }

    private fun service(repository: PollRepository): PollService =
        PollService(
            repository = repository,
            now = { "2026-07-15T10:00:00Z" },
            newPollId = { "poll1234" },
        )

    private fun draftPoll(): PollRecord =
        PollRecord(
            id = "poll1234",
            title = "会議日程",
            createdAt = "2026-07-01T00:00:00Z",
            updatedAt = "2026-07-01T00:00:00Z",
            organizerUserId = viewer.userId,
            organizerTraqId = viewer.traqId,
        )
}

private class FakePollRepository(
    var poll: PollRecord,
) : PollRepository {
    val announcementUpdates = mutableListOf<Pair<String, Uuid>>()

    override suspend fun updateAnnouncementMessageId(
        pollId: String,
        messageId: Uuid,
    ) {
        announcementUpdates += pollId to messageId
    }

    override suspend fun findById(id: String): PollRecord? = poll.takeIf { it.id == id }

    override suspend fun save(record: PollRecord): PollRecord {
        poll = record
        return record
    }

    override suspend fun listOpenForViewer(viewerUserId: String): List<PollListRecord> = emptyList()
}
