package app.choseiqun

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jetbrains.exposed.v1.core.ReferenceOption
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.SortOrder
import org.jetbrains.exposed.v1.core.Table
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.SchemaUtils
import org.jetbrains.exposed.v1.jdbc.deleteWhere
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update

class PollRepository(
    config: MariaDbConfig,
) {
    private val database =
        Database.connect(
            url = config.jdbcUrl,
            driver = "org.mariadb.jdbc.Driver",
            user = config.user,
            password = config.password,
        )

    suspend fun initialize() =
        dbQuery {
            SchemaUtils.create(
                Polls,
                PollCandidateDates,
                PollParticipants,
                ParticipantComments,
                ParticipantResponses,
            )
        }

    suspend fun findById(id: String): PollRecord? =
        dbQuery {
            readPoll(id)
        }

    suspend fun save(record: PollRecord): PollRecord =
        dbQuery {
            val updatedRows =
                Polls.update({ Polls.id eq record.id }) {
                    it[setupToken] = record.setupToken
                    it[title] = record.title
                    it[description] = record.description
                    it[state] = record.state.name
                    it[createdAt] = record.createdAt
                    it[updatedAt] = record.updatedAt
                    it[organizerUserId] = record.organizerUserId
                    it[traqChannelId] = record.traqChannelId
                    it[announcementMessageId] = record.announcementMessageId
                }
            if (updatedRows == 0) {
                Polls.insert {
                    it[id] = record.id
                    it[setupToken] = record.setupToken
                    it[title] = record.title
                    it[description] = record.description
                    it[state] = record.state.name
                    it[createdAt] = record.createdAt
                    it[updatedAt] = record.updatedAt
                    it[organizerUserId] = record.organizerUserId
                    it[traqChannelId] = record.traqChannelId
                    it[announcementMessageId] = record.announcementMessageId
                }
            }

            PollCandidateDates.deleteWhere { pollId eq record.id }
            record.candidateDates.forEachIndexed { index, candidateDate ->
                PollCandidateDates.insert {
                    it[pollId] = record.id
                    it[this.candidateDate] = candidateDate
                    it[sortOrder] = index
                }
            }

            PollParticipants.deleteWhere { pollId eq record.id }
            record.participants.forEachIndexed { index, participant ->
                val participantId =
                    PollParticipants.insert {
                        it[pollId] = record.id
                        it[name] = participant.name
                        it[traqId] = participant.traqId
                        it[note] = participant.note
                        it[updatedAt] = participant.updatedAt
                        it[sortOrder] = index
                    }[PollParticipants.id]

                participant.comments.forEachIndexed { commentIndex, comment ->
                    ParticipantComments.insert {
                        it[this.participantId] = participantId
                        it[body] = comment.body
                        it[createdAt] = comment.createdAt
                        it[sortOrder] = commentIndex
                    }
                }

                participant.responses
                    .toSortedMap()
                    .forEach { (date, availability) ->
                        ParticipantResponses.insert {
                            it[this.participantId] = participantId
                            it[responseDate] = date
                            it[this.availability] = availability.name
                        }
                    }
            }

            record
        }

    suspend fun list(): List<PollRecord> =
        dbQuery {
            Polls
                .selectAll()
                .orderBy(Polls.updatedAt to SortOrder.DESC)
                .mapNotNull { row -> readPoll(row[Polls.id]) }
        }

    private suspend fun <T> dbQuery(block: () -> T): T =
        withContext(Dispatchers.IO) {
            transaction(database) {
                block()
            }
        }

    private fun readPoll(id: String): PollRecord? {
        val poll =
            Polls
                .selectAll()
                .where { Polls.id eq id }
                .singleOrNull()
                ?.let(::toPollRecordBase)
                ?: return null

        return poll.copy(
            candidateDates = readCandidateDates(id),
            participants = readParticipants(id),
        )
    }

    private fun readCandidateDates(pollId: String): List<String> =
        PollCandidateDates
            .selectAll()
            .where { PollCandidateDates.pollId eq pollId }
            .orderBy(PollCandidateDates.sortOrder to SortOrder.ASC)
            .map { it[PollCandidateDates.candidateDate] }

    private fun readParticipants(pollId: String): List<ParticipantRecord> =
        PollParticipants
            .selectAll()
            .where { PollParticipants.pollId eq pollId }
            .orderBy(PollParticipants.sortOrder to SortOrder.ASC)
            .map { row ->
                val participantId = row[PollParticipants.id]
                ParticipantRecord(
                    name = row[PollParticipants.name],
                    traqId = row[PollParticipants.traqId],
                    note = row[PollParticipants.note],
                    comments = readComments(participantId),
                    responses = readResponses(participantId),
                    updatedAt = row[PollParticipants.updatedAt],
                )
            }

    private fun readComments(participantId: Long): List<ParticipantCommentRecord> =
        ParticipantComments
            .selectAll()
            .where { ParticipantComments.participantId eq participantId }
            .orderBy(ParticipantComments.sortOrder to SortOrder.ASC)
            .map { row ->
                ParticipantCommentRecord(
                    body = row[ParticipantComments.body],
                    createdAt = row[ParticipantComments.createdAt],
                )
            }

    private fun readResponses(participantId: Long): Map<String, DayAvailability> =
        ParticipantResponses
            .selectAll()
            .where { ParticipantResponses.participantId eq participantId }
            .orderBy(ParticipantResponses.responseDate to SortOrder.ASC)
            .associate { row ->
                row[ParticipantResponses.responseDate] to DayAvailability.valueOf(row[ParticipantResponses.availability])
            }

    private fun toPollRecordBase(row: ResultRow): PollRecord =
        PollRecord(
            id = row[Polls.id],
            setupToken = row[Polls.setupToken],
            title = row[Polls.title],
            description = row[Polls.description],
            state = PollState.valueOf(row[Polls.state]),
            candidateDates = emptyList(),
            createdAt = row[Polls.createdAt],
            updatedAt = row[Polls.updatedAt],
            organizerUserId = row[Polls.organizerUserId],
            traqChannelId = row[Polls.traqChannelId],
            announcementMessageId = row[Polls.announcementMessageId],
            participants = emptyList(),
        )
}

