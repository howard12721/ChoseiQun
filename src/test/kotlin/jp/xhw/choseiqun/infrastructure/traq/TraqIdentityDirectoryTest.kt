package jp.xhw.choseiqun.infrastructure.traq

import jp.xhw.choseiqun.domain.ViewerIdentity
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class TraqIdentityDirectoryTest {
    private val alice =
        ViewerIdentity(
            userId = "11111111-1111-4111-8111-111111111111",
            traqId = "alice",
        )

    @Test
    fun `resolved identity is cached by traQ ID and UUID`() =
        runBlocking {
            var storedLookups = 0
            var remoteLookups = 0
            var persists = 0
            val directory =
                directory(
                    storedByTraqId = {
                        storedLookups += 1
                        null
                    },
                    remoteByTraqId = {
                        remoteLookups += 1
                        alice
                    },
                    storedByUserId = { error("UUID lookup should hit the shared cache") },
                    remoteByUserId = { error("UUID lookup should hit the shared cache") },
                    persist = { _, _ -> persists += 1 },
                )

            assertEquals(alice, directory.resolveByTraqId("  ALICE  "))
            assertEquals(alice, directory.resolveByTraqId("alice"))
            assertEquals(alice, directory.resolveByUserId(alice.userId.uppercase()))
            assertEquals(1, storedLookups)
            assertEquals(1, remoteLookups)
            assertEquals(1, persists)
        }

    @Test
    fun `stored identity avoids remote lookup`() =
        runBlocking {
            var remoteLookups = 0
            val directory =
                directory(
                    storedByTraqId = { alice },
                    remoteByTraqId = {
                        remoteLookups += 1
                        null
                    },
                )

            assertEquals(alice, directory.resolveByTraqId("alice"))
            assertEquals(0, remoteLookups)
        }

    @Test
    fun `concurrent cold lookups share one load`() =
        runBlocking {
            var storedLookups = 0
            var remoteLookups = 0
            val loadStarted = CompletableDeferred<Unit>()
            val releaseLoad = CompletableDeferred<Unit>()
            val directory =
                directory(
                    storedByTraqId = {
                        storedLookups += 1
                        null
                    },
                    remoteByTraqId = {
                        remoteLookups += 1
                        loadStarted.complete(Unit)
                        releaseLoad.await()
                        alice
                    },
                )

            coroutineScope {
                val lookups = List(20) { async { directory.resolveByTraqId("alice") } }
                loadStarted.await()
                yield()
                releaseLoad.complete(Unit)

                assertEquals(List(20) { alice }, lookups.awaitAll())
            }
            assertEquals(1, storedLookups)
            assertEquals(1, remoteLookups)
        }

    @Test
    fun `miss is not cached`() =
        runBlocking {
            var remoteLookups = 0
            val directory =
                directory(
                    remoteByTraqId = {
                        remoteLookups += 1
                        if (remoteLookups == 1) null else alice
                    },
                )

            assertNull(directory.resolveByTraqId("alice"))
            assertEquals(alice, directory.resolveByTraqId("alice"))
            assertEquals(2, remoteLookups)
        }

    @Test
    fun `concurrent miss is shared but remains retryable`() =
        runBlocking {
            var remoteLookups = 0
            val loadStarted = CompletableDeferred<Unit>()
            val releaseLoad = CompletableDeferred<Unit>()
            val directory =
                directory(
                    remoteByTraqId = {
                        remoteLookups += 1
                        if (remoteLookups == 1) {
                            loadStarted.complete(Unit)
                            releaseLoad.await()
                            null
                        } else {
                            alice
                        }
                    },
                )

            coroutineScope {
                val lookups = List(20) { async { directory.resolveByTraqId("alice") } }
                loadStarted.await()
                yield()
                releaseLoad.complete(Unit)

                assertEquals(List<ViewerIdentity?>(20) { null }, lookups.awaitAll())
            }
            assertEquals(1, remoteLookups)
            assertEquals(alice, directory.resolveByTraqId("alice"))
            assertEquals(2, remoteLookups)
        }

    @Test
    fun `persistence failure leaves lookup retryable`() =
        runBlocking {
            var remoteLookups = 0
            var persists = 0
            val directory =
                directory(
                    remoteByTraqId = {
                        remoteLookups += 1
                        alice
                    },
                    persist = { _, _ ->
                        persists += 1
                        if (persists == 1) error("database unavailable")
                    },
                )

            assertFailsWith<IllegalStateException> {
                directory.resolveByTraqId("alice")
            }
            assertEquals(alice, directory.resolveByTraqId("alice"))
            assertEquals(2, remoteLookups)
            assertEquals(2, persists)
        }

    @Test
    fun `cancelled leader does not strand the resolution lock`() =
        runBlocking {
            var remoteLookups = 0
            val firstLoadStarted = CompletableDeferred<Unit>()
            val neverReleaseFirstLoad = CompletableDeferred<Unit>()
            val directory =
                directory(
                    remoteByTraqId = {
                        remoteLookups += 1
                        if (remoteLookups == 1) {
                            firstLoadStarted.complete(Unit)
                            neverReleaseFirstLoad.await()
                        }
                        alice
                    },
                )

            val firstLookup = launch { directory.resolveByTraqId("alice") }
            firstLoadStarted.await()
            firstLookup.cancelAndJoin()

            assertEquals(alice, directory.resolveByTraqId("alice"))
            assertEquals(2, remoteLookups)
        }

    @Test
    fun `conflicting immutable mapping is rejected`() =
        runBlocking {
            val bobWithAliceUuid = alice.copy(traqId = "bob")
            var persists = 0
            val directory =
                directory(
                    remoteByTraqId = { traqId -> if (traqId == "alice") alice else bobWithAliceUuid },
                    persist = { _, _ -> persists += 1 },
                )

            assertEquals(alice, directory.resolveByTraqId("alice"))
            assertFailsWith<IllegalStateException> {
                directory.resolveByTraqId("bob")
            }
            assertEquals(1, persists)
        }

    @Test
    fun `concurrent conflicting keys persist only one immutable mapping`() =
        runBlocking {
            val bobWithAliceUuid = alice.copy(traqId = "bob")
            val releaseLoads = CompletableDeferred<Unit>()
            var startedLoads = 0
            var persists = 0
            val awaitOtherLoad: suspend () -> Unit = {
                startedLoads += 1
                if (startedLoads == 2) {
                    releaseLoads.complete(Unit)
                }
                releaseLoads.await()
            }
            val directory =
                directory(
                    remoteByTraqId = {
                        awaitOtherLoad()
                        alice
                    },
                    remoteByUserId = {
                        awaitOtherLoad()
                        bobWithAliceUuid
                    },
                    persist = { _, _ -> persists += 1 },
                )

            val results =
                coroutineScope {
                    listOf(
                        async { runCatching { directory.resolveByTraqId(alice.traqId) } },
                        async { runCatching { directory.resolveByUserId(alice.userId) } },
                    ).awaitAll()
                }

            assertEquals(1, results.count(Result<ViewerIdentity?>::isSuccess))
            assertEquals(1, results.count(Result<ViewerIdentity?>::isFailure))
            assertEquals(1, persists)
        }

    @Test
    fun `blank traQ ID and invalid UUID avoid all lookups`() =
        runBlocking {
            var lookups = 0
            val directory =
                directory(
                    storedByTraqId = {
                        lookups += 1
                        null
                    },
                    storedByUserId = {
                        lookups += 1
                        null
                    },
                )

            assertNull(directory.resolveByTraqId("  "))
            assertNull(directory.resolveByUserId("not-a-uuid"))
            assertEquals(0, lookups)
        }

    private fun directory(
        storedByTraqId: suspend (String) -> ViewerIdentity? = { null },
        storedByUserId: suspend (String) -> ViewerIdentity? = { null },
        remoteByTraqId: suspend (String) -> ViewerIdentity? = { null },
        remoteByUserId: suspend (String) -> ViewerIdentity? = { null },
        persist: suspend (ViewerIdentity, Set<String>) -> Unit = { _, _ -> },
    ): TraqIdentityDirectory =
        TraqIdentityDirectory(
            storedIdentityByTraqId = storedByTraqId,
            storedIdentityByUserId = storedByUserId,
            remoteIdentityByTraqId = remoteByTraqId,
            remoteIdentityByUserId = remoteByUserId,
            persistIdentity = persist,
        )
}
