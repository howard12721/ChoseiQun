package jp.xhw.choseiqun.infrastructure.persistence

import io.github.smyrgeorge.sqlx4k.QueryExecutor
import io.github.smyrgeorge.sqlx4k.Statement
import io.github.smyrgeorge.sqlx4k.impl.extensions.asLong
import io.github.smyrgeorge.sqlx4k.mysql.IMySQL

internal data class DatabaseMigration(
    val version: Int,
    val name: String,
    val statements: List<String>,
) {
    val checksum: String
        get() = migrationChecksum(this)
}

private data class AppliedMigration(
    val version: Int,
    val name: String,
    val checksum: String,
)

internal class DatabaseMigrator(
    private val database: IMySQL,
) {
    suspend fun migrate() {
        validateMigrationDefinitions(DATABASE_MIGRATIONS)
        database.transaction {
            acquireMigrationLock()
            try {
                execute(CREATE_MIGRATION_HISTORY_TABLE).getOrThrow()
                val appliedMigrations = readAppliedMigrations()
                validateAppliedMigrations(appliedMigrations)
                DATABASE_MIGRATIONS
                    .filterNot { it.version in appliedMigrations }
                    .forEach { migration ->
                        migration.statements.forEach { statement ->
                            execute(statement).getOrThrow()
                        }
                        recordAppliedMigration(migration)
                    }
            } finally {
                releaseMigrationLock()
            }
        }
    }

    private suspend fun QueryExecutor.acquireMigrationLock() {
        val acquired =
            fetchAll("SELECT GET_LOCK('$MIGRATION_LOCK_NAME', 30) AS acquired")
                .getOrThrow()
                .rows
                .single()
                .get("acquired")
                .asLong()
        check(acquired == 1L) { "Database migration lock could not be acquired" }
    }

    private suspend fun QueryExecutor.releaseMigrationLock() {
        fetchAll("SELECT RELEASE_LOCK('$MIGRATION_LOCK_NAME') AS released").getOrThrow()
    }

    private suspend fun QueryExecutor.readAppliedMigrations(): Map<Int, AppliedMigration> =
        fetchAll(
            """
            SELECT version, name, checksum
            FROM schema_migrations
            ORDER BY version ASC
            """.trimIndent(),
        ).getOrThrow()
            .rows
            .associate { row ->
                val migration =
                    AppliedMigration(
                        version = row.get("version").asLong().toInt(),
                        name = row.get("name").asString(),
                        checksum = row.get("checksum").asString(),
                    )
                migration.version to migration
            }

    private fun validateAppliedMigrations(appliedMigrations: Map<Int, AppliedMigration>) {
        val definitionsByVersion = DATABASE_MIGRATIONS.associateBy(DatabaseMigration::version)
        appliedMigrations.values.forEach { applied ->
            val definition =
                definitionsByVersion[applied.version]
                    ?: error("Database schema version ${applied.version} is not supported by this application")
            check(applied.name == definition.name) {
                "Database migration ${applied.version} name does not match: ${applied.name}"
            }
            check(applied.checksum == definition.checksum) {
                "Database migration ${applied.version} checksum does not match"
            }
        }
        val appliedVersions = appliedMigrations.keys.sorted()
        val expectedVersions = DATABASE_MIGRATIONS.take(appliedVersions.size).map(DatabaseMigration::version)
        check(appliedVersions == expectedVersions) {
            "Applied database migrations must be a contiguous prefix: $appliedVersions"
        }
    }

    private suspend fun QueryExecutor.recordAppliedMigration(migration: DatabaseMigration) {
        execute(
            Statement
                .create(
                    """
                    INSERT INTO schema_migrations (version, name, checksum)
                    VALUES (:version, :name, :checksum)
                    """.trimIndent(),
                ).bind("version", migration.version)
                .bind("name", migration.name)
                .bind("checksum", migration.checksum),
        ).getOrThrow()
    }
}

internal fun validateMigrationDefinitions(migrations: List<DatabaseMigration>) {
    require(migrations.isNotEmpty()) { "At least one database migration is required" }
    require(migrations.first().version == 1) { "Database migrations must start at version 1" }
    require(migrations.map(DatabaseMigration::name).distinct().size == migrations.size) {
        "Database migration names must be unique"
    }
    require(migrations.all { migration -> migration.statements.isNotEmpty() && migration.statements.all(String::isNotBlank) }) {
        "Database migrations must contain non-blank statements"
    }
    migrations.zipWithNext().forEach { (current, next) ->
        require(next.version == current.version + 1) {
            "Database migration versions must be contiguous: ${current.version} -> ${next.version}"
        }
    }
}

private fun migrationChecksum(migration: DatabaseMigration): String {
    val content =
        buildString {
            append(migration.version)
            append('\u0000')
            append(migration.name)
            migration.statements.forEach { statement ->
                append('\u0000')
                append(statement)
            }
        }
    var hash = FNV64_OFFSET_BASIS
    content.encodeToByteArray().forEach { byte ->
        hash = hash xor (byte.toLong() and 0xff)
        hash *= FNV64_PRIME
    }
    return hash.toULong().toString(16).padStart(16, '0')
}

