package jp.xhw.choseiqun

import io.github.smyrgeorge.sqlx4k.mysql.mySQL
import io.ktor.server.cio.CIO
import io.ktor.server.engine.embeddedServer
import jp.xhw.choseiqun.application.poll.PollService
import jp.xhw.choseiqun.application.port.IdentityDirectory
import jp.xhw.choseiqun.domain.*
import jp.xhw.choseiqun.infrastructure.persistence.DatabaseMigrator
import jp.xhw.choseiqun.infrastructure.persistence.SqlxPollRepository
import jp.xhw.choseiqun.presentation.http.PollHttpPresenter
import jp.xhw.choseiqun.presentation.http.configureHttp
import kotlinx.coroutines.runBlocking

/** Local UI verification against the real HTTP API and a disposable database. No traQ bot. */
fun previewMain(): Unit = runBlocking {
    val db = mySQL(url = "mysql://127.0.0.1:33279/choseiqun_preview", username = "choseiqun_test", password = "choseiqun_test")
    DatabaseMigrator(db).migrate()
    val repository = SqlxPollRepository(db)
    val dates = listOf("2026-09-21", "2026-09-22", "2026-09-23")
    val candidates = dates.flatMap { listOf(PollCandidate(it, "18:00", "19:00"), PollCandidate(it, "19:30", "20:30")) }
    val viewer = ViewerIdentity("preview-hiro", "Hiro")
    val now = "2026-09-15T05:35:00Z"
    val participants = listOf("Hiro", "Aki", "Beni").mapIndexed { index, name ->
        ParticipantRecord(name = name, traqId = name, userId = "preview-${name.lowercase()}",
            comments = when(index) {
                0 -> listOf(ParticipantCommentRecord("ありがとうございます。候補を見ながら調整しましょう。", now))
                1 -> listOf(ParticipantCommentRecord("21日はどちらの時間も参加できます！", "2026-09-15T05:20:00Z"))
                else -> emptyList()
            },
            responses = candidates.mapIndexed { i, candidate -> candidate.candidateKey to
                listOf(DayAvailability.YES, DayAvailability.MAYBE, DayAvailability.YES, DayAvailability.NO, DayAvailability.YES, DayAvailability.YES)[(i + index) % 6]
            }.toMap(), updatedAt = now)
    }
    val meeting = PollRecord(id = "meeting", title = "開発チーム定例会", description = "定例会をしますよ〜〜〜〜", state = PollState.OPEN,
        scheduleType = ScheduleType.TIMED, candidates = candidates, createdAt = now, updatedAt = now,
        organizerUserId = viewer.userId, organizerTraqId = viewer.traqId, participants = participants)
    repository.save(meeting)
    repository.save(meeting.copy(id = "unanswered", participants = participants.drop(1)))
    repository.save(meeting.copy(id = "date-only", scheduleType = ScheduleType.DATE_ONLY, candidates = dates.map { PollCandidate(it) }, participants = participants.map { it.copy(responses = dates.associateWith { DayAvailability.NO }) }))
    repository.save(meeting.copy(id = "draft", state = PollState.DRAFT, description = "", candidates = emptyList(), participants = emptyList(), scheduleType = ScheduleType.DATE_ONLY))
    repository.save(meeting.copy(id = "missing", description = "", candidates = candidates.filter { it.date != "2026-09-22" }, participants = emptyList()))
    repository.save(meeting.copy(id = "autumn", title = "秋の制作会", scheduleType = ScheduleType.DATE_ONLY, candidates = listOf(PollCandidate("2026-09-26"), PollCandidate("2026-09-27")), participants = emptyList()))
    val identities = object : IdentityDirectory {
        override suspend fun resolveByTraqId(forwardedTraqId: String?): ViewerIdentity? = viewer.takeIf { forwardedTraqId == viewer.traqId }
        override suspend fun resolveByUserId(rawUserId: String?): ViewerIdentity? = viewer.takeIf { rawUserId == viewer.userId }
    }
    try {
        embeddedServer(CIO, port = 18080, host = "127.0.0.1") {
            configureHttp(PollService(repository), identities, PollHttpPresenter("http://localhost:5173", "https://q.trap.jp"), "http://localhost:5173")
        }.start(wait = true)
    } finally { db.close().getOrThrow() }
}
