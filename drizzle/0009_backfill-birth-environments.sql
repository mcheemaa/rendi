-- Custom migration (data, not schema): rows older than the production
-- cutover were born in the dev environment, the fact the replaced
-- archive logic encoded in code. Recorded here so any replay of these
-- migrations reconstructs provenance instead of defaulting history to
-- prod. Idempotent.
UPDATE "conversations"
SET "trigger_env" = 'dev'
WHERE "created_at" < '2026-07-22T20:40:00+00'
  AND "trigger_env" <> 'dev';
