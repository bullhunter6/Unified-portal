# ESG Event Ingestion Contract

This document is the shared contract between Portal v3 and every process that writes to the ESG `events` table. The table is also written by an external scraper, so schema rollout and scraper rollout must be coordinated.

## Rollout order

1. Take and verify an ESG database backup.
2. Inspect the deployed scraper and confirm every `INSERT` names its columns. Positional statements such as `INSERT INTO events VALUES (...)` are not compatible with additive schema changes and must be fixed before the migration is applied.
3. Deploy migration `20260804120000_esg_event_ledger_fields`.
4. Deploy the scraper update described below.
5. Run the backfill in dry-run mode, review all anomaly and ambiguous-location rows, add only source-backed overrides, then run it with `--apply`.
6. Regenerate the Prisma client and deploy the portal after migration and backfill review.

The four new columns are nullable, so the previous application and scraper remain compatible when they use named-column inserts. Rolling the application back does not require dropping these additive columns.

## Required named-column write

Writers must provide an explicit column list. This abbreviated example shows the normalized fields; production writers should continue to include every raw field they collect.

```sql
INSERT INTO events (
  event_id,
  event_name,
  event_url,
  start_date,
  end_date,
  start_time,
  end_time,
  timezone,
  timezone_iana,
  venue_name,
  venue_address,
  country_code,
  city,
  attendance_mode,
  source,
  month
)
VALUES (
  :event_id,
  :event_name,
  :event_url,
  :start_date,
  :end_date,
  :start_time,
  :end_time,
  :timezone,
  :timezone_iana,
  :venue_name,
  :venue_address,
  :country_code,
  :city,
  :attendance_mode,
  :source,
  :legacy_month
)
ON CONFLICT (event_id) DO UPDATE SET
  event_name = EXCLUDED.event_name,
  event_url = EXCLUDED.event_url,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  timezone = EXCLUDED.timezone,
  timezone_iana = COALESCE(EXCLUDED.timezone_iana, events.timezone_iana),
  venue_name = EXCLUDED.venue_name,
  venue_address = EXCLUDED.venue_address,
  country_code = COALESCE(EXCLUDED.country_code, events.country_code),
  city = COALESCE(EXCLUDED.city, events.city),
  attendance_mode = COALESCE(EXCLUDED.attendance_mode, events.attendance_mode),
  source = EXCLUDED.source,
  month = EXCLUDED.month;
```

Do not replace a known normalized value with `NULL` during an upsert merely because a later scrape omitted it. Prefer `COALESCE(EXCLUDED.country_code, events.country_code)` (and the equivalent for the other normalized columns) unless the source explicitly corrected the value.

## Field semantics

| Column | Contract |
| --- | --- |
| `start_date` | Local calendar date in `YYYY-MM-DD`. The event's first day. |
| `end_date` | Inclusive local calendar date in `YYYY-MM-DD`. For a one-day event it may equal `start_date`; for a start-date-only event it is null. Never store an exclusive end date. |
| `start_time`, `end_time` | Local wall-clock values stored as PostgreSQL `TIME`, using `HH:mm[:ss]`. Do not attach a synthetic date or convert these fields to UTC. |
| `timezone` | Unmodified source timezone text retained for compatibility and diagnostics. |
| `timezone_iana` | A verified IANA time-zone identifier such as `Asia/Dubai` or `Europe/London`, maximum 64 characters. Do not store abbreviations such as `GST`, `EST`, or `BST`. Null means that an exact instant cannot be established. |
| `venue_name` | Unmodified venue label supplied by the source. |
| `venue_address` | Unmodified venue address supplied by the source. |
| `country_code` | Uppercase ISO 3166-1 alpha-2 code, exactly two letters. Null means unknown; it does not mean online. |
| `city` | Canonical city label, maximum 120 characters. It must be null when no reliable city is known. |
| `attendance_mode` | `in_person`, `online`, or `hybrid`. Null means unknown. The public URL spelling `in-person` is a presentation-layer value and must not be written to the database. |
| URL fields | `event_url`, `tickets_url`, `organizer_url`, and `image_url` must be absolute `http://` or `https://` URLs. Reject relative, script, data, and malformed URLs. |
| `month` | Legacy mixed-format scraper value. Continue preserving it while old writers need it, but Portal v3 must not query it. Month discovery is derived from inclusive start/end dates. |

The normalized and raw fields serve different purposes. Never derive `Online` from a missing venue or missing location. A record with no trustworthy physical location remains `country_code = NULL`, `city = NULL`, and is displayed as location to be confirmed unless `attendance_mode = 'online'` is explicit.

## Normalization precedence

Scrapers and backfills must use this order:

1. Detect explicit hybrid language.
2. Detect explicit online-only language or platforms.
3. Normalize a physical city/country only from source-backed location evidence.
4. Validate a source timezone as an IANA identifier, or use a reviewed city-to-timezone mapping.
5. Leave ambiguous labels such as `APAC`, `Global`, `Worldwide`, or `Multiple locations` null.

Do not infer a country from a source publisher, organizer headquarters, top-level domain, audience region, or event title when it is not clearly the event location.

## Backfill and anomaly review

The backfill is dry-run by default and only fills normalized columns that are currently null:

```bash
pnpm -C apps/web exec tsx ../../scripts/esg-events/fixtures.mts
pnpm -C apps/web exec tsx ../../scripts/esg-events/backfill.mts --dry-run
pnpm -C apps/web exec tsx ../../scripts/esg-events/backfill.mts --apply
```

The report contains total, mapped, unmapped, planned-update, reversed-range, long-range, and review counts. The default long-range review threshold is 31 days and can be changed for investigation with `--long-range-days=N`.

Reviewed exceptions live in `scripts/esg-events/location-overrides.v1.json`. Use the stable `<source>:<event_id>` key whenever possible. A database `id:<id>` key is allowed only for legacy records without an external ID. Every override requires an absolute source evidence URL. Date corrections require their own evidence URL and may set a corrected inclusive end date or `null` for confirmed start-date-only events.

Reversed ranges are never silently swapped. Without a reviewed correction, the portal treats them as start-date-only and the backfill keeps them in the review report. Unusually long ranges are also review-only until the source confirms the stored interval.

The script is idempotent. An interrupted apply can be run again: populated normalized values are preserved, and already-applied date overrides produce no further change.

## Release checks and monitoring

- Run `prisma validate` against the checked-in ESG schema and apply the migration to a disposable PostgreSQL database.
- Confirm both database checks reject lowercase/invalid country codes and unsupported attendance modes.
- Confirm the four query indexes exist and inspect representative list/facet query plans.
- Run the fixture command before every backfill change.
- Monitor normalized-location coverage, ambiguous/review volume, invalid URL/timezone counts, reversed/long ranges, and facet-to-list mismatches after rollout.
