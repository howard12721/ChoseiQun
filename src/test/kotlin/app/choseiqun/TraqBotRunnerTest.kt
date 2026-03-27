package app.choseiqun

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class TraqBotRunnerTest {
    @Test
    fun `extracts mention prefix even when type raw and id differ`() {
        val content = """!{"type":"group","raw":"@BOT_other","id":"different-id-123"} 定例MTG"""

        val prefix = extractBotMentionPrefix(content)

        assertEquals("""!{"type":"group","raw":"@BOT_other","id":"different-id-123"}""", prefix)
    }

    @Test
    fun `supports escaped characters inside mention payload`() {
        val content = """!{"type":"user","raw":"@BOT_\"quoted\"","id":"id-with-\\-escape"} 調整会"""

        val prefix = extractBotMentionPrefix(content)

        assertEquals("""!{"type":"user","raw":"@BOT_\"quoted\"","id":"id-with-\\-escape"}""", prefix)
    }

    @Test
    fun `returns null when message does not start with bot mention payload`() {
        assertNull(extractBotMentionPrefix("chosei start 定例MTG"))
    }
}
