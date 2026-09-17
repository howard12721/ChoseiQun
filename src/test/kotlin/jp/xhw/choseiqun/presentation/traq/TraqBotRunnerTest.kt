package jp.xhw.choseiqun.presentation.traq

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class TraqBotRunnerTest {
    @Test
    fun `user and group mentions accept arbitrary UUIDs`() {
        for (type in listOf("user", "group")) {
            for (id in listOf(
                "00000000-0000-0000-0000-000000000000",
                "00000000-0000-0000-0000-000000000001",
                "0197279a-ef12-7af2-9000-4407cb602145",
                "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF",
            )) {
                val mention = """!{"type":"$type","raw":"@test","id":"$id"}"""

                assertEquals(mention, extractBotMentionPrefix("$mention 日程調整"))
            }
        }
    }

    @Test
    fun `malformed UUIDs are ignored`() {
        for (id in listOf(
            "",
            "not-a-uuid",
            "00000000000000000000000000000001",
            "00000000-0000-0000-0000-00000000000g",
            "00000000-0000-0000-0000-0000000000012",
        )) {
            val mention = """!{"type":"group","raw":"@test","id":"$id"}"""

            assertNull(extractBotMentionPrefix("$mention 日程調整"))
        }
    }

    @Test
    fun `channel mentions are ignored`() {
        val mention = """!{"type":"channel","raw":"#test","id":"00000000-0000-0000-0000-000000000001"}"""

        assertNull(extractBotMentionPrefix("$mention 日程調整"))
    }

    @Test
    fun `mentions after other text are ignored`() {
        val mention = """!{"type":"user","raw":"@test","id":"00000000-0000-0000-0000-000000000001"}"""

        assertNull(extractBotMentionPrefix("日程調整 $mention"))
    }
}