private object Polls : Table("polls") {
    val id = varchar("id", 64)
    val setupToken = varchar("setup_token", 255)
    val title = varchar("title", 255)
    val description = text("description")
    val state = varchar("state", 32)
    val createdAt = varchar("created_at", 64)
    val updatedAt = varchar("updated_at", 64)
    val organizerUserId = varchar("organizer_user_id", 255)
    val traqChannelId = varchar("traq_channel_id", 255).nullable()
    val announcementMessageId = varchar("announcement_message_id", 255).nullable()

    override val primaryKey = PrimaryKey(id)
}

private object PollCandidateDates : Table("poll_candidate_dates") {
    val pollId = varchar("poll_id", 64).references(Polls.id, onDelete = ReferenceOption.CASCADE)
    val candidateDate = varchar("candidate_date", 10)
    val sortOrder = integer("sort_order")

    override val primaryKey = PrimaryKey(pollId, candidateDate)
}

private object PollParticipants : Table("poll_participants") {
    val id = long("id").autoIncrement()
    val pollId = varchar("poll_id", 64).references(Polls.id, onDelete = ReferenceOption.CASCADE)
    val name = varchar("name", 255)
    val traqId = varchar("traq_id", 255).nullable()
    val note = text("note")
    val updatedAt = varchar("updated_at", 64)
    val sortOrder = integer("sort_order")

    override val primaryKey = PrimaryKey(id)
}

private object ParticipantComments : Table("participant_comments") {
    val participantId = long("participant_id").references(PollParticipants.id, onDelete = ReferenceOption.CASCADE)
    val body = text("body")
    val createdAt = varchar("created_at", 64)
    val sortOrder = integer("sort_order")

    override val primaryKey = PrimaryKey(participantId, createdAt, sortOrder)
}

private object ParticipantResponses : Table("participant_responses") {
    val participantId = long("participant_id").references(PollParticipants.id, onDelete = ReferenceOption.CASCADE)
    val responseDate = varchar("response_date", 10)
    val availability = varchar("availability", 16)

    override val primaryKey = PrimaryKey(participantId, responseDate)
}
