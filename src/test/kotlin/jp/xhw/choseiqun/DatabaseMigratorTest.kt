package jp.xhw.choseiqun

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class DatabaseMigratorTest {
    @Test
    fun `migration versions are contiguous and checksums are stable in shape`() {
        validateMigrationDefinitions(DATABASE_MIGRATIONS)

        assertEquals(listOf(1, 2, 3), DATABASE_MIGRATIONS.map(DatabaseMigration::version))
        assertEquals(
            mapOf(
                1 to "f0afa2831fb0ff24",
                2 to "66a9c47b963ce600",
                3 to "ad4dc5177b9bd2ed",
            ),
            DATABASE_MIGRATIONS.associate { migration -> migration.version to migration.checksum },
        )
    }

    @Test
    fun `migration definitions reject version gaps`() {
        assertFailsWith<IllegalArgumentException> {
            validateMigrationDefinitions(
                listOf(
                    DatabaseMigration(1, "first", listOf("SELECT 1")),
                    DatabaseMigration(3, "third", listOf("SELECT 3")),
                ),
            )
        }
    }

    @Test
    fun `migration definitions reject duplicate names`() {
        assertFailsWith<IllegalArgumentException> {
            validateMigrationDefinitions(
                listOf(
                    DatabaseMigration(1, "same", listOf("SELECT 1")),
                    DatabaseMigration(2, "same", listOf("SELECT 2")),
                ),
            )
        }
    }
}
