# ChoseiQun

traP部内向け日程調整サービス

https://chosei.trap.show/

## Native ビルド

サーバーは、実行ホスト向け（macOS arm64 または Linux x64/arm64）の Kotlin/Native 実行ファイルとしてビルドされます。

```shell
./gradlew serverTest linkReleaseExecutableServer
```

リリースバイナリは `build/bin/server/releaseExecutable/choseiqun.kexe` に出力されます。Docker イメージは Linux x64 版をビルドし、JREを含みません。

`MARIADB_URL` は `mysql://host:port/database` 形式です。既存の `jdbc:mariadb://...` も自動変換します。現在の Native MySQL ドライバは TLS 接続に対応していないため、MariaDB は信頼できる内部ネットワークで接続してください。

## DBマイグレーション

起動時に未適用のマイグレーションだけをバージョン順に適用し、`schema_migrations` にバージョン・名前・チェックサムを記録します。スキーマを変更するときは `src/main/kotlin/jp/xhw/choseiqun/infrastructure/persistence/DatabaseMigrator.kt` の末尾へ次の連番を追加し、適用済みのマイグレーションは変更しないでください。

## ローカルデバッグ

MariaDB、Native デバッグ版バックエンド、Vite 開発サーバーをまとめて起動します。

```shell
TRAQ_BOT_TOKEN=... TRAQ_BOT_ID=... docker compose -f compose.debug.yml up --build --detach --wait
```

フロントエンドは <http://localhost:5173>、API は <http://localhost:8080/api/polls>、MariaDB はホストの `3307` 番ポートで確認できます。フロントエンドの変更は HMR で反映されます。

Kotlin/Native コンパイラは Linux arm64 ホストに対応していないため、Apple Silicon 上でもバックエンドコンテナだけは Linux amd64 でビルド・実行します。

ローカルでも本番と同じ traQ Bot を起動するため、`TRAQ_BOT_TOKEN` とBot登録IDの `TRAQ_BOT_ID` は必須です。メンション判定に使うBot User IDは起動時に `getMe` で取得します。API プロキシはデフォルトで `X-Forwarded-User: traP` を付与し、バックエンドが Bot API からユーザー UUID を解決します。別のユーザー名を使う場合は `DEBUG_TRAQ_USER`、ポートを変更する場合は `FRONTEND_PORT`、`BACKEND_PORT`、`MARIADB_PORT` を指定してください。

```shell
docker compose -f compose.debug.yml down
```
