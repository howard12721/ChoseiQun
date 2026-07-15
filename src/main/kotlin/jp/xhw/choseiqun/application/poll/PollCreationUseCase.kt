package jp.xhw.choseiqun.application.poll

import jp.xhw.choseiqun.domain.PollRecord

interface PollCreationUseCase {
    suspend fun createDraftPoll(command: CreateDraftPollCommand): PollRecord
}
