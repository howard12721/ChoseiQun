package jp.xhw.choseiqun.application.poll

import jp.xhw.choseiqun.application.port.PollListRecord
import jp.xhw.choseiqun.domain.ViewerIdentity

interface PollUseCases : PollCreationUseCase {
    suspend fun listOpenPolls(viewerIdentity: ViewerIdentity? = null): List<PollListRecord>

    suspend fun getSetupPoll(
        id: String,
        viewerIdentity: ViewerIdentity? = null,
    ): PollDetails

    suspend fun completeSetup(
        id: String,
        command: CompleteSetupCommand,
        viewerIdentity: ViewerIdentity? = null,
    ): PollDetails

    suspend fun getPublicPoll(
        id: String,
        viewerIdentity: ViewerIdentity? = null,
    ): PollDetails

    suspend fun upsertAvailability(
        id: String,
        command: UpsertAvailabilityCommand,
        viewerIdentity: ViewerIdentity? = null,
    ): PollDetails

    suspend fun postComment(
        id: String,
        command: PostCommentCommand,
        viewerIdentity: ViewerIdentity? = null,
    ): PollDetails

    suspend fun updateComment(
        id: String,
        command: UpdateCommentCommand,
        viewerIdentity: ViewerIdentity? = null,
    ): PollDetails

    suspend fun deleteComment(
        id: String,
        command: DeleteCommentCommand,
        viewerIdentity: ViewerIdentity? = null,
    ): PollDetails
}
