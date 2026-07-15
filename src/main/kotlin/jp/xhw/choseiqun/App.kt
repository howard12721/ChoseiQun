@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package jp.xhw.choseiqun

import io.ktor.http.Url
import io.ktor.server.cio.*
import io.ktor.server.engine.*
import jp.xhw.trakt.bot.trakt
import kotlinx.cinterop.toKString
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import platform.posix.getenv
import kotlin.uuid.Uuid

fun main() {
    runBlocking {
        val config = AppConfig.fromEnvironment()
        val repository = PollRepository(config.database)
        repository.initialize()
        val traqClient =
            config.botConfig?.let {
                trakt(token = it.token, botId = it.botId, origin = it.traqOrigin)
            }
        val identityDirectory = TraqIdentityDirectory(repository, traqClient)
        TraqOrganizerIdentityBackfill(identityDirectory, repository).run()
        val announcementGateway =
            traqClient?.let {
                TraqAnnouncementGateway(it)
            }
        val pollService =
            PollService(
                repository = repository,
                baseUrl = config.publicBaseUrl,
                traqBaseUrl = config.traqBaseUrl,
                announcementGateway = announcementGateway,
            )
        val botRunner =
            traqClient?.let {
                TraqBotRunner.create(it, pollService, identityDirectory)
            }
        val server =
            embeddedServer(CIO, host = "0.0.0.0", port = config.port) {
                configureHttp(pollService, identityDirectory)
            }

        val botJob =
            botRunner?.let {
                launch(Dispatchers.Default) {
                    botRunner.run()
                }
            }

        try {
            server.start(wait = true)
        } finally {
            botRunner?.stop()
            botJob?.cancelAndJoin()
            repository.close()
        }
    }
}

data class AppConfig(
    val port: Int,
    val publicBaseUrl: String,
    val database: MariaDbConfig,
    val traqBaseUrl: String,
    val traqOrigin: String,
    val botConfig: TraqBotConfig?,
) {
    companion object {
        fun fromEnvironment(): AppConfig {
            val port = environment("PORT")?.toIntOrNull() ?: 8080
            val publicBaseUrl = environment("PUBLIC_BASE_URL") ?: "http://localhost:5173"
            val database =
                MariaDbConfig(
                    url =
                        normalizeMariaDbUrl(
                            environment("MARIADB_URL") ?: "mysql://localhost:3306/choseiqun",
                        ),
                    user = environment("MARIADB_USER") ?: "root",
                    password = environment("MARIADB_PASSWORD") ?: "",
                )
            val traqBaseUrl = environment("TRAQ_BASE_URL") ?: "https://q.trap.jp"
            val traqOrigin =
                environment("TRAQ_ORIGIN")
                    ?.trim()
                    ?.takeIf { it.isNotBlank() }
                    ?: runCatching { Url(traqBaseUrl).host }.getOrNull()
                    ?: "q.trap.jp"

            val botToken = environment("TRAQ_BOT_TOKEN")
            val botIdRaw = environment("TRAQ_BOT_ID")
            val botRequired = environment("TRAQ_BOT_REQUIRED").equals("true", ignoreCase = true)
            val hasBotToken = !botToken.isNullOrBlank()
            val hasBotId = !botIdRaw.isNullOrBlank()
            require(hasBotToken == hasBotId) {
                "TRAQ_BOT_TOKEN and TRAQ_BOT_ID must be configured together"
            }
            require(!botRequired || hasBotToken) {
                "TRAQ_BOT_TOKEN and TRAQ_BOT_ID are required"
            }
            val botConfig =
                if (hasBotToken && hasBotId) {
                    TraqBotConfig(
                        token = requireNotNull(botToken),
                        botId = Uuid.parse(requireNotNull(botIdRaw)),
                        traqOrigin = traqOrigin,
                    )
                } else {
                    null
                }

            return AppConfig(
                port = port,
                publicBaseUrl = publicBaseUrl,
                database = database,
                traqBaseUrl = traqBaseUrl,
                traqOrigin = traqOrigin,
                botConfig = botConfig,
            )
        }
    }
}

data class MariaDbConfig(
    val url: String,
    val user: String,
    val password: String,
)

private fun environment(name: String): String? = getenv(name)?.toKString()

private fun normalizeMariaDbUrl(url: String): String =
    when {
        url.startsWith("jdbc:mariadb://") -> "mysql://${url.removePrefix("jdbc:mariadb://")}"
        url.startsWith("jdbc:mysql://") -> url.removePrefix("jdbc:")
        url.startsWith("mariadb://") -> "mysql://${url.removePrefix("mariadb://")}"
        else -> url
    }
