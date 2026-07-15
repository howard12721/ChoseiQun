package jp.xhw.choseiqun

import jp.xhw.trakt.bot.context.base.fetchUserOrNull
import jp.xhw.trakt.bot.context.base.fetchUsers
import jp.xhw.trakt.bot.infrastructure.client.TraktClient
import jp.xhw.trakt.bot.model.UserId
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlin.uuid.Uuid

class TraqIdentityDirectory internal constructor(
    private val storedIdentityByTraqId: suspend (String) -> ViewerIdentity?,
    private val storedIdentityByUserId: suspend (String) -> ViewerIdentity?,
    private val remoteIdentityByTraqId: suspend (String) -> ViewerIdentity?,
    private val remoteIdentityByUserId: suspend (String) -> ViewerIdentity?,
    private val persistIdentity: suspend (ViewerIdentity, Set<String>) -> Unit,
) {
    constructor(
        repository: PollRepository,
        traqClient: TraktClient?,
    ) : this(
        storedIdentityByTraqId = repository::findKnownIdentityByTraqId,
        storedIdentityByUserId = repository::findKnownIdentityByUserId,
        remoteIdentityByTraqId = { traqId -> fetchIdentityByTraqId(traqClient, traqId) },
        remoteIdentityByUserId = { userId -> fetchIdentityByUserId(traqClient, userId) },
        persistIdentity = repository::rememberUserIdentity,
    )

    private val cache = TraqIdentityCache()

    suspend fun resolveByTraqId(forwardedTraqId: String?): ViewerIdentity? {
        val traqId = forwardedTraqId?.trim()?.takeIf(String::isNotEmpty) ?: return null
        return cache.resolveByTraqId(traqId) {
            val stored =
                storedIdentityByTraqId(traqId)
                    ?.normalizedOrNull()
                    ?.takeIf { it.traqId.equals(traqId, ignoreCase = true) }
            val identity =
                stored
                    ?: remoteIdentityOrNull("traQ user $traqId") {
                        remoteIdentityByTraqId(traqId)
                    }?.normalizedOrNull()
                        ?.takeIf { it.traqId.equals(traqId, ignoreCase = true) }
                    ?: return@resolveByTraqId null

            cache.commit(identity, setOf(traqId), persistIdentity)
        }
    }

    suspend fun resolveByUserId(rawUserId: String?): ViewerIdentity? {
        val userId = rawUserId.toCanonicalUuidOrNull() ?: return null
        return cache.resolveByUserId(userId) {
            val stored =
                storedIdentityByUserId(userId)
                    ?.normalizedOrNull()
                    ?.takeIf { it.userId == userId }
            val identity =
                stored
                    ?: remoteIdentityOrNull("traQ user $userId") {
                        remoteIdentityByUserId(userId)
                    }?.normalizedOrNull()
                        ?.takeIf { it.userId == userId }
                    ?: return@resolveByUserId null

            cache.commit(identity, setOf(identity.traqId), persistIdentity)
        }
    }

    private suspend fun remoteIdentityOrNull(
        description: String,
        load: suspend () -> ViewerIdentity?,
    ): ViewerIdentity? =
        try {
            load()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            println("Failed to resolve $description: ${error.message}")
            null
        }
}

private class TraqIdentityCache {
    private val stateMutex = Mutex()
    private val commitMutex = Mutex()
    private val identitiesByTraqId = mutableMapOf<String, ViewerIdentity>()
    private val identitiesByUserId = mutableMapOf<String, ViewerIdentity>()
    private val inFlightResolutions = mutableMapOf<String, CompletableDeferred<ViewerIdentity?>>()

    suspend fun resolveByTraqId(
        traqId: String,
        load: suspend () -> ViewerIdentity?,
    ): ViewerIdentity? {
        val normalizedTraqId = traqId.normalizedTraqIdOrNull() ?: return null
        return resolve(
            key = "traq:$normalizedTraqId",
            cached = { identitiesByTraqId[normalizedTraqId] },
            load = load,
        )
    }

    suspend fun resolveByUserId(
        userId: String,
        load: suspend () -> ViewerIdentity?,
    ): ViewerIdentity? {
        val normalizedUserId = userId.toCanonicalUuidOrNull() ?: return null
        return resolve(
            key = "user:$normalizedUserId",
            cached = { identitiesByUserId[normalizedUserId] },
            load = load,
        )
    }

    suspend fun commit(
        identity: ViewerIdentity,
        aliases: Set<String> = emptySet(),
        persist: suspend (ViewerIdentity, Set<String>) -> Unit,
    ): ViewerIdentity =
        commitMutex.withLock {
            val normalized = identity.normalizedOrThrow()
            val traqIds = normalizedTraqIds(normalized, aliases)
            stateMutex.withLock {
                checkCompatible(normalized, traqIds)
            }
            persist(normalized, aliases)
            remember(normalized, aliases)
        }

