package jp.xhw.choseiqun.application.port

import jp.xhw.choseiqun.domain.ViewerIdentity

interface IdentityRepository {
    suspend fun listUnresolvedOrganizerUserIds(): List<String>

    suspend fun findKnownIdentityByTraqId(traqId: String): ViewerIdentity?

    suspend fun findKnownIdentityByUserId(userId: String): ViewerIdentity?

    suspend fun rememberUserIdentity(
        identity: ViewerIdentity,
        aliases: Set<String>,
    )
}
