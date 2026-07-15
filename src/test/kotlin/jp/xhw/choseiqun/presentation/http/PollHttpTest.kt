package jp.xhw.choseiqun.presentation.http

import io.ktor.client.request.header
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication
import jp.xhw.choseiqun.application.poll.PollService
import jp.xhw.choseiqun.application.port.IdentityDirectory
import jp.xhw.choseiqun.application.port.PollListRecord
import jp.xhw.choseiqun.application.port.PollRepository
import jp.xhw.choseiqun.domain.PollRecord
import jp.xhw.choseiqun.domain.PollState
import jp.xhw.choseiqun.domain.ViewerIdentity
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.uuid.Uuid

class PollHttpTest {
    private val viewer =
        ViewerIdentity(
            userId = "11111111-1111-4111-8111-111111111111",
            traqId = "alice",
        )

    @Test
    fun `availability route trusts resolved identity instead of request name`() =
        testApplication {
            val repository = HttpTestPollRepository(openPoll())
            application {
                configureHttp(
                    pollService = PollService(repository, now = { "2026-07-15T10:00:00Z" }),
                    identityDirectory = identityDirectory(),
                    presenter = PollHttpPresenter("https://chosei.example", "https://q.example"),
                    publicBaseUrl = "https://chosei.example",
                )
            }

            val response =
                client.post("/api/polls/poll1234/availability") {
                    header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                    header("X-Forwarded-User", viewer.traqId)
                    setBody(
                        """
                        {
                          "name": "spoofed-user",
                          "responses": { "2026-07-20": "YES" }
                        }
                        """.trimIndent(),
                    )
                }

            assertEquals(HttpStatusCode.OK, response.status)
            assertContains(response.bodyAsText(), "\"name\":\"alice\"")
            assertContains(response.bodyAsText(), "\"isViewer\":true")
            assertFalse(response.bodyAsText().contains("spoofed-user"))
            assertFalse(response.bodyAsText().contains(viewer.userId))
            assertEquals("alice", repository.poll.participants.single().name)
        }

    @Test
    fun `missing poll is mapped to not found API error`() =
        testApplication {
            val repository = HttpTestPollRepository(openPoll())
            application {
                configureHttp(
                    pollService = PollService(repository),
                    identityDirectory = identityDirectory(),
                    presenter = PollHttpPresenter("https://chosei.example", "https://q.example"),
                    publicBaseUrl = "https://chosei.example",
                )
            }

            val response = client.post("/api/polls/missing/availability") {
                header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                header("X-Forwarded-User", viewer.traqId)
                setBody("""{"responses": {}}""")
            }

            assertEquals(HttpStatusCode.NotFound, response.status)
            assertContains(response.bodyAsText(), "調整が見つかりません")
        }

    @Test
    fun `CORS only accepts the configured public origin`() =
        testApplication {
            val repository = HttpTestPollRepository(openPoll())
            application {
                configureHttp(
                    pollService = PollService(repository),
                    identityDirectory = identityDirectory(),
                    presenter = PollHttpPresenter("https://chosei.example", "https://q.example"),
                    publicBaseUrl = "https://chosei.example",
                )
            }

            val rejected =
                client.get("/api/polls/poll1234") {
                    header(HttpHeaders.Origin, "https://evil.example")
                }
            val allowed =
                client.get("/api/polls/poll1234") {
                    header(HttpHeaders.Origin, "https://chosei.example")
                }

            assertEquals(HttpStatusCode.Forbidden, rejected.status)
            assertEquals(HttpStatusCode.OK, allowed.status)
            assertEquals("https://chosei.example", allowed.headers[HttpHeaders.AccessControlAllowOrigin])
        }

