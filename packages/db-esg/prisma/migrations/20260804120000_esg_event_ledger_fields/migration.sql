-- Add normalized ESG-event discovery fields without changing the legacy
-- scraper-owned venue, timezone, or month columns.
ALTER TABLE "events"
  ADD COLUMN "country_code" VARCHAR(2),
  ADD COLUMN "city" VARCHAR(120),
  ADD COLUMN "attendance_mode" VARCHAR(16),
  ADD COLUMN "timezone_iana" VARCHAR(64);

ALTER TABLE "events"
  ADD CONSTRAINT "events_country_code_iso2_check"
    CHECK (
      "country_code" IS NULL
      OR (
        "country_code" ~ '^[A-Z]{2}$'
        AND "country_code" IN (
          'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
          'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
          'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
          'DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR',
          'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
          'HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
          'JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ',
          'LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
          'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
          'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM',
          'PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW',
          'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
          'TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
          'UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU','WF','WS','YE','YT','ZA','ZM','ZW'
        )
      )
    ),
  ADD CONSTRAINT "events_attendance_mode_check"
    CHECK (
      "attendance_mode" IS NULL
      OR "attendance_mode" IN ('in_person', 'online', 'hybrid')
    );

CREATE INDEX "idx_events_start_end_date"
  ON "events"("start_date", "end_date");

CREATE INDEX "idx_events_end_date"
  ON "events"("end_date");

CREATE INDEX "idx_events_source_date"
  ON "events"("source", "start_date", "end_date");

CREATE INDEX "idx_events_country_city_date"
  ON "events"("country_code", "city", "start_date", "end_date");

-- The public URL treats canonical city/source values case-insensitively.
-- Functional indexes preserve that behavior without degrading list/facet scans.
CREATE INDEX "idx_events_country_city_ci_date"
  ON "events"(
    "country_code",
    lower("city"),
    (COALESCE("start_date", "end_date")),
    (CASE
      WHEN "start_date" IS NULL THEN "end_date"
      WHEN "end_date" IS NULL
        OR "end_date" < "start_date"
        OR "end_date" > "start_date" + 366
      THEN "start_date"
      ELSE "end_date"
    END)
  );

CREATE INDEX "idx_events_source_ci_date"
  ON "events"(
    lower("source"),
    (COALESCE("start_date", "end_date")),
    (CASE
      WHEN "start_date" IS NULL THEN "end_date"
      WHEN "end_date" IS NULL
        OR "end_date" < "start_date"
        OR "end_date" > "start_date" + 366
      THEN "start_date"
      ELSE "end_date"
    END)
  );

-- Calendar-overlap and default upcoming views use the same effective-date
-- expressions as the application, including start-only and reversed ranges.
CREATE INDEX "idx_events_effective_start_date"
  ON "events"((COALESCE("start_date", "end_date")));

CREATE INDEX "idx_events_effective_end_date"
  ON "events"((CASE
    WHEN "start_date" IS NULL THEN "end_date"
    WHEN "end_date" IS NULL
      OR "end_date" < "start_date"
      OR "end_date" > "start_date" + 366
    THEN "start_date"
    ELSE "end_date"
  END));
