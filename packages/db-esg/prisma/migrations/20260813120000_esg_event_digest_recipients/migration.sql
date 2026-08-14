CREATE TABLE "esg_event_digest_recipients" (
  "id" SERIAL NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "starts_on" DATE NOT NULL,
  "created_by_user_id" INTEGER,
  "updated_by_user_id" INTEGER,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "esg_event_digest_recipients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "esg_event_digest_recipients_email_normalized"
    CHECK (
      "email" = lower(btrim("email"))
      AND char_length("email") BETWEEN 3 AND 254
      AND "email" !~ '[[:space:]]'
      AND "email" ~ '^[^@]+@[^@]+$'
    ),
  CONSTRAINT "esg_event_digest_recipients_created_by_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "esg_event_digest_recipients_updated_by_fkey"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "esg_event_digest_recipients_email_key"
  ON "esg_event_digest_recipients"("email");
CREATE INDEX "idx_esg_event_digest_recipients_active"
  ON "esg_event_digest_recipients"("is_active", "starts_on");
CREATE INDEX "idx_esg_event_digest_recipients_created_by"
  ON "esg_event_digest_recipients"("created_by_user_id");
CREATE INDEX "idx_esg_event_digest_recipients_updated_by"
  ON "esg_event_digest_recipients"("updated_by_user_id");
CREATE INDEX "idx_alert_history_esg_events_weekly_created"
  ON "alert_history"("created_at" DESC, "id" DESC)
  WHERE "domain" = 'esg' AND "alert_type" = 'esg_events_weekly';

-- Bootstrap the two confirmed production recipients. If this migration is
-- deployed after Monday 09:00 Dubai time, start them next Monday rather than
-- turning a mid-week deployment into an unexpected catch-up delivery.
WITH dubai_schedule AS (
  SELECT (
    date_trunc('week', local_now)
    + CASE
        WHEN local_now < date_trunc('week', local_now) + interval '9 hours'
          THEN interval '0 days'
        ELSE interval '7 days'
      END
  )::date AS starts_on
  FROM (SELECT now() AT TIME ZONE 'Asia/Dubai' AS local_now) clock
)
INSERT INTO "esg_event_digest_recipients" ("email", "starts_on")
SELECT recipient.email, dubai_schedule.starts_on
FROM (
  VALUES
    ('saikrishna.pashapu@finvizier.com'),
    ('darya.gaeva@finvizier.com')
) AS recipient(email)
CROSS JOIN dubai_schedule
ON CONFLICT ("email") DO NOTHING;
