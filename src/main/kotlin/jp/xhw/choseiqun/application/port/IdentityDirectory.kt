package jp.xhw.choseiqun.application.port

import jp.xhw.choseiqun.domain.ViewerIdentity

interface IdentityDirectory {
    suspend fun resolveByTraqId(forwardedTraqId: String?): ViewerIdentity?

    suspend fun resolveByUserId(rawUserId: String?): ViewerIdentity?
}
