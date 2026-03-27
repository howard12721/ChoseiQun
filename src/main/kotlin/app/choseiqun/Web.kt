package app.choseiqun

import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.plugins.calllogging.*
import io.ktor.server.plugins.compression.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.defaultheaders.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.Json

fun Application.configureHttp(pollService: PollService) {
    val json =
        Json {
            ignoreUnknownKeys = true
            prettyPrint = true
            encodeDefaults = true
        }

    install(DefaultHeaders)
    install(Compression)
    install(CallLogging)
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
        exception<Throwable> { call, cause ->
            cause.printStackTrace()
            call.respond(HttpStatusCode.InternalServerError, ApiError(cause.message ?: "サーバエラーが発生しました"))
        }
    }

    routing {
        route("/api") {
            get("/polls") {
                call.respond(pollService.listOpenPolls())
            }
            get("/polls/{id}") {
                val id = call.parameters["id"] ?: throw IllegalArgumentException("poll id is required")
                call.respond(pollService.getPublicPoll(id, call.forwardedTraqId()))
            }
            post("/polls/{id}/availability") {
                val id = call.parameters["id"] ?: throw IllegalArgumentException("poll id is required")
                val request = call.receive<UpsertAvailabilityRequest>()
                call.respond(pollService.upsertAvailability(id, request, call.forwardedTraqId()))
            }
            post("/polls/{id}/comments") {
                val id = call.parameters["id"] ?: throw IllegalArgumentException("poll id is required")
                val request = call.receive<PostCommentRequest>()
                call.respond(pollService.postComment(id, request, call.forwardedTraqId()))
            }
            put("/polls/{id}/comments") {
                val id = call.parameters["id"] ?: throw IllegalArgumentException("poll id is required")
                val request = call.receive<UpdateCommentRequest>()
                call.respond(pollService.updateComment(id, request, call.forwardedTraqId()))
            }
            delete("/polls/{id}/comments") {
                val id = call.parameters["id"] ?: throw IllegalArgumentException("poll id is required")
                val request = call.receive<DeleteCommentRequest>()
                call.respond(pollService.deleteComment(id, request, call.forwardedTraqId()))
            }
            get("/setup/{id}") {
                val id = call.parameters["id"] ?: throw IllegalArgumentException("poll id is required")
                val token = call.request.queryParameters["token"] ?: throw IllegalArgumentException("token is required")
                call.respond(pollService.getSetupPoll(id, token, call.forwardedTraqId()))
            }
            post("/setup/{id}") {
                val id = call.parameters["id"] ?: throw IllegalArgumentException("poll id is required")
                val token = call.request.queryParameters["token"] ?: throw IllegalArgumentException("token is required")
                val request = call.receive<CompleteSetupRequest>()
                call.respond(pollService.completeSetup(id, token, request))
            }
        }
    }
}

private fun ApplicationCall.forwardedTraqId(): String? =
    request.headers["X-Forwarded-User"]?.trim()?.takeIf {
        it.isNotBlank()
    }
