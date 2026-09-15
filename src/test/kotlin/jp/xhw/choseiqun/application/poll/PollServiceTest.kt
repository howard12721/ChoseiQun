package jp.xhw.choseiqun.application.poll

import jp.xhw.choseiqun.application.port.PollListRecord
import jp.xhw.choseiqun.application.port.PollRepository
import jp.xhw.choseiqun.domain.DayAvailability
import jp.xhw.choseiqun.domain.ParticipantCommentRecord
import jp.xhw.choseiqun.domain.ParticipantRecord
import jp.xhw.choseiqun.domain.PollCandidate
import jp.xhw.choseiqun.domain.ScheduleType
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
                        candidates = listOf("2026-07-20", "2026-07-21").map { PollCandidate(it) },
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

    @Test
    fun `timed candidates deduplicate and keep separate answers with NO defaults`() = runBlocking {
        val repository = FakePollRepository(draftPoll())
        val service = service(repository)
        val first = PollCandidate("2026-09-21", "18:00", "19:00")
        val second = PollCandidate("2026-09-21", "19:30", "20:30")
        val setup = service.completeSetup("poll1234", CompleteSetupCommand(
            title = "会議", scheduleType = ScheduleType.TIMED,
            candidateDates = listOf(first.date), candidates = listOf(second, first, first),
        ), viewer)
        assertEquals(listOf(first, second), setup.poll.candidates)
        val answered = service.upsertAvailability("poll1234", UpsertAvailabilityCommand(
            mapOf(first.candidateKey to DayAvailability.YES),
        ), viewer)
        assertEquals(mapOf(first.candidateKey to DayAvailability.YES, second.candidateKey to DayAvailability.NO), answered.poll.participants.single().responses)
        assertEquals(listOf(1, 0), answered.summary.days.map { it.yesCount })
        assertEquals(listOf(0, 1), answered.summary.days.map { it.noCount })
        assertFailsWith<IllegalArgumentException> {
            service.upsertAvailability("poll1234", UpsertAvailabilityCommand(mapOf("2026-09-22" to DayAvailability.YES)), viewer)
        }
        val edited = service.completeSetup("poll1234", CompleteSetupCommand(
            title = "会議", scheduleType = ScheduleType.TIMED,
            candidates = listOf(first.copy(startTime = "17:00"), second),
        ), viewer)
        assertEquals(setOf(DayAvailability.NO), edited.poll.participants.single().responses.values.toSet())
    }

    @Test
    fun `setup rejects missing and malformed times and invalid dates without saving`() = runBlocking {
        val repository = FakePollRepository(draftPoll())
        val service = service(repository)
        val badCandidates = listOf(
            PollCandidate("2026-09-21"),
            PollCandidate("2026-09-21", "18:00", null),
            PollCandidate("2026-09-21", "25:00", "26:00"),
            PollCandidate("2026-09-21", "18:00:00", "19:00"),
            PollCandidate("2026-09-21", "18:00", "18:00"),
            PollCandidate("2026-02-30", "18:00", "19:00"),
        )
        for (candidate in badCandidates) {
            assertFailsWith<IllegalArgumentException> {
                service.completeSetup("poll1234", CompleteSetupCommand(title = "会議", scheduleType = ScheduleType.TIMED, candidates = listOf(candidate)), viewer)
            }
            assertEquals(draftPoll(), repository.poll)
        }
        assertFailsWith<IllegalArgumentException> {
            service.completeSetup("poll1234", CompleteSetupCommand(
                title = "会議", scheduleType = ScheduleType.TIMED,
                candidateDates = listOf("2026-09-21", "2026-09-22"),
                candidates = listOf(PollCandidate("2026-09-21", "18:00", "19:00")),
            ), viewer)
        }
        assertFailsWith<IllegalArgumentException> {
            service.completeSetup("poll1234", CompleteSetupCommand(title = "会議", candidates = listOf(PollCandidate("2026-09-21", "18:00", "19:00"))), viewer)
        }
        assertEquals(draftPoll(), repository.poll)
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
