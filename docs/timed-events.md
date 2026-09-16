# 時間帯付きイベント

## スキーマ v4

起動時の `DatabaseMigrator` が v4 `add_timed_candidates` を適用する。v1〜v3 のSQL・チェックサムは変更しない。

| テーブル | 変更 |
| --- | --- |
| `polls` | `schedule_type VARCHAR(16) NOT NULL DEFAULT 'DATE_ONLY'` を追加 |
| `poll_candidate_dates` → `poll_candidates` | `candidate_date` を `candidate_key VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin` に変更 |
| `poll_candidates` | `date DATE NOT NULL`、`start_time TIME NULL`、`end_time TIME NULL` を追加 |
| `participant_responses` | `response_date` を同じ型の `candidate_key` に変更 |

候補の主キーは `(poll_id, candidate_key)`、回答の主キーは `(participant_id, candidate_key)`。候補キーは日付のみなら `2026-09-21`、時間帯付きなら `2026-09-21/18:00-19:00`。

旧候補のキーは元の日付文字列を維持し、`date` をその値から埋める。時刻は両方NULL、既存イベントはすべて `DATE_ONLY`。参加者、回答、旧note、コメント、主催者情報は移行時に消さない。過去に候補から削除された日への回答も維持するため、回答から候補への外部キーは追加しない。

MariaDBのDDLは暗黙コミットするため、v4は途中失敗後に再実行できるSQLで構成している。全SQL成功後に履歴を記録する。実DBテストではv3のデータを作り、v4を途中まで実行した状態から再開し、再起動時の適用済み判定も確認している。

Native MySQLドライバは `ascii_bin` のキーをバイナリ扱いするため、回答キーのSELECTでは `CAST(... AS CHAR CHARACTER SET utf8mb4)` を使用する。DBのキー比較は引き続き `ascii_bin`。

## API

### 設定・公開: `POST /api/setup/{id}`

既存の主催者認証を継続する。日付のみの従来リクエスト（`title`, `description`, `candidateDates`）も受け付ける。

```json
{
  "title": "開発チーム定例会",
  "description": "",
  "scheduleType": "TIMED",
  "candidateDates": ["2026-09-21"],
  "candidates": [
    {"date": "2026-09-21", "startTime": "18:00", "endTime": "19:00"},
    {"date": "2026-09-21", "startTime": "19:30", "endTime": "20:30"}
  ]
}
```

- `candidateDates` は編集画面で選択した日付。指定時は候補の全日付と一致する必要があり、時間帯未設定の日があれば400になる。
- 候補キーはサーバー側で生成。同じ日付・開始・終了の候補を重複除去し、日付・時刻順に並べる。
- 日付は実在する `YYYY-MM-DD`、時刻は24時間表記の `HH:mm`。秒は受け付けない。
- `DATE_ONLY` は開始・終了ともNULL。`TIMED` は両方必須。終了は開始より後の同日内の時刻とし、終了が開始以前なら400。個別・一括設定でも検証し、公開・適用を無効にする。
- 時間帯は開始時刻、同じ開始なら終了時刻の順に並べる。編集画面は入力欄のグループからフォーカスが離れた時点で並べ替え、未入力の開始時刻は末尾に置く。
- 最大90日、入力候補は最大900件。不正なリクエストで保存済みデータは変えない。
- 既存の回答は同じ候補キーにのみ引き継ぐ。追加・変更された候補は既存参加者も `NO`。

### 回答: `POST /api/polls/{id}/availability`

```json
{
  "responses": {
    "2026-09-21/18:00-19:00": "YES",
    "2026-09-21/19:30-20:30": "NO"
  }
}
```

値は `YES` / `MAYBE` / `NO`。省略した候補はすべて `NO`。存在しない候補キーは400（設定変更後の古い回答画面からの送信も含む）。日付のみの場合は従来どおり日付文字列がキーとなる。

詳細・一覧レスポンスには `scheduleType` と `candidates`（`candidateKey`, `date`, `startTime`, `endTime`）を追加し、互換用の `candidateDates` も残す。`summary.days` と `summary.recommendedDates` の各要素も候補単位になり、キーと時刻を返す。同じ日の複数候補を日付だけで結合しないこと。

## 適用手順

1. バックアップを取得し、旧バックエンドを停止する。
2. 新しいフロントエンドとバックエンドを同じリリースで配置する。
3. 新バックエンドの起動時にv4が自動適用される。`schema_migrations` のバージョン4と起動ログを確認する。
4. 既存の日付のみイベントの表示・回答と、新しい時間帯付きイベントの公開を確認する。

テーブル名が変わるため新旧バックエンドの同時稼働はできない。旧版へ戻す場合は旧バイナリだけでなく移行前バックアップも戻す。実装作業では一時DBでのみ移行を実行しており、運用DBへの適用は行っていない。

## 検証

```sh
npm --prefix frontend run check
./gradlew serverTest linkReleaseExecutableServer
bash scripts/test-migration.sh
```

最後のスクリプトはインストール済みMariaDB CLIを使用し、一時ディレクトリに専用DBサーバーを起動する。既定のポートは33280（`CHOSEIQUN_TEST_PORT`で変更可）。終了時にそのプロセスと一時データを削除し、アプリ用DBには接続しない。通常の `serverTest` では実DBテストは実行されないため、移行変更時はこのスクリプトも実行する。

実DB検証: 旧候補・回答・コメント維持、途中再開、二重適用防止、時間帯保存・読込・一覧、重複除去、未指定回答のNO補完。

ブラウザ検証（Chrome、実HTTP API＋一時MariaDB）: 未設定時の公開禁止、一括置き換え、重複除去、全候補NOで送信、コメントの投稿・編集・削除。PC 1280px / モバイル390px / 狭幅320pxで各画面の横はみ出しを検査。

`./gradlew -Ppreview linkPreviewDebugExecutableServer` ではBotを起動しない検証用サーバーを作成できる。`build/bin/server/previewDebugExecutable/preview.kexe` は `127.0.0.1:33279/choseiqun_preview`（ユーザー・パスワードとも `choseiqun_test`）だけに接続し、起動ごとにサンプルイベントを上書きする。APIは18080番。Viteは `VITE_BACKEND_URL=http://127.0.0.1:18080 VITE_DEBUG_TRAQ_USER=Hiro npm --prefix frontend run dev` で接続する。通常のリリース実行ファイルにはこの起動経路は含まれない。
