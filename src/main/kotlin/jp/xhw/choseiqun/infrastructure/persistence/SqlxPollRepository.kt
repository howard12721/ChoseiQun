package jp.xhw.choseiqun.infrastructure.persistence

import io.github.smyrgeorge.sqlx4k.QueryExecutor
import io.github.smyrgeorge.sqlx4k.ResultSet
import io.github.smyrgeorge.sqlx4k.Statement
import io.github.smyrgeorge.sqlx4k.impl.extensions.asLong
import io.github.smyrgeorge.sqlx4k.mysql.IMySQL
import jp.xhw.choseiqun.application.port.PollListRecord
import jp.xhw.choseiqun.application.port.PollRepository
import jp.xhw.choseiqun.domain.DayAvailability
import jp.xhw.choseiqun.domain.ParticipantCommentRecord
import jp.xhw.choseiqun.domain.ParticipantRecord
import jp.xhw.choseiqun.domain.PollRecord
import jp.xhw.choseiqun.domain.PollState
import kotlin.uuid.Uuid

class SqlxPollRepository(
    private val database: IMySQL,
) : PollRepository {

    override suspend fun updateAnnouncementMessageId(
        pollId: String,
        messageId: Uuid,
    ) {
        database.transaction {
            execute(
                Statement
                    .create(
                        """
                        UPDATE polls
                        SET announcement_message_id = :messageId
                        WHERE id = :pollId
                        """.trimIndent(),
                    ).bind("messageId", messageId.toByteArray())
                    .bind("pollId", pollId),
            ).getOrThrow()
        }
    }

    override suspend fun findById(id: String): PollRecord? =
        database.transaction {
            readPoll(id)
        }

    override suspend fun save(record: PollRecord): PollRecord =
        database.transaction {
            execute(
                Statement
                    .create(
                        """
                        INSERT INTO polls (
                            id,
                            title,
                            description,
                            state,
                            created_at,
                            updated_at,
                            organizer_user_id,
                            organizer_traq_id,
                            traq_channel_id,
                            announcement_message_id
                        ) VALUES (
                            :id,
                            :title,
                            :description,
                            :state,
                            :createdAt,
                            :updatedAt,
                            :organizerUserId,
                            :organizerTraqId,
                            :traqChannelId,
                            :announcementMessageId
                        )
                        ON DUPLICATE KEY UPDATE
                            title = VALUES(title),
                            description = VALUES(description),
                            state = VALUES(state),
                            created_at = VALUES(created_at),
                            updated_at = VALUES(updated_at),
                            organizer_user_id = VALUES(organizer_user_id),
                            organizer_traq_id = COALESCE(VALUES(organizer_traq_id), organizer_traq_id),
                            traq_channel_id = VALUES(traq_channel_id)
                        """.trimIndent(),
                    ).bindPoll(record),
            ).getOrThrow()

            record.organizerTraqId?.let { organizerTraqId ->
                execute(
                    Statement
                        .create(
                            """
                            UPDATE polls
                            SET organizer_traq_id = :organizerTraqId
                            WHERE organizer_user_id = :organizerUserId
                              AND organizer_traq_id IS NULL
                            """.trimIndent(),
                        ).bind("organizerTraqId", organizerTraqId)
                        .bind("organizerUserId", record.organizerUserId),
                ).getOrThrow()
            }

            execute(
                Statement
                    .create("DELETE FROM poll_candidate_dates WHERE poll_id = :pollId")
                    .bind("pollId", record.id),
            ).getOrThrow()
            record.candidateDates.forEachIndexed { index, candidateDate ->
                execute(
                    Statement
                        .create(
                            """
                            INSERT INTO poll_candidate_dates (poll_id, candidate_date, sort_order)
                            VALUES (:pollId, :candidateDate, :sortOrder)
                            """.trimIndent(),
                        ).bind("pollId", record.id)
                        .bind("candidateDate", candidateDate)
                        .bind("sortOrder", index),
                ).getOrThrow()
            }

            execute(
                Statement
                    .create("DELETE FROM poll_participants WHERE poll_id = :pollId")
                    .bind("pollId", record.id),
            ).getOrThrow()
            record.participants.forEachIndexed { index, participant ->
                execute(
                    Statement
                        .create(
                            """
                            INSERT INTO poll_participants (
                                poll_id,
                                name,
                                traq_id,
                                traq_user_id,
                                note,
                                updated_at,
                                sort_order
                            ) VALUES (
                                :pollId,
                                :name,
                                :traqId,
                                :traqUserId,
                                :note,
                                :updatedAt,
                                :sortOrder
                            )
                            """.trimIndent(),
                        ).bind("pollId", record.id)
                        .bind("name", participant.name)
                        .bind("traqId", participant.traqId)
                        .bind("traqUserId", participant.userId)
                        .bind("note", participant.note)
                        .bind("updatedAt", participant.updatedAt)
                        .bind("sortOrder", index),
                ).getOrThrow()

                val participantId =
                    fetchAll("SELECT LAST_INSERT_ID() AS participant_id")
                        .getOrThrow()
                        .rows
                        .single()
                        .get("participant_id")
                        .asLong()

                participant.comments.forEachIndexed { commentIndex, comment ->
                    execute(
                        Statement
                            .create(
                                """
                                INSERT INTO participant_comments (
                                    participant_id,
                                    body,
                                    created_at,
                                    sort_order
                                ) VALUES (
                                    :participantId,
                                    :body,
                                    :createdAt,
                                    :sortOrder
                                )
                                """.trimIndent(),
                            ).bind("participantId", participantId)
                            .bind("body", comment.body)
                            .bind("createdAt", comment.createdAt)
                            .bind("sortOrder", commentIndex),
                    ).getOrThrow()
                }

                participant.responses
                    .toList()
                    .sortedBy { (date, _) -> date }
                    .forEach { (date, availability) ->
                        execute(
                            Statement
                                .create(
                                    """
                                    INSERT INTO participant_responses (
                                        participant_id,
                                        response_date,
                                        availability
                                    ) VALUES (
                                        :participantId,
                                        :responseDate,
                                        :availability
                                    )
                                    """.trimIndent(),
                                ).bind("participantId", participantId)
                                .bind("responseDate", date)
                                .bind("availability", availability.name),
                        ).getOrThrow()
                    }
            }

            record
        }

    override suspend fun listOpenForViewer(viewerUserId: String): List<PollListRecord> =
        database.transaction {
            val rows =
                fetchAll(
                    Statement
                        .create(
                            """
                            SELECT p.id,
                                   p.title,
                                   p.state,
                                   p.updated_at,
                                   (
                                       SELECT COUNT(*)
                                       FROM poll_participants AS counted_participants
                                       WHERE counted_participants.poll_id = p.id
                                   ) AS participant_count,
                                   CASE
                                       WHEN p.organizer_user_id = :viewerUserId
                                       THEN 1
                                       ELSE 0
                                   END AS created_by_viewer,
                                   viewer_participants.participant_id AS viewer_participant_id,
                                   candidate_dates.candidate_date,
                                   viewer_responses.availability AS viewer_availability
                            FROM (
                                SELECT id AS poll_id
                                FROM polls
                                WHERE state = 'OPEN'
                                  AND organizer_user_id = :viewerUserId
                                UNION
                                SELECT answered_polls.poll_id
                                FROM poll_participants AS answered_polls
                                INNER JOIN polls AS answered_poll_records
                                    ON answered_poll_records.id = answered_polls.poll_id
                                   AND answered_poll_records.state = 'OPEN'
                                WHERE answered_polls.traq_user_id = :viewerUserId
                            ) AS visible_polls
                            INNER JOIN polls AS p
                                ON p.id = visible_polls.poll_id
                            LEFT JOIN (
                                SELECT poll_id, MIN(id) AS participant_id
                                FROM poll_participants
                                WHERE traq_user_id = :viewerUserId
                                GROUP BY poll_id
                            ) AS viewer_participants
                                ON viewer_participants.poll_id = p.id
                            LEFT JOIN poll_candidate_dates AS candidate_dates
                                ON candidate_dates.poll_id = p.id
                            LEFT JOIN participant_responses AS viewer_responses
                                ON viewer_responses.participant_id = viewer_participants.participant_id
                               AND viewer_responses.response_date = candidate_dates.candidate_date
                            ORDER BY p.updated_at DESC, candidate_dates.sort_order ASC
                            """.trimIndent(),
                        ).bind("viewerUserId", viewerUserId),
                ).getOrThrow()
                    .rows

            rows.groupBy { row -> row.get("id").asString() }
                .values
                .map { pollRows ->
                    val first = pollRows.first()
                    val viewerResponses =
                        pollRows.mapNotNull { row ->
                            val date = row.get("candidate_date").asStringOrNull() ?: return@mapNotNull null
                            val availability = row.get("viewer_availability").asStringOrNull() ?: return@mapNotNull null
                            date to DayAvailability.valueOf(availability)
                        }.toMap()
                    PollListRecord(
                        id = first.get("id").asString(),
                        title = first.get("title").asString(),
                        state = PollState.valueOf(first.get("state").asString()),
                        candidateDates = pollRows.mapNotNull { row -> row.get("candidate_date").asStringOrNull() },
                        participantCount = first.get("participant_count").asLong().toInt(),
                        respondedByViewer = first.get("viewer_participant_id").asStringOrNull() != null,
                        createdByViewer = first.get("created_by_viewer").asLong() == 1L,
                        viewerResponses = viewerResponses,
                        updatedAt = first.get("updated_at").asString(),
                    )
                }
        }

    private suspend fun QueryExecutor.readPoll(id: String): PollRecord? {
        val poll =
            fetchAll(
                Statement
                    .create(
                        """
                        SELECT id,
                               title,
                               description,
                               state,
                               created_at,
                               updated_at,
                               organizer_user_id,
                               organizer_traq_id,
                               HEX(traq_channel_id) AS traq_channel_id_hex,
                               HEX(announcement_message_id) AS announcement_message_id_hex
                        FROM polls
                        WHERE id = :id
                        """.trimIndent(),
                    ).bind("id", id),
            ).getOrThrow()
                .rows
                .singleOrNull()
                ?.toPollRecordBase()
                ?: return null

        return poll.copy(
            candidateDates = readCandidateDates(id),
            participants = readParticipants(id),
        )
    }

    private suspend fun QueryExecutor.readCandidateDates(pollId: String): List<String> =
        fetchAll(
            Statement
                .create(
                    """
                    SELECT candidate_date
                    FROM poll_candidate_dates
                    WHERE poll_id = :pollId
                    ORDER BY sort_order ASC
                    """.trimIndent(),
                ).bind("pollId", pollId),
        ).getOrThrow()
            .rows
            .map { row -> row.get("candidate_date").asString() }

    private suspend fun QueryExecutor.readParticipants(pollId: String): List<ParticipantRecord> {
        val participantRows =
            fetchAll(
                Statement
                    .create(
                        """
                        SELECT id, name, traq_id, traq_user_id, note, updated_at
                        FROM poll_participants
                        WHERE poll_id = :pollId
                        ORDER BY sort_order ASC
                        """.trimIndent(),
                    ).bind("pollId", pollId),
            ).getOrThrow()
                .rows
        if (participantRows.isEmpty()) {
            return emptyList()
        }

        val commentsByParticipantId =
            fetchAll(
                Statement
                    .create(
                        """
                        SELECT comments.participant_id,
                               comments.body,
                               comments.created_at
                        FROM participant_comments AS comments
                        INNER JOIN poll_participants AS participants
                            ON participants.id = comments.participant_id
                        WHERE participants.poll_id = :pollId
                        ORDER BY comments.participant_id ASC, comments.sort_order ASC
                        """.trimIndent(),
                    ).bind("pollId", pollId),
            ).getOrThrow()
                .rows
                .groupBy { row -> row.get("participant_id").asLong() }

        val responsesByParticipantId =
            fetchAll(
                Statement
                    .create(
                        """
                        SELECT responses.participant_id,
                               responses.response_date,
                               responses.availability
                        FROM participant_responses AS responses
                        INNER JOIN poll_participants AS participants
                            ON participants.id = responses.participant_id
                        WHERE participants.poll_id = :pollId
                        ORDER BY responses.participant_id ASC, responses.response_date ASC
                        """.trimIndent(),
                    ).bind("pollId", pollId),
            ).getOrThrow()
                .rows
                .groupBy { row -> row.get("participant_id").asLong() }

        return participantRows.map { row ->
            val participantId = row.get("id").asLong()
            ParticipantRecord(
                name = row.get("name").asString(),
                traqId = row.get("traq_id").asStringOrNull(),
                userId = row.get("traq_user_id").asStringOrNull(),
                note = row.get("note").asString(),
                comments =
                    commentsByParticipantId[participantId].orEmpty().map { commentRow ->
                        ParticipantCommentRecord(
                            body = commentRow.get("body").asString(),
                            createdAt = commentRow.get("created_at").asString(),
                        )
                    },
                responses =
                    responsesByParticipantId[participantId].orEmpty().associate { responseRow ->
                        responseRow.get("response_date").asString() to
                            DayAvailability.valueOf(responseRow.get("availability").asString())
                    },
                updatedAt = row.get("updated_at").asString(),
            )
        }
    }
}