    @Test
    fun `API responses include restrictive browser headers`() =
        testApplication {
            val repository = HttpTestPollRepository(openPoll())
            application {
                configureHttp(
                    pollService = PollService(repository),
                    identityDirectory = identityDirectory(),
                    presenter = PollHttpPresenter("https://chosei.example", "https://q.example"),
                    publicBaseUrl = "https://chosei.example",
                )
            }

            val response = client.get("/api/polls/poll1234")

            assertEquals(HttpStatusCode.OK, response.status)
            assertEquals("no-store", response.headers[HttpHeaders.CacheControl])
            assertEquals("nosniff", response.headers["X-Content-Type-Options"])
            assertEquals("DENY", response.headers["X-Frame-Options"])
            assertEquals("max-age=31536000", response.headers["Strict-Transport-Security"])
        }

    @Test
    fun `malformed and oversized JSON are rejected without internal details`() =
        testApplication {
            val repository = HttpTestPollRepository(openPoll())
            application {
                configureHttp(
                    pollService = PollService(repository),
                    identityDirectory = identityDirectory(),
                    presenter = PollHttpPresenter("https://chosei.example", "https://q.example"),
                    publicBaseUrl = "https://chosei.example",
                )
            }

            val malformed =
                client.post("/api/polls/poll1234/comments") {
                    header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                    header("X-Forwarded-User", viewer.traqId)
                    setBody("{")
                }
            val oversized =
                client.post("/api/polls/poll1234/comments") {
                    header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
                    header("X-Forwarded-User", viewer.traqId)
                    setBody("{\"comment\":\"${"x".repeat(65 * 1024)}\"}")
                }

            assertEquals(HttpStatusCode.BadRequest, malformed.status)
            assertContains(malformed.bodyAsText(), "リクエストの形式が正しくありません")
            assertEquals(HttpStatusCode.PayloadTooLarge, oversized.status)
            assertContains(oversized.bodyAsText(), "リクエストが大きすぎます")
        }

    @Test
    fun `unexpected failures do not leak exception messages`() =
        testApplication {
            val repository =
                HttpTestPollRepository(openPoll()).apply {
                    findFailure = IllegalStateException("database-password=secret")
                }
            application {
                configureHttp(
                    pollService = PollService(repository),
                    identityDirectory = identityDirectory(),
                    presenter = PollHttpPresenter("https://chosei.example", "https://q.example"),
                    publicBaseUrl = "https://chosei.example",
                )
            }

            val response = client.get("/api/polls/poll1234")
            val body = response.bodyAsText()

            assertEquals(HttpStatusCode.InternalServerError, response.status)
            assertContains(body, "サーバエラーが発生しました")
            assertFalse(body.contains("database-password"))
            assertFalse(body.contains("secret"))
        }

    private fun identityDirectory(): IdentityDirectory =
        object : IdentityDirectory {
            override suspend fun resolveByTraqId(forwardedTraqId: String?): ViewerIdentity? =
                viewer.takeIf { forwardedTraqId == viewer.traqId }

            override suspend fun resolveByUserId(rawUserId: String?): ViewerIdentity? =
                viewer.takeIf { rawUserId == viewer.userId }
        }

    private fun openPoll(): PollRecord =
        PollRecord(
            id = "poll1234",
            title = "会議日程",
            state = PollState.OPEN,
            candidateDates = listOf("2026-07-20"),
            createdAt = "2026-07-01T00:00:00Z",
            updatedAt = "2026-07-01T00:00:00Z",
            organizerUserId = viewer.userId,
            organizerTraqId = viewer.traqId,
        )
}

private class HttpTestPollRepository(
    var poll: PollRecord,
) : PollRepository {
    var findFailure: Throwable? = null

    override suspend fun updateAnnouncementMessageId(
        pollId: String,
        messageId: Uuid,
    ) = Unit

    override suspend fun findById(id: String): PollRecord? {
        findFailure?.let { throw it }
        return poll.takeIf { it.id == id }
    }

    override suspend fun save(record: PollRecord): PollRecord {
        poll = record
        return record
    }

    override suspend fun listOpenForViewer(viewerUserId: String): List<PollListRecord> = emptyList()
}
