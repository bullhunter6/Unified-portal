-- Translator 1 has been retired. Remove its queued work before dropping the
-- obsolete domain tables; Translator 2 uses the separate pdf_translation_v2
-- queue and tables and is intentionally preserved.
DELETE FROM "background_jobs"
WHERE "job_type" = 'pdf_translation';

DROP TABLE IF EXISTS "translation_pages";
DROP TABLE IF EXISTS "pdf_translations";
DROP TABLE IF EXISTS "translation_history";
DROP TABLE IF EXISTS "pdf_translation_jobs";
