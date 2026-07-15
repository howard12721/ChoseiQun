package jp.xhw.choseiqun.presentation.http

import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.plugins.ContentTransformationException
import io.ktor.server.plugins.PayloadTooLargeException
import io.ktor.server.plugins.bodylimit.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.defaultheaders.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import jp.xhw.choseiqun.application.ForbiddenException
import jp.xhw.choseiqun.application.poll.PollUseCases
import jp.xhw.choseiqun.application.port.IdentityDirectory
import jp.xhw.choseiqun.domain.ViewerIdentity
import kotlinx.serialization.json.Json

fun Application.configureHttp(
    pollService: PollUseCases,
    identityDirectory: IdentityDirectory,
    presenter: PollHttpPresenter,
    publicBaseUrl: String,
) {
    val publicOrigin = Url(publicBaseUrl)
    require(publicOrigin.host.isNotBlank()) { "PUBLIC_BASE_URL must be an absolute URL" }
    require(publicOrigin.protocol in setOf(URLProtocol.HTTP, URLProtocol.HTTPS)) {
        "PUBLIC_BASE_URL must use http or https"
    }
    val json =
        Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
        }

    install(DefaultHeaders) {
        header(HttpHeaders.CacheControl, "no-store")
        header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
        header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        header("Referrer-Policy", "no-referrer")
        header("X-Content-Type-Options", "nosniff")
        header("X-Frame-Options", "DENY")
        if (publicOrigin.protocol == URLProtocol.HTTPS) {
            header("Strict-Transport-Security", "max-age=31536000")
        }
    }
    install(CORS) {
        allowHost(
            host = publicOrigin.hostWithPortIfSpecified,
            schemes = listOf(publicOrigin.protocol.name),
        )
        allowNonSimpleContentTypes = true
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowHeader(HttpHeaders.ContentType)
    }
    install(ContentNegotiation) {
        json(json)
    }
    install(StatusPages) {
        exception<PayloadTooLargeException> { call, _ ->
            call.respond(HttpStatusCode.PayloadTooLarge, ApiError("リクエストが大きすぎます"))
        }
        exception<ContentTransformationException> { call, _ ->
            call.respond(HttpStatusCode.BadRequest, ApiError("リクエストの形式が正しくありません"))
        }
        exception<BadRequestException> { call, _ ->
            call.respond(HttpStatusCode.BadRequest, ApiError("リクエストの形式が正しくありません"))
        }
        exception<IllegalArgumentException> { call, cause ->
            call.respond(HttpStatusCode.BadRequest, ApiError(cause.message ?: "不正なリクエストです"))
        }
        exception<NoSuchElementException> { call, cause ->
            call.respond(HttpStatusCode.NotFound, ApiError(cause.message ?: "見つかりません"))
        }
        exception<ForbiddenException> { call, cause ->
            call.respond(HttpStatusCode.Forbidden, ApiError(cause.message ?: "アクセスできません"))
        }
        exception<Throwable> { call, cause ->
            println(
                "Unhandled ${cause::class.simpleName ?: "server error"} " +
                    "for ${call.request.httpMethod.value} ${call.request.path()}",
            )
            call.respond(HttpStatusCode.InternalServerError, ApiError("サーバエラーが発生しました"))
        }
    }

    routing {
        route("/api") {
            install(RequestBodyLimit) {
                bodyLimit { MAX_API_REQUEST_BYTES }
            }
            get("/polls") {
                call.respond(
                    pollService
                        .listOpenPolls(call.viewerIdentity(identityDirectory))
                        .map(presenter::listItem),
                )
            }
            get("/polls/{id}") {
                val id = call.pollId()
                call.respond(presenter.detail(pollService.getPublicPoll(id, call.viewerIdentity(identityDirectory))))
            }
            post("/polls/{id}/availability") {
                val id = call.pollId()
                val request = call.receive<UpsertAvailabilityRequest>()
                call.respond(
                    presenter.detail(
                        pollService.upsertAvailability(id, request.toCommand(), call.viewerIdentity(identityDirectory)),
                    ),
                )
            }
            post("/polls/{id}/comments") {
                val id = call.pollId()
                val request = call.receive<PostCommentRequest>()
                call.respond(
                    presenter.detail(
                        pollService.postComment(id, request.toCommand(), call.viewerIdentity(identityDirectory)),
                    ),
                )
            }
            put("/polls/{id}/comments") {
                val id = call.pollId()
                val request = call.receive<UpdateCommentRequest>()
                call.respond(
                    presenter.detail(
                        pollService.updateComment(id, request.toCommand(), call.viewerIdentity(identityDirectory)),
                    ),
                )
            }
            delete("/polls/{id}/comments") {
                val id = call.pollId()
                val request = call.receive<DeleteCommentRequest>()
                call.respond(
                    presenter.detail(
                        pollService.deleteComment(id, request.toCommand(), call.viewerIdentity(identityDirectory)),
                    ),
                )
            }
            get("/setup/{id}") {
                val id = call.pollId()
                call.respond(
                    presenter.detail(
                        pollService.getSetupPoll(id, call.viewerIdentity(identityDirectory)),
                        includeSetupUrl = true,
                    ),
                )
            }
            post("/setup/{id}") {
                val id = call.pollId()
                val request = call.receive<CompleteSetupRequest>()
                call.respond(
                    presenter.detail(
                        pollService.completeSetup(id, request.toCommand(), call.viewerIdentity(identityDirectory)),
                        includeSetupUrl = true,
                    ),
                )
            }
        }
    }
}

private fun ApplicationCall.pollId(): String {
    val id = parameters["id"]?.trim().orEmpty()
    require(id.matches(POLL_ID_PATTERN)) { "poll id is invalid" }
    return id
}

private suspend fun ApplicationCall.viewerIdentity(directory: IdentityDirectory): ViewerIdentity? {
    val forwardedTraqId =
        request.headers[FORWARDED_USER_HEADER]
            ?.trim()
            ?.takeIf { it.matches(TRAQ_ID_PATTERN) }
            ?: return null
    return directory.resolveByTraqId(forwardedTraqId)
}

private const val FORWARDED_USER_HEADER = "X-Forwarded-User"
private const val MAX_API_REQUEST_BYTES = 64L * 1024L
private val POLL_ID_PATTERN = Regex("^[A-Za-z0-9_-]{1,64}$")
private val TRAQ_ID_PATTERN = Regex("^[A-Za-z0-9_-]{1,64}$")
