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
        if (!content.startsWith("chosei")) {
            return
        }

        when {
            content == "chosei" || content == "chosei help" -> {
                event.message.channel.sendMessage(helpMessage())
            }

            content.startsWith("chosei start ") -> {
                val title = content.removePrefix("chosei start ").trim()
                val poll =
                    pollService.createDraftPoll(
                        CreateDraftPollCommand(
                            title = title.ifBlank { "日程調整" },
                            organizerUserId = event.message.authorId.toString(),
                            traqChannelId = event.message.channelId.toString(),
                        ),
                    )
                val setupUrl = "${baseUrl.trimEnd('/')}/setup/${poll.id}?token=${poll.setupToken}"
                event.message.author.sendDirectMessage(
                    buildString {
                        appendLine("日程調整の設定URLです。")
                        appendLine(setupUrl)
                        appendLine()
                        append("設定完了後、自動で元のチャンネルに結果メッセージを投稿し、その後の回答状況に合わせて更新します。")
                    },
                )
                event.message.channel.sendMessage(
                    "設定URLをDMしました。公開されるとこのチャンネルに結果メッセージを自動投稿し、その後の回答状況に合わせて更新します。",
                )
            }

            content == "chosei list" -> {
                val polls = pollService.listOpenPolls().take(5)
                val response =
                    if (polls.isEmpty()) {
                        "公開中の日程調整はありません。"
                    } else {
                        buildString {
                            appendLine("公開中の日程調整:")
                            polls.forEachIndexed { index, poll ->
                                appendLine("${index + 1}. ${poll.title} ${poll.participantUrl}")
                            }
                        }
                    }
                event.message.channel.sendMessage(response.trim())
            }

            else -> {
                event.message.channel.sendMessage("`chosei help` で使い方を確認できます。")
            }
        }
    }

    private fun helpMessage(): String =
        """
        使い方:
        `chosei start タイトル`
        `chosei list`

        フロー:
        1. 主催者が `chosei start ...` を送る
        2. bot が設定URLをDMで返す
        3. 設定完了後、結果メッセージを元チャンネルに自動投稿する
        4. 回答が更新されるたびに同じ結果メッセージを更新する
        """.trimIndent()
}
