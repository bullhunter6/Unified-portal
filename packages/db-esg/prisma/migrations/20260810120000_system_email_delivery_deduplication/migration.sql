-- Scheduled system emails do not necessarily belong to a portal user. Keep the
-- existing foreign keys for user-owned alerts while allowing system-owned rows.
ALTER TABLE "alert_history"
  ALTER COLUMN "user_id" DROP NOT NULL,
  ADD COLUMN "delivery_key" VARCHAR(180);

ALTER TABLE "email_queue"
  ALTER COLUMN "user_id" DROP NOT NULL;

-- A delivery key represents a logical outbound message (for example one
-- weekly digest for one recipient). PostgreSQL permits multiple NULL values in
-- a unique index, so existing alert flows remain unaffected.
CREATE UNIQUE INDEX "alert_history_delivery_key_key"
  ON "alert_history"("delivery_key");
