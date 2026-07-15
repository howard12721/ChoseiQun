package jp.xhw.choseiqun

import io.ktor.server.cio.CIO
import io.ktor.server.engine.embeddedServer
import jp.xhw.choseiqun.application.identity.OrganizerIdentityBackfill
import jp.xhw.choseiqun.application.poll.PollService
import jp.xhw.choseiqun.config.AppConfig
import jp.xhw.choseiqun.infrastructure.persistence.MariaDb
import jp.xhw.choseiqun.infrastructure.persistence.SqlxIdentityRepository
import jp.xhw.choseiqun.infrastructure.persistence.SqlxPollRepository
import jp.xhw.choseiqun.infrastructure.traq.TraqAnnouncementGateway
import jp.xhw.choseiqun.infrastructure.traq.TraqIdentityDirectory
import jp.xhw.choseiqun.presentation.http.PollHttpPresenter
import jp.xhw.choseiqun.presentation.http.configureHttp
import jp.xhw.choseiqun.presentation.traq.TraqBotRunner
import jp.xhw.trakt.bot.trakt
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

fun main() {
    runBlocking {
        val config = AppConfig.fromEnvironment()
        val database = MariaDb(config.database)
        try {
            database.initialize()
            runApplication(config, database)
        } finally {
            database.close()
        }
    }
}

private suspend fun CoroutineScope.runApplication(
    config: AppConfig,
    database: MariaDb,
) {
    val pollRepository = SqlxPollRepository(database.client)
    val identityRepository = SqlxIdentityRepository(database.client)
    val traqClient =
        config.botConfig?.let {
            trakt(token = it.token, botId = it.botId, origin = it.traqOrigin)
        }
    val identityDirectory = TraqIdentityDirectory(identityRepository, traqClient)
    OrganizerIdentityBackfill(identityDirectory, identityRepository).run()
    val announcementGateway =
        traqClient?.let {
            TraqAnnouncementGateway(it, config.publicBaseUrl)
        }
    val pollService =
        PollService(
            repository = pollRepository,
            announcementGateway = announcementGateway,
        )
    val presenter = PollHttpPresenter(config.publicBaseUrl, config.traqBaseUrl)
    val botRunner =
        traqClient?.let {
            TraqBotRunner.create(it, pollService, identityDirectory)
        }
    val server =
        embeddedServer(CIO, host = "0.0.0.0", port = config.port) {
            configureHttp(pollService, identityDirectory, presenter, config.publicBaseUrl)
        }

    val botJob =
        botRunner?.let {
            launch(Dispatchers.Default) {
                botRunner.run()
            }
        }

    try {
        server.start(wait = true)
    } finally {
        try {
            botRunner?.stop()
        } finally {
            botJob?.cancelAndJoin()
        }
    }
}
