#!/usr/bin/env zsh
# Run the moderation system SQL test suite against the Supabase Postgres database.
# REQUIREMENTS:
# 1. libpq (psql) installed: brew install libpq && echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
# 2. Set environment variable SUPABASE_DB_URL to the full Postgres connection string.
#    Example format:
#    postgres://postgres:<PASSWORD>@db.cdvhodymzfwdzfeltmsu.supabase.co:6543/postgres
#    (Find credentials in Supabase Dashboard: Project Settings -> Database -> Connection string)
# 3. Ensure the test file exists: tests/moderation_system_tests.sql
# 4. Use a non-production or isolated environment if possible (the test script ROLLBACKs all changes).

set -euo pipefail

if ! command -v psql >/dev/null 2>&1; then
  echo "[ERROR] psql not found. Install with: brew install libpq" >&2
  exit 1
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "[ERROR] SUPABASE_DB_URL not set. Export it first, e.g.:"
  echo "export SUPABASE_DB_URL=postgres://postgres:YOUR_PASSWORD@db.cdvhodymzfwdzfeltmsu.supabase.co:6543/postgres"
  exit 1
fi

TEST_FILE="tests/moderation_system_tests.sql"
if [[ ! -f "$TEST_FILE" ]]; then
  echo "[ERROR] Test file '$TEST_FILE' not found."
  exit 1
fi

echo "[INFO] Running moderation test suite..."
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$TEST_FILE" | tee /tmp/moderation_test_results.log || {
  echo "[ERROR] Test suite execution failed." >&2
  exit 1
}

echo "[INFO] Test run complete. Raw output stored in /tmp/moderation_test_results.log"

grep -E "PASSED|FAILED" /tmp/moderation_test_results.log || echo "[WARN] Could not extract pass/fail lines. Review log manually."