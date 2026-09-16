@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package jp.xhw.choseiqun.infrastructure.persistence

import io.github.smyrgeorge.sqlx4k.mysql.mySQL
import jp.xhw.choseiqun.application.poll.CompleteSetupCommand
import jp.xhw.choseiqun.application.poll.PollService
import jp.xhw.choseiqun.application.poll.UpsertAvailabilityCommand
import jp.xhw.choseiqun.domain.DayAvailability
import jp.xhw.choseiqun.domain.PollCandidate
import jp.xhw.choseiqun.domain.ScheduleType
import jp.xhw.choseiqun.domain.ViewerIdentity
import kotlinx.cinterop.toKString
import kotlinx.coroutines.runBlocking
import platform.posix.getenv
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TimedMigrationIntegrationTest {
    // Run against an empty, disposable database; see scripts/test-migration.sh.
    @Test
    fun `v3 data and orphan responses survive migration and timed candidates round trip`() = runBlocking {
        val url = getenv("CHOSEIQUN_TEST_DATABASE_URL")?.toKString() ?: return@runBlocking
        val db = mySQL(url = url, username = "choseiqun_test", password = "choseiqun_test")
        try {
            DatabaseMigrator(db, DATABASE_MIGRATIONS.take(3)).migrate()
            db.execute("INSERT INTO polls (id,title,description,state,created_at,updated_at,organizer_user_id,organizer_traq_id) VALUES ('legacy','旧イベント','説明','OPEN','2026-09-01T00:00:00Z','2026-09-01T00:00:00Z','owner','alice')").getOrThrow()
            db.execute("INSERT INTO poll_candidate_dates VALUES ('legacy','2026-09-21',0),('legacy','2026-09-22',1)").getOrThrow()
            db.execute("INSERT INTO poll_participants (id,poll_id,name,traq_id,traq_user_id,note,updated_at,sort_order) VALUES (1,'legacy','alice','alice','owner','旧コメント','2026-09-01T00:00:00Z',0)").getOrThrow()
            db.execute("INSERT INTO participant_comments VALUES (1,'コメント','2026-09-02T00:00:00Z',0)").getOrThrow()
            db.execute("INSERT INTO participant_responses VALUES (1,'2026-09-21','YES'),(1,'2026-09-22','MAYBE'),(1,'2026-08-31','NO')").getOrThrow()
            DATABASE_MIGRATIONS.last().statements.take(4).forEach { db.execute(it).getOrThrow() }
            DatabaseMigrator(db).migrate()
            DatabaseMigrator(db).migrate()
            val repo = SqlxPollRepository(db)
            val legacy = requireNotNull(repo.findById("legacy"))
            assertEquals(ScheduleType.DATE_ONLY, legacy.scheduleType)
            assertEquals(listOf(PollCandidate("2026-09-21"), PollCandidate("2026-09-22")), legacy.candidates)
            assertEquals(mapOf("2026-09-21" to DayAvailability.YES, "2026-09-22" to DayAvailability.MAYBE, "2026-08-31" to DayAvailability.NO), legacy.participants.single().responses)
            assertEquals("旧コメント", legacy.participants.single().note)
            assertEquals("コメント", legacy.participants.single().comments.single().body)
            assertEquals(legacy, repo.save(legacy))
            assertEquals(legacy, repo.findById("legacy"))
            val viewer = ViewerIdentity("owner", "alice")
            val service = PollService(repo)
            val first = PollCandidate("2026-09-21", "18:00", "19:00")
            val second = PollCandidate("2026-09-21", "19:30", "20:30")
            service.completeSetup("legacy", CompleteSetupCommand(title = "時間帯あり", scheduleType = ScheduleType.TIMED, candidates = listOf(first, second, first)), viewer)
            service.upsertAvailability("legacy", UpsertAvailabilityCommand(mapOf(first.candidateKey to DayAvailability.YES)), viewer)
            val timed = requireNotNull(repo.findById("legacy"))
            assertEquals(listOf(first, second), timed.candidates)
            assertEquals(mapOf(first.candidateKey to DayAvailability.YES, second.candidateKey to DayAvailability.NO), timed.participants.single().responses)
            val listed = repo.listOpenForViewer(viewer.userId).single()
            assertEquals(ScheduleType.TIMED, listed.scheduleType)
            assertEquals(timed.candidates, listed.candidates)
            assertEquals(timed.participants.single().responses, listed.viewerResponses)
            assertTrue(listed.createdByViewer && listed.respondedByViewer)
        } finally {
            db.close().getOrThrow()
        }
    }
}
