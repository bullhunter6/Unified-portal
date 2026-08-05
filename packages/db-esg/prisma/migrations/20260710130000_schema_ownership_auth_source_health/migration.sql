-- Reconcile required ownership with the foreign-key action. PDF job rows are
-- owner-scoped and are removed when their owning account is deleted.
ALTER TABLE "pdf_translation_jobs"
  DROP CONSTRAINT IF EXISTS "pdf_translation_jobs_user_id_fkey";

ALTER TABLE "pdf_translation_jobs"
  ADD CONSTRAINT "pdf_translation_jobs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "file_uploads"
  ADD COLUMN "warning_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "warnings_json" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- These three models existed in schema.prisma and application queries but were
-- missing from migration history.
CREATE TABLE IF NOT EXISTS "monitored_ingest_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source_name" VARCHAR(64) NOT NULL,
  "started_at" TIMESTAMPTZ(6) NOT NULL,
  "finished_at" TIMESTAMPTZ(6),
  "status" VARCHAR(32) NOT NULL DEFAULT 'running',
  "fetched" INTEGER NOT NULL DEFAULT 0,
  "normalized" INTEGER NOT NULL DEFAULT 0,
  "matched_total" INTEGER NOT NULL DEFAULT 0,
  "matched_esg" INTEGER NOT NULL DEFAULT 0,
  "matched_credit" INTEGER NOT NULL DEFAULT 0,
  "created_count" INTEGER NOT NULL DEFAULT 0,
  "updated_count" INTEGER NOT NULL DEFAULT 0,
  "unchanged_count" INTEGER NOT NULL DEFAULT 0,
  "deleted_count" INTEGER NOT NULL DEFAULT 0,
  "emails_sent" INTEGER NOT NULL DEFAULT 0,
  "partial_errors_count" INTEGER NOT NULL DEFAULT 0,
  "duration_ms" DECIMAL(18,3),
  "error_type" VARCHAR(128),
  "error" TEXT,
  "metadata_json" JSONB,
  CONSTRAINT "monitored_ingest_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monitored_ingest_runs_source_name_fkey"
    FOREIGN KEY ("source_name") REFERENCES "monitored_tender_sources"("name")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "monitored_tender_candidates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "run_id" UUID NOT NULL,
  "source_name" VARCHAR(64) NOT NULL,
  "external_id" VARCHAR(256) NOT NULL,
  "title" TEXT NOT NULL,
  "title_en" TEXT,
  "buyer_name" TEXT,
  "country" VARCHAR(2) NOT NULL,
  "published_at" TIMESTAMPTZ(6),
  "deadline_at" TIMESTAMPTZ(6),
  "status" VARCHAR(32) NOT NULL DEFAULT 'unknown',
  "source_url" VARCHAR(1024) NOT NULL,
  "matched_groups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "match_details" JSONB,
  "match_status" VARCHAR(32) NOT NULL DEFAULT 'unmatched',
  "raw_json" JSONB NOT NULL,
  "seen_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monitored_tender_candidates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monitored_tender_candidates_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "monitored_ingest_runs"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "monitored_tender_candidates_source_name_fkey"
    FOREIGN KEY ("source_name") REFERENCES "monitored_tender_sources"("name")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "monitored_system_alerts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "alert_key" VARCHAR(160) NOT NULL,
  "alert_type" VARCHAR(64) NOT NULL,
  "severity" VARCHAR(16) NOT NULL DEFAULT 'warning',
  "status" VARCHAR(16) NOT NULL DEFAULT 'open',
  "source_name" VARCHAR(64),
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "metadata_json" JSONB,
  "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(6),
  "notifications_sent" INTEGER NOT NULL DEFAULT 0,
  "last_notified_at" TIMESTAMPTZ(6),
  CONSTRAINT "monitored_system_alerts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "monitored_system_alerts_source_name_fkey"
    FOREIGN KEY ("source_name") REFERENCES "monitored_tender_sources"("name")
    ON DELETE SET NULL ON UPDATE CASCADE
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monitored_ingest_runs_source_name_fkey') THEN
    ALTER TABLE "monitored_ingest_runs" ADD CONSTRAINT "monitored_ingest_runs_source_name_fkey"
      FOREIGN KEY ("source_name") REFERENCES "monitored_tender_sources"("name")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monitored_tender_candidates_run_id_fkey') THEN
    ALTER TABLE "monitored_tender_candidates" ADD CONSTRAINT "monitored_tender_candidates_run_id_fkey"
      FOREIGN KEY ("run_id") REFERENCES "monitored_ingest_runs"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monitored_tender_candidates_source_name_fkey') THEN
    ALTER TABLE "monitored_tender_candidates" ADD CONSTRAINT "monitored_tender_candidates_source_name_fkey"
      FOREIGN KEY ("source_name") REFERENCES "monitored_tender_sources"("name")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monitored_system_alerts_source_name_fkey') THEN
    ALTER TABLE "monitored_system_alerts" ADD CONSTRAINT "monitored_system_alerts_source_name_fkey"
      FOREIGN KEY ("source_name") REFERENCES "monitored_tender_sources"("name")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_monitored_ingest_runs_source_started"
  ON "monitored_ingest_runs"("source_name", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_monitored_ingest_runs_status"
  ON "monitored_ingest_runs"("status");
CREATE INDEX IF NOT EXISTS "idx_monitored_ingest_runs_started_at"
  ON "monitored_ingest_runs"("started_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_monitored_tender_candidates_run_id"
  ON "monitored_tender_candidates"("run_id");
CREATE INDEX IF NOT EXISTS "idx_monitored_tender_candidates_source_seen"
  ON "monitored_tender_candidates"("source_name", "seen_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_monitored_tender_candidates_external"
  ON "monitored_tender_candidates"("source_name", "external_id");
CREATE INDEX IF NOT EXISTS "idx_monitored_tender_candidates_seen_at"
  ON "monitored_tender_candidates"("seen_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_monitored_system_alerts_key"
  ON "monitored_system_alerts"("alert_key");
CREATE INDEX IF NOT EXISTS "idx_monitored_system_alerts_status"
  ON "monitored_system_alerts"("status");
CREATE INDEX IF NOT EXISTS "idx_monitored_system_alerts_type"
  ON "monitored_system_alerts"("alert_type");
CREATE INDEX IF NOT EXISTS "idx_monitored_system_alerts_source_name"
  ON "monitored_system_alerts"("source_name");
CREATE INDEX IF NOT EXISTS "idx_monitored_system_alerts_last_seen_at"
  ON "monitored_system_alerts"("last_seen_at" DESC);

-- Durable login failure windows shared by every web replica.
CREATE TABLE "auth_rate_limits" (
  "scope_key" VARCHAR(80) NOT NULL,
  "scope_type" VARCHAR(16) NOT NULL,
  "failure_count" INTEGER NOT NULL DEFAULT 0,
  "window_started_at" TIMESTAMPTZ(6) NOT NULL,
  "window_expires_at" TIMESTAMPTZ(6) NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("scope_key")
);
CREATE INDEX "idx_auth_rate_limits_expiry" ON "auth_rate_limits"("window_expires_at");
CREATE INDEX "idx_auth_rate_limits_type_updated" ON "auth_rate_limits"("scope_type", "updated_at" DESC);

-- Stable ESG lookup cache and aggregated source-health telemetry.
CREATE TABLE "esg_source_cache" (
  "source" VARCHAR(20) NOT NULL,
  "normalized_query" VARCHAR(256) NOT NULL,
  "outcome" VARCHAR(24) NOT NULL,
  "result_json" JSONB NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "esg_source_cache_pkey" PRIMARY KEY ("source", "normalized_query")
);
CREATE INDEX "idx_esg_source_cache_expiry" ON "esg_source_cache"("expires_at");

CREATE TABLE "esg_source_health_metrics" (
  "source" VARCHAR(20) NOT NULL,
  "outcome" VARCHAR(24) NOT NULL,
  "window_start" TIMESTAMPTZ(6) NOT NULL,
  "request_count" INTEGER NOT NULL DEFAULT 0,
  "total_latency_ms" BIGINT NOT NULL DEFAULT 0,
  "last_error_code" VARCHAR(80),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "esg_source_health_metrics_pkey" PRIMARY KEY ("source", "outcome", "window_start")
);
CREATE INDEX "idx_esg_source_health_window" ON "esg_source_health_metrics"("window_start");
