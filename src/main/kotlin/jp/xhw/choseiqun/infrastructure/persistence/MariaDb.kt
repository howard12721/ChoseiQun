package jp.xhw.choseiqun.infrastructure.persistence

import io.github.smyrgeorge.sqlx4k.mysql.IMySQL
import io.github.smyrgeorge.sqlx4k.mysql.mySQL
import jp.xhw.choseiqun.config.MariaDbConfig

class MariaDb(
    config: MariaDbConfig,
) {
    internal val client: IMySQL =
        mySQL(
            url = config.url,
            username = config.user,
            password = config.password,
        )

    suspend fun initialize() {
        DatabaseMigrator(client).migrate()
    }

    suspend fun close() {
        client.close().getOrThrow()
    }
}
