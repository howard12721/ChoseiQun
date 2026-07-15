package jp.xhw.choseiqun.application.identity

import jp.xhw.choseiqun.application.port.IdentityRepository
import jp.xhw.choseiqun.application.port.IdentityDirectory

class OrganizerIdentityBackfill(
    private val identityDirectory: IdentityDirectory,
    private val repository: IdentityRepository,
) {
    suspend fun run() {
        repository.listUnresolvedOrganizerUserIds().forEach { organizerUserId ->
            identityDirectory.resolveByUserId(organizerUserId)
        }
    }
}
