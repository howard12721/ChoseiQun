@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package jp.xhw.choseiqun.config

import io.ktor.http.Url
import kotlinx.cinterop.toKString
import platform.posix.getenv
import kotlin.uuid.Uuid

data class MariaDbConfig(
    val url: String,
    val user: String,
    val password: String,
)

data class TraqBotConfig(
    val token: String,
    val botId: Uuid,
    val traqOrigin: String,
)

data class AppConfig(
    val port: Int,
    val publicBaseUrl: String,
    val database: MariaDbConfig,
    val traqBaseUrl: String,
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
                botConfig = botConfig,
            )
        }
    }
}

private fun environment(name: String): String? = getenv(name)?.toKString()

private fun normalizeMariaDbUrl(url: String): String =
    when {
        url.startsWith("jdbc:mariadb://") -> "mysql://${url.removePrefix("jdbc:mariadb://")}"
        url.startsWith("jdbc:mysql://") -> url.removePrefix("jdbc:")
        url.startsWith("mariadb://") -> "mysql://${url.removePrefix("mariadb://")}"
        else -> url
    }
