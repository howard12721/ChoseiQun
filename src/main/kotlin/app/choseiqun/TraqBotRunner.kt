package app.choseiqun

import jp.xhw.trakt.bot.TraktClient
import jp.xhw.trakt.bot.model.MessageCreated
import jp.xhw.trakt.bot.scope.BotScope
import jp.xhw.trakt.bot.scope.sendDirectMessage
import jp.xhw.trakt.bot.scope.sendMessage
import kotlinx.coroutines.delay
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.uuid.Uuid

data class TraqBotConfig(
    val token: String,
    val botId: Uuid,
    val traqOrigin: String,
)

private val BOT_MENTION_PATTERN =
    Regex("""^!\{"type":"(?:\\.|[^"\\])*","raw":"(?:\\.|[^"\\])*","id":"(?:\\.|[^"\\])*"\}""")

internal fun extractBotMentionPrefix(content: String): String? = BOT_MENTION_PATTERN.find(content)?.value

class TraqBotRunner(
    private val client: TraktClient,
    private val pollService: PollService,
    private val baseUrl: String,
) {
    private val stopRequested = AtomicBoolean(false)

    init {
        client.on<MessageCreated> { event ->
            handleMessage(event)
        }
    }

    suspend fun run() {
        stopRequested.set(false)

        while (!stopRequested.get()) {
            try {
                client.start()
                if (!stopRequested.get()) {
                    println("traQ bot session ended unexpectedly. Reconnecting in 3 seconds...")
                }
            } catch (error: Throwable) {
                if (!stopRequested.get()) {
                    println("traQ bot crashed: ${error.message}. Reconnecting in 3 seconds...")
                    error.printStackTrace()
                }
            } finally {
                runCatching { client.stop() }
                    .onFailure {
                        if (!stopRequested.get()) {
                            println("Failed to stop traQ bot client cleanly: ${it.message}")
                        }
                    }
            }

            if (!stopRequested.get()) {
                delay(3_000)
            }
        }
    }

    suspend fun stop() {
        stopRequested.set(true)
        client.stop()
    }

    context(botScope: BotScope)
    private suspend fun handleMessage(event: MessageCreated) {
        val content = event.message.content.trim()
        val botMentionPrefix = extractBotMentionPrefix(content) ?: return

        when {
            content == botMentionPrefix -> {
                event.message.channel.sendMessage("```\n$@調整する <イベント名>\n```で日程調整を開始します。")
            }

            else -> {
                val title = content.removePrefix(botMentionPrefix).trim()
                val poll =
                    pollService.createDraftPoll(
                        CreateDraftPollCommand(
                            title = title.ifBlank { "日程調整" },
                            organizerUserId = event.message.authorId.toString(),
                            traqChannelId = event.message.channelId.value,
                        ),
                    )
                val setupUrl = "${baseUrl.trimEnd('/')}/setup/${poll.id}?token=${poll.setupToken}"
                event.message.author.sendDirectMessage(
                    buildString {
                        appendLine("日程調整の設定URLです。")
                        appendLine(setupUrl)
                        appendLine()
                        append("設定完了後、元のチャンネルにリンクを公開します。")
                    },
                )
                event.message.channel.sendMessage(
                    "設定URLをDMしました。",
                )
            }
        }
    }
}