private const val MIGRATION_LOCK_NAME = "choseiqun_schema_migrations"
private const val FNV64_OFFSET_BASIS = -3750763034362895579L
private const val FNV64_PRIME = 1099511628211L

private val CREATE_MIGRATION_HISTORY_TABLE =
    """
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version INT NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum CHAR(16) NOT NULL,
        applied_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    )
    """.trimIndent()

internal val DATABASE_MIGRATIONS =
    listOf(
        DatabaseMigration(
            version = 1,
            name = "create_initial_poll_schema",
            statements =
                listOf(
                    """
                    CREATE TABLE IF NOT EXISTS polls (
                        id VARCHAR(64) NOT NULL PRIMARY KEY,
                        setup_token VARCHAR(255) NOT NULL,
                        title VARCHAR(255) NOT NULL,
                        description TEXT NOT NULL,
                        state VARCHAR(32) NOT NULL,
                        created_at VARCHAR(64) NOT NULL,
                        updated_at VARCHAR(64) NOT NULL,
                        organizer_user_id VARCHAR(255) NOT NULL,
                        traq_channel_id BINARY(16) NULL,
                        announcement_message_id BINARY(16) NULL
                    )
                    """.trimIndent(),
                    """
                    CREATE TABLE IF NOT EXISTS poll_candidate_dates (
                        poll_id VARCHAR(64) NOT NULL,
                        candidate_date VARCHAR(10) NOT NULL,
                        sort_order INT NOT NULL,
                        PRIMARY KEY (poll_id, candidate_date),
                        CONSTRAINT fk_poll_candidate_dates_poll
                            FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
                    )
                    """.trimIndent(),
                    """
                    CREATE TABLE IF NOT EXISTS poll_participants (
                        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                        poll_id VARCHAR(64) NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        traq_id VARCHAR(255) NULL,
                        note TEXT NOT NULL,
                        updated_at VARCHAR(64) NOT NULL,
                        sort_order INT NOT NULL,
                        CONSTRAINT fk_poll_participants_poll
                            FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
                    )
                    """.trimIndent(),
                    """
                    CREATE TABLE IF NOT EXISTS participant_comments (
                        participant_id BIGINT NOT NULL,
                        body TEXT NOT NULL,
                        created_at VARCHAR(64) NOT NULL,
                        sort_order INT NOT NULL,
                        PRIMARY KEY (participant_id, created_at, sort_order),
                        CONSTRAINT fk_participant_comments_participant
                            FOREIGN KEY (participant_id) REFERENCES poll_participants(id) ON DELETE CASCADE
                    )
                    """.trimIndent(),
                    """
                    CREATE TABLE IF NOT EXISTS participant_responses (
                        participant_id BIGINT NOT NULL,
                        response_date VARCHAR(10) NOT NULL,
                        availability VARCHAR(16) NOT NULL,
                        PRIMARY KEY (participant_id, response_date),
                        CONSTRAINT fk_participant_responses_participant
                            FOREIGN KEY (participant_id) REFERENCES poll_participants(id) ON DELETE CASCADE
                    )
                    """.trimIndent(),
                ),
        ),
        DatabaseMigration(
            version = 2,
            name = "add_traq_user_identity",
            statements =
                listOf(
                    """
                    ALTER TABLE polls
                    ADD COLUMN IF NOT EXISTS organizer_traq_id VARCHAR(255) NULL AFTER organizer_user_id
                    """.trimIndent(),
                    """
                    ALTER TABLE poll_participants
                    ADD COLUMN IF NOT EXISTS traq_user_id VARCHAR(36) NULL AFTER traq_id
                    """.trimIndent(),
                    """
                    CREATE INDEX IF NOT EXISTS idx_polls_state_organizer_traq_id_updated_at
                    ON polls (state, organizer_traq_id, updated_at)
                    """.trimIndent(),
                    """
                    CREATE INDEX IF NOT EXISTS idx_polls_state_organizer_user_id_updated_at
                    ON polls (state, organizer_user_id, updated_at)
                    """.trimIndent(),
                    """
                    CREATE INDEX IF NOT EXISTS idx_poll_participants_traq_id_poll_id
                    ON poll_participants (traq_id, poll_id)
                    """.trimIndent(),
                    """
                    CREATE INDEX IF NOT EXISTS idx_poll_participants_traq_user_id_poll_id
                    ON poll_participants (traq_user_id, poll_id)
                    """.trimIndent(),
                ),
        ),
        DatabaseMigration(
            version = 3,
            name = "remove_setup_token",
            statements =
                listOf(
                    """
                    ALTER TABLE polls
                    DROP COLUMN IF EXISTS setup_token
                    """.trimIndent(),
                ),
        ),
    )