    private suspend fun remember(
        identity: ViewerIdentity,
        aliases: Set<String> = emptySet(),
    ): ViewerIdentity {
        val normalized = identity.normalizedOrThrow()
        val traqIds = normalizedTraqIds(normalized, aliases)

        stateMutex.withLock {
            checkCompatible(normalized, traqIds)
            identitiesByUserId[normalized.userId] = normalized
            traqIds.forEach { traqId -> identitiesByTraqId[traqId] = normalized }
        }
        return normalized
    }

    private fun checkCompatible(
        identity: ViewerIdentity,
        traqIds: Set<String>,
    ) {
        identitiesByUserId[identity.userId]?.let { existing ->
            check(existing.traqId.equals(identity.traqId, ignoreCase = true)) {
                "Conflicting traQ IDs for user ${identity.userId}: ${existing.traqId} and ${identity.traqId}"
            }
        }
        traqIds.forEach { traqId ->
            identitiesByTraqId[traqId]?.let { existing ->
                check(existing.userId == identity.userId) {
                    "Conflicting user UUIDs for traQ ID $traqId: ${existing.userId} and ${identity.userId}"
                }
            }
        }
    }

    private fun normalizedTraqIds(
        identity: ViewerIdentity,
        aliases: Set<String>,
    ): Set<String> =
        (aliases + identity.traqId)
            .mapNotNull(String::normalizedTraqIdOrNull)
            .toSet()

    private suspend fun resolve(
        key: String,
        cached: () -> ViewerIdentity?,
        load: suspend () -> ViewerIdentity?,
    ): ViewerIdentity? {
        val resolution =
            stateMutex.withLock {
                cached()?.let { return@withLock Resolution(cached = it) }
                inFlightResolutions[key]?.let { return@withLock Resolution(deferred = it) }

                val deferred = CompletableDeferred<ViewerIdentity?>()
                inFlightResolutions[key] = deferred
                Resolution(deferred = deferred, isLeader = true)
            }
        resolution.cached?.let { return it }
        val deferred = requireNotNull(resolution.deferred)
        if (!resolution.isLeader) {
            return deferred.await()
        }

        try {
            val resolved = load()
            deferred.complete(resolved)
            return resolved
        } catch (error: Throwable) {
            deferred.completeExceptionally(error)
            throw error
        } finally {
            withContext(NonCancellable) {
                stateMutex.withLock {
                    if (inFlightResolutions[key] === deferred) {
                        inFlightResolutions.remove(key)
                    }
                }
            }
        }
    }

    private data class Resolution(
        val cached: ViewerIdentity? = null,
        val deferred: CompletableDeferred<ViewerIdentity?>? = null,
        val isLeader: Boolean = false,
    )
}

private suspend fun fetchIdentityByTraqId(
    client: TraktClient?,
    traqId: String,
): ViewerIdentity? {
    client ?: return null
    var identity: ViewerIdentity? = null
    client.execute {
        val user = fetchUsers(name = traqId).firstOrNull { it.name.equals(traqId, ignoreCase = true) }
            ?: return@execute
        identity = ViewerIdentity(userId = user.id.value.toString(), traqId = user.name)
    }
    return identity
}

private suspend fun fetchIdentityByUserId(
    client: TraktClient?,
    userId: String,
): ViewerIdentity? {
    client ?: return null
    var identity: ViewerIdentity? = null
    client.execute {
        val user = fetchUserOrNull(UserId(Uuid.parse(userId))) ?: return@execute
        identity = ViewerIdentity(userId = user.id.value.toString(), traqId = user.name)
    }
    return identity
}

private fun ViewerIdentity.normalizedOrNull(): ViewerIdentity? {
    val userId = userId.toCanonicalUuidOrNull() ?: return null
    val traqId = traqId.trim().takeIf(String::isNotEmpty) ?: return null
    return ViewerIdentity(userId = userId, traqId = traqId)
}

private fun ViewerIdentity.normalizedOrThrow(): ViewerIdentity =
    requireNotNull(normalizedOrNull()) {
        "Invalid traQ identity: $userId/$traqId"
    }

private fun String.normalizedTraqIdOrNull(): String? =
    trim()
        .takeIf(String::isNotEmpty)
        ?.lowercase()

private fun String?.toCanonicalUuidOrNull(): String? =
    this
        ?.trim()
        ?.takeIf(String::isNotEmpty)
        ?.let { value -> runCatching { Uuid.parse(value).toString() }.getOrNull() }
