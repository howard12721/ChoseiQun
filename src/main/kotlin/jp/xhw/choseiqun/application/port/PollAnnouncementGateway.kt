package jp.xhw.choseiqun.application.port

import jp.xhw.choseiqun.domain.PollRecord
import kotlin.uuid.Uuid

fun interface PollAnnouncementGateway {
    suspend fun publishOrUpdate(poll: PollRecord): Uuid?
}
