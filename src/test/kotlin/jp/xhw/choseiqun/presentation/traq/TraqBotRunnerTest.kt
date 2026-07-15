package jp.xhw.choseiqun.presentation.traq

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.uuid.Uuid

class TraqBotRunnerTest {
    private val botUserId = Uuid.parse("00000000-0000-0000-0000-000000000001")

    @Test
    fun `mention prefix follows configured bot id`() {
        val mention = "!{\"type\":\"user\",\"raw\":\"@BOT_chosei\",\"id\":\"$botUserId\"}"

        assertEquals(mention, extractBotMentionPrefix("$mention 日程調整", botUserId))
    }

    @Test
    fun `mention for another bot is ignored`() {
        val otherBotUserId = Uuid.parse("00000000-0000-0000-0000-000000000002")
        val mention = "!{\"type\":\"user\",\"raw\":\"@BOT_other\",\"id\":\"$otherBotUserId\"}"

        assertNull(extractBotMentionPrefix("$mention 日程調整", botUserId))
    }
}