private fun Statement.bindPoll(record: PollRecord): Statement =
    bind("id", record.id)
        .bind("title", record.title)
        .bind("description", record.description)
        .bind("state", record.state.name)
        .bind("createdAt", record.createdAt)
        .bind("updatedAt", record.updatedAt)
        .bind("organizerUserId", record.organizerUserId)
        .bind("organizerTraqId", record.organizerTraqId)
        .bind("traqChannelId", record.traqChannelId?.toByteArray())
        .bind("announcementMessageId", record.announcementMessageId?.toByteArray())

private fun ResultSet.Row.toPollRecordBase(): PollRecord =
    PollRecord(
        id = get("id").asString(),
        title = get("title").asString(),
        description = get("description").asString(),
        state = PollState.valueOf(get("state").asString()),
        candidateDates = emptyList(),
        createdAt = get("created_at").asString(),
        updatedAt = get("updated_at").asString(),
        organizerUserId = get("organizer_user_id").asString(),
        organizerTraqId = get("organizer_traq_id").asStringOrNull(),
        traqChannelId = get("traq_channel_id_hex").asUuidFromHexOrNull(),
        announcementMessageId = get("announcement_message_id_hex").asUuidFromHexOrNull(),
        participants = emptyList(),
    )

private fun ResultSet.Row.Column.asUuidFromHexOrNull(): Uuid? =
    asStringOrNull()
        ?.takeIf { it.isNotEmpty() }
        ?.let(Uuid::parseHex)
