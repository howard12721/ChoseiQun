#!/usr/bin/env bash
# A private MariaDB instance, with no connection to the configured application DB.
set -euo pipefail
cd "$(dirname "$0")/.."
for command in mariadb-install-db mariadbd mariadb mariadb-admin; do
  command -v "$command" >/dev/null || { echo "Required command: $command" >&2; exit 1; }
done
scratch=$(mktemp -d "${TMPDIR:-/tmp}/choseiqun-migration.XXXXXX")
port=${CHOSEIQUN_TEST_PORT:-33280}
database_pid=
cleanup() {
  if [[ -n "$database_pid" ]]; then
    kill "$database_pid" 2>/dev/null || true
    wait "$database_pid" 2>/dev/null || true
  fi
  rm -rf "$scratch"
}
trap cleanup EXIT
mariadb-install-db --no-defaults --datadir="$scratch/data" --auth-root-authentication-method=normal --skip-test-db >"$scratch/install.log" 2>&1
mariadbd --no-defaults --datadir="$scratch/data" --socket="$scratch/mysql.sock" --pid-file="$scratch/mysql.pid" --log-error="$scratch/mysql.log" --bind-address=127.0.0.1 --port="$port" &
database_pid=$!
for ((attempt=0; attempt<100; attempt++)); do
  if mariadb-admin --no-defaults --socket="$scratch/mysql.sock" -u root ping >/dev/null 2>&1; then break; fi
  if ! kill -0 "$database_pid" 2>/dev/null; then cat "$scratch/mysql.log" >&2; exit 1; fi
  sleep 0.1
done
mariadb --no-defaults --socket="$scratch/mysql.sock" -u root <<'SQL'
CREATE DATABASE choseiqun_test CHARACTER SET utf8mb4;
CREATE USER 'choseiqun_test'@'localhost' IDENTIFIED BY 'choseiqun_test';
GRANT ALL ON choseiqun_test.* TO 'choseiqun_test'@'localhost';
SQL
CHOSEIQUN_TEST_DATABASE_URL="mysql://127.0.0.1:$port/choseiqun_test" ./gradlew serverTest --rerun
