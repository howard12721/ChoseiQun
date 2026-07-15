package jp.xhw.choseiqun.infrastructure.persistence

import io.github.smyrgeorge.sqlx4k.ResultSet
import io.github.smyrgeorge.sqlx4k.Statement
import io.github.smyrgeorge.sqlx4k.mysql.IMySQL
import jp.xhw.choseiqun.application.port.IdentityRepository
import jp.xhw.choseiqun.domain.ViewerIdentity

class SqlxIdentityRepository(
    private val database: IMySQL,
) : IdentityRepository {
    override suspend fun listUnresolvedOrganizerUserIds(): List<String> =
        database.transaction {
            fetchAll(
                """
                SELECT DISTINCT organizer_user_id
                FROM polls
                WHERE organizer_traq_id IS NULL
                """.trimIndent(),
            ).getOrThrow()
                .rows
                .map { row -> row.get("organizer_user_id").asString() }
        }

    override suspend fun findKnownIdentityByTraqId(traqId: String): ViewerIdentity? =
        database.transaction {
            fetchAll(
                Statement
                    .create(
                        """
                        SELECT organizer_user_id AS user_id,
                               organizer_traq_id AS traq_id
                        FROM polls
                        WHERE organizer_traq_id = :traqId
                        UNION ALL
                        SELECT traq_user_id AS user_id,
                               COALESCE(traq_id, name) AS traq_id
                        FROM poll_participants
                        WHERE traq_user_id IS NOT NULL
                          AND (traq_id = :traqId OR (traq_id IS NULL AND name = :traqId))
                        LIMIT 1
                        """.trimIndent(),
                    ).bind("traqId", traqId),
            ).getOrThrow()
                .rows
                .firstOrNull()
                ?.toViewerIdentity()
        }

    override suspend fun findKnownIdentityByUserId(userId: String): ViewerIdentity? =
        database.transaction {
            fetchAll(
                Statement
                    .create(
                        """
                        SELECT organizer_user_id AS user_id,
                               organizer_traq_id AS traq_id
                        FROM polls
                        WHERE organizer_user_id = :userId
                          AND organizer_traq_id IS NOT NULL
                        UNION ALL
                        SELECT traq_user_id AS user_id,
                               COALESCE(traq_id, name) AS traq_id
                        FROM poll_participants
                        WHERE traq_user_id = :userId
                        LIMIT 1
                        """.trimIndent(),
                    ).bind("userId", userId),
            ).getOrThrow()
                .rows
                .firstOrNull()
                ?.toViewerIdentity()
        }

    override suspend fun rememberUserIdentity(
        identity: ViewerIdentity,
        aliases: Set<String>,
    ) {
        val knownTraqIds =
            (aliases + identity.traqId)
                .map(String::trim)
                .filter(String::isNotEmpty)
                .distinctBy(String::lowercase)

        database.transaction {
            execute(
                Statement
                    .create(
                        """
                        UPDATE polls
                        SET organizer_traq_id = :traqId
                        WHERE organizer_user_id = :userId
                          AND organizer_traq_id IS NULL
                        """.trimIndent(),
                    ).bind("traqId", identity.traqId)
                    .bind("userId", identity.userId),
            ).getOrThrow()

            knownTraqIds.forEach { knownTraqId ->
                execute(
                    Statement
                        .create(
                            """
                            UPDATE poll_participants
                            SET traq_user_id = COALESCE(traq_user_id, :userId),
                                traq_id = COALESCE(traq_id, :traqId)
                            WHERE (traq_user_id IS NULL OR traq_user_id = :userId)
                              AND (traq_id = :knownTraqId OR (traq_id IS NULL AND name = :knownTraqId))
                            """.trimIndent(),
                        ).bind("userId", identity.userId)
                        .bind("traqId", identity.traqId)
                        .bind("knownTraqId", knownTraqId),
                ).getOrThrow()
            }
        }
    }
}

private fun ResultSet.Row.toViewerIdentity(): ViewerIdentity =
    ViewerIdentity(
        userId = get("user_id").asString(),
        traqId = get("traq_id").asString(),
    )
