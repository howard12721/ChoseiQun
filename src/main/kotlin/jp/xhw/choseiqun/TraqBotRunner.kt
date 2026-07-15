package jp.xhw.choseiqun

import jp.xhw.trakt.bot.context.base.sendMessage
import jp.xhw.trakt.bot.context.bot.BotContext
import jp.xhw.trakt.bot.context.bot.fetchMe
import jp.xhw.trakt.bot.infrastructure.client.TraktClient
import jp.xhw.trakt.bot.infrastructure.client.runtime
import jp.xhw.trakt.bot.model.BotEvents
import jp.xhw.trakt.bot.onMessageCreated
import kotlin.uuid.Uuid

data class TraqBotConfig(
    val token: String,
    val botId: Uuid,
    val traqOrigin: String,
)

internal fun extractBotMentionPrefix(
    content: String,
    botUserId: Uuid,
): String? =
    Regex(
        """^!\{"type":"user","raw":"(?:\\.|[^"\\])*","id":"${Regex.escape(botUserId.toString())}"}""",
    ).find(content)?.value

class TraqBotRunner private constructor(
    private val client: TraktClient,
    private val pollService: PollService,
    private val identityDirectory: TraqIdentityDirectory,
    private val botUserId: Uuid,
) {
    private val runtime =
        client.runtime {
            onMessageCreated { event ->
                handleMessage(event)
            }
        }

    companion object {
        suspend fun create(
            client: TraktClient,
            pollService: PollService,
            identityDirectory: TraqIdentityDirectory,
        ): TraqBotRunner {
            var botUserId: Uuid? = null
            client.execute {
                botUserId = fetchMe().id.value
            }
            return TraqBotRunner(
                client = client,
                pollService = pollService,
                identityDirectory = identityDirectory,
                botUserId = requireNotNull(botUserId) { "Bot User IDを取得できませんでした" },
            )
        }
    }

    suspend fun run() {
        runtime.run()
    }

    suspend fun stop() {
        runtime.stop()
    }

    context(_: BotContext)
    private suspend fun handleMessage(event: BotEvents.MessageCreated) {
        val content = event.message.content.trim()
        val botMentionPrefix = extractBotMentionPrefix(content, botUserId) ?: return

        when {
            content == botMentionPrefix -> {
                event.message.channel.sendMessage("```\n@BOT_chosei <イベント名>\n```\nで日程調整を開始します")
            }

            else -> {
                val title = content.removePrefix(botMentionPrefix).trim()
                val organizer = identityDirectory.resolveByUserId(event.message.author.id.value.toString())
                if (organizer == null) {
                    event.message.channel.sendMessage("ユーザー情報を取得できませんでした。しばらくしてから再試行してください。")
                    return
                }
                val poll =
                    this@TraqBotRunner.pollService.createDraftPoll(
                        CreateDraftPollCommand(
                            title = title.ifBlank { "日程調整" },
                            organizerUserId = organizer.userId,
                            organizerTraqId = organizer.traqId,
                            traqChannelId = event.message.channel.id.value,
                        ),
                    )
                if (poll.announcementMessageId == null) {
                    event.message.channel.sendMessage("日程調整のサマリーメッセージを表示できませんでした。")
                }
            }
        }
    }
}
