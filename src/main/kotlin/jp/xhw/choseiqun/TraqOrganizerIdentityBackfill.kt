package jp.xhw.choseiqun

class TraqOrganizerIdentityBackfill(
    private val identityDirectory: TraqIdentityDirectory,
    private val repository: PollRepository,
) {
    suspend fun run() {
        repository.listUnresolvedOrganizerUserIds().forEach { organizerUserId ->
            identityDirectory.resolveByUserId(organizerUserId)
        }
    }
}
