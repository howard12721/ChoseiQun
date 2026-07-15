package jp.xhw.choseiqun

import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.defaultheaders.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.Json

fun Application.configureHttp(
    pollService: PollService,
    identityDirectory: TraqIdentityDirectory,
) {
    val json =
        Json {
            ignoreUnknownKeys = true
            prettyPrint = true
            encodeDefaults = true
        }

    install(DefaultHeaders)
    install(CORS) {
        anyHost()
        allowNonSimpleContentTypes = true
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowHeader(HttpHeaders.ContentType)
    }
    install(ContentNegotiation) {
        json(json)
    }
    install(StatusPages) {
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
            cause.printStackTrace()
            call.respond(HttpStatusCode.InternalServerError, ApiError(cause.message ?: "サーバエラーが発生しました"))
        }
    }

    routing {
        route("/api") {
            get("/polls") {
                call.respond(pollService.listOpenPolls(call.viewerIdentity(identityDirectory)))
            }
            get("/polls/{id}") {
                val id = call.parameters["id"] ?: throw IllegalArgumentException("poll id is required")
                call.respond(pollService.getPublicPoll(id, call.viewerIdentity(identityDirectory)))
            }
            post("/polls/{id}/availability") {
                val id = call.parameters["id"] ?: throw IllegalArgumentException("poll id is required")
                val request = call.receive<UpsertAvailabilityRequest>()
                call.respond(pollService.upsertAvailability(id, request, call.viewerIdentity(identityDirectory)))
            }
            post("/polls/{id}/comments") {
                val id = call.parameters["id"] ?: throw IllegalArgumentException("poll id is required")
                val request = call.receive<PostCommentRequest>()
                call.respond(pollService.postComment(id, request, call.viewerIdentity(identityDirectory)))
            }
            put("/polls/{id}/comments") {
                val id = call.parameters["id"] ?: throw IllegalArgumentException("poll id is required")
                val request = call.receive<UpdateCommentRequest>()
                call.respond(pollService.updateComment(id, request, call.viewerIdentity(identityDirectory)))
            }
            delete("/polls/{id}/comments") {
                val id = call.parameters["id"] ?: throw IllegalArgumentException("poll id is required")
                val request = call.receive<DeleteCommentRequest>()
                call.respond(pollService.deleteComment(id, request, call.viewerIdentity(identityDirectory)))
            }
            get("/setup/{id}") {
                val id = call.parameters["id"] ?: throw IllegalArgumentException("poll id is required")
                call.respond(pollService.getSetupPoll(id, call.viewerIdentity(identityDirectory)))
            }
            post("/setup/{id}") {
                val id = call.parameters["id"] ?: throw IllegalArgumentException("poll id is required")
                val request = call.receive<CompleteSetupRequest>()
                call.respond(pollService.completeSetup(id, request, call.viewerIdentity(identityDirectory)))
            }
        }
    }
}

private suspend fun ApplicationCall.viewerIdentity(directory: TraqIdentityDirectory): ViewerIdentity? =
    directory.resolveByTraqId(request.headers["X-Forwarded-User"])
