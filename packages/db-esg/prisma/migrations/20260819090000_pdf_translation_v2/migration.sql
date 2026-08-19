CREATE TABLE "pdf_translation_v2_jobs" (
    "id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "target_lang" VARCHAR(40) NOT NULL DEFAULT 'English',
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "stage" VARCHAR(40) NOT NULL DEFAULT 'queued',
    "message" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total_pages" INTEGER NOT NULL DEFAULT 0,
    "current_page" INTEGER NOT NULL DEFAULT 0,
    "document_context" JSONB,
    "metrics" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "input_pdf" BYTEA NOT NULL,
    "output_pdf" BYTEA,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "completed_at" TIMESTAMPTZ,
    CONSTRAINT "pdf_translation_v2_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pdf_translation_v2_jobs_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "pdf_translation_v2_pages" (
    "id" SERIAL NOT NULL,
    "job_id" UUID NOT NULL,
    "page_number" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "source_layout" JSONB,
    "translated_layout" JSONB,
    "source_text" TEXT,
    "translated_text" TEXT,
    "extraction_model" VARCHAR(80),
    "translation_model" VARCHAR(80),
    "extraction_attempts" INTEGER NOT NULL DEFAULT 0,
    "translation_attempts" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "validation" JSONB,
    "warnings" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "pdf_translation_v2_pages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pdf_translation_v2_pages_job_id_fkey"
      FOREIGN KEY ("job_id") REFERENCES "pdf_translation_v2_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "pdf_translation_v2_pages_job_page_key"
  ON "pdf_translation_v2_pages"("job_id", "page_number");
CREATE INDEX "idx_pdf_translation_v2_pages_job_status"
  ON "pdf_translation_v2_pages"("job_id", "status", "page_number");
CREATE INDEX "idx_pdf_translation_v2_jobs_user_created"
  ON "pdf_translation_v2_jobs"("user_id", "created_at" DESC);
CREATE INDEX "idx_pdf_translation_v2_jobs_status_created"
  ON "pdf_translation_v2_jobs"("status", "created_at");
