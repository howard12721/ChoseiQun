package app.choseiqun

import io.ktor.server.engine.*
import io.ktor.server.netty.*
import kotlinx.coroutines.runBlocking
import java.net.URI
import kotlin.uuid.Uuid

fun main() {
    val config = AppConfig.fromEnvironment()
    val repository = PollRepository(config.database)
    runBlocking {
        repository.initialize()
    }
    val announcementGateway =
        config.botConfig?.let {
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
        config.botConfig?.let {
            TraqBotRunner(it, pollService, config.publicBaseUrl)
        }
    val server =
        embeddedServer(Netty, host = "0.0.0.0", port = config.port) {
            configureHttp(pollService)
        }

    Runtime.getRuntime().addShutdownHook(
        Thread {
            runBlocking {
                botRunner?.stop()
            }
        },
    )

    if (botRunner != null) {
        Thread.ofVirtual().name("traq-bot").start {
            runBlocking {
                botRunner.run()
            }
        }
    }

    server.start(wait = true)
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
            val port = System.getenv("PORT")?.toIntOrNull() ?: 8080
            val publicBaseUrl = System.getenv("PUBLIC_BASE_URL") ?: "http://localhost:5173"
            val database =
                MariaDbConfig(
                    jdbcUrl = System.getenv("MARIADB_URL") ?: "jdbc:mariadb://localhost:3306/choseiqun",
                    user = System.getenv("MARIADB_USER") ?: "root",
                    password = System.getenv("MARIADB_PASSWORD") ?: "",
                )
            val traqBaseUrl = System.getenv("TRAQ_BASE_URL") ?: "https://q.trap.jp"
            val traqOrigin =
                System
                    .getenv("TRAQ_ORIGIN")
                    ?.trim()
                    ?.takeIf { it.isNotBlank() }
                    ?: runCatching { URI(traqBaseUrl).host }.getOrNull()
                    ?: "q.trap.jp"

            val botToken = System.getenv("TRAQ_BOT_TOKEN")
            val botIdRaw = System.getenv("TRAQ_BOT_ID")
            val botConfig =
                if (!botToken.isNullOrBlank() && !botIdRaw.isNullOrBlank()) {
                    TraqBotConfig(
                        token = botToken,
                        botId = Uuid.parse(botIdRaw),
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
    val jdbcUrl: String,
    val user: String,
    val password: String,
)
