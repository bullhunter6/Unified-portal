import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

import { Prisma, PrismaClient } from "../../packages/db-esg/generated/client/index.js";

import {
  auditDateRange,
  isAbsoluteHttpUrl,
  normalizeEvent,
  overrideKey,
  type AttendanceMode,
  type EventNormalizationInput,
  type EventOverride,
} from "./location-normalizer.mts";

interface DbEventRow extends EventNormalizationInput {
  currentCountryCode: string | null;
  currentCity: string | null;
  currentAttendanceMode: AttendanceMode | null;
  currentTimezoneIana: string | null;
}

interface OverrideFile {
  version: 1;
  events: Record<string, EventOverride>;
}

interface PlannedUpdate {
  id: number;
  countryCode: string | null;
  city: string | null;
  attendanceMode: AttendanceMode | null;
  timezoneIana: string | null;
  correctEndDate: boolean;
  endDate: string | null;
}

interface ReviewRow {
  id: number;
  key: string;
  eventName: string | null;
  source: string | null;
  reasons: string[];
  durationDays: number | null;
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const overridePath = path.join(scriptDirectory, "location-overrides.v1.json");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadWorkspaceEnvironment(): void {
  const inheritedKeys = new Set(Object.keys(process.env));
  for (const filename of [".env", "apps/web/.env", ".env.local", "apps/web/.env.local"]) {
    const envPath = path.join(repositoryRoot, filename);
    if (!existsSync(envPath)) continue;
    const parsed = parseEnv(readFileSync(envPath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (!inheritedKeys.has(key)) process.env[key] = value;
    }
  }
}

function parseOptionalNullableString(
  value: Record<string, unknown>,
  key: string,
): string | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(value, key)) return undefined;
  const candidate = value[key];
  if (candidate === null) return null;
  if (typeof candidate !== "string") throw new Error(`Override '${key}' must be a string or null.`);
  return candidate;
}

function parseOverride(value: unknown, key: string): EventOverride {
  if (!isRecord(value)) throw new Error(`Override '${key}' must be an object.`);
  if (typeof value.evidenceUrl !== "string" || !isAbsoluteHttpUrl(value.evidenceUrl)) {
    throw new Error(`Override '${key}' needs an absolute HTTP(S) evidenceUrl.`);
  }

  const attendanceMode = parseOptionalNullableString(value, "attendanceMode");
  if (
    attendanceMode !== undefined &&
    attendanceMode !== null &&
    !["in_person", "online", "hybrid"].includes(attendanceMode)
  ) {
    throw new Error(`Override '${key}' has an invalid attendanceMode.`);
  }

  const parsed: EventOverride = { evidenceUrl: value.evidenceUrl };
  const countryCode = parseOptionalNullableString(value, "countryCode");
  const city = parseOptionalNullableString(value, "city");
  const timezoneIana = parseOptionalNullableString(value, "timezoneIana");
  if (countryCode !== undefined) parsed.countryCode = countryCode;
  if (city !== undefined) parsed.city = city;
  if (attendanceMode !== undefined) {
    parsed.attendanceMode = attendanceMode as AttendanceMode | null;
  }
  if (timezoneIana !== undefined) parsed.timezoneIana = timezoneIana;
  if (typeof value.note === "string") parsed.note = value.note;

  if (Object.prototype.hasOwnProperty.call(value, "dateCorrection")) {
    if (!isRecord(value.dateCorrection)) {
      throw new Error(`Override '${key}' dateCorrection must be an object.`);
    }
    const endDateValue = value.dateCorrection.endDate;
    let endDate: string | null;
    if (endDateValue === null) {
      endDate = null;
    } else if (typeof endDateValue === "string") {
      endDate = endDateValue;
    } else {
      throw new Error(`Override '${key}' dateCorrection.endDate must be YYYY-MM-DD or null.`);
    }
    if (
      typeof value.dateCorrection.evidenceUrl !== "string" ||
      !isAbsoluteHttpUrl(value.dateCorrection.evidenceUrl)
    ) {
      throw new Error(`Override '${key}' dateCorrection needs an absolute HTTP(S) evidenceUrl.`);
    }
    parsed.dateCorrection = {
      endDate,
      evidenceUrl: value.dateCorrection.evidenceUrl,
    };
  }

  return parsed;
}

function loadOverrides(): OverrideFile {
  const raw: unknown = JSON.parse(readFileSync(overridePath, "utf8"));
  if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.events)) {
    throw new Error("location-overrides.v1.json must contain version 1 and an events object.");
  }
  return {
    version: 1,
    events: Object.fromEntries(
      Object.entries(raw.events).map(([key, value]) => [key, parseOverride(value, key)]),
    ),
  };
}

function parseArguments(): { apply: boolean; longRangeDays: number } {
  let requestedMode: "apply" | "dry-run" | null = null;
  let longRangeDays = 31;
  for (const argument of process.argv.slice(2)) {
    if (argument === "--apply") {
      if (requestedMode === "dry-run") {
        throw new Error("Choose either --dry-run or --apply, not both.");
      }
      requestedMode = "apply";
      continue;
    }
    if (argument === "--dry-run") {
      if (requestedMode === "apply") {
        throw new Error("Choose either --dry-run or --apply, not both.");
      }
      requestedMode = "dry-run";
      continue;
    }
    if (argument === "--help") {
      console.log(
        "Usage: pnpm -C apps/web exec tsx ../../scripts/esg-events/backfill.mts [--dry-run|--apply] [--long-range-days=N]",
      );
      process.exit(0);
    }
    if (argument.startsWith("--long-range-days=")) {
      const value = Number(argument.slice("--long-range-days=".length));
      if (!Number.isSafeInteger(value) || value < 1 || value > 3_650) {
        throw new Error("--long-range-days must be an integer from 1 to 3650.");
      }
      longRangeDays = value;
      continue;
    }
    throw new Error(`Unknown argument '${argument}'. Use --help for usage.`);
  }
  return { apply: requestedMode === "apply", longRangeDays };
}

function hasNormalizedProposal(update: PlannedUpdate): boolean {
  return Boolean(
    update.countryCode ||
      update.city ||
      update.attendanceMode ||
      update.timezoneIana ||
      update.correctEndDate,
  );
}

loadWorkspaceEnvironment();
const { apply, longRangeDays } = parseArguments();
const databaseUrl = process.env.ESG_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("ESG_DATABASE_URL (or DATABASE_URL) is required.");

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
  log: ["warn", "error"],
});

try {
  const overrides = loadOverrides();
  const rows = await prisma.$queryRaw<DbEventRow[]>(Prisma.sql`
    SELECT
      id,
      event_id AS "eventId",
      event_name AS "eventName",
      venue_name AS "venueName",
      venue_address AS "venueAddress",
      tags,
      source,
      timezone,
      to_char(start_date, 'YYYY-MM-DD') AS "startDate",
      to_char(end_date, 'YYYY-MM-DD') AS "endDate",
      country_code AS "currentCountryCode",
      city AS "currentCity",
      attendance_mode AS "currentAttendanceMode",
      timezone_iana AS "currentTimezoneIana"
    FROM events
    ORDER BY id
  `);

  const updates: PlannedUpdate[] = [];
  const reviews: ReviewRow[] = [];
  let recordsMapped = 0;
  let recordsUnmapped = 0;
  let locationMapped = 0;
  let attendanceMapped = 0;
  let timezoneMapped = 0;
  let reversedRanges = 0;
  let longRanges = 0;
  let alreadyCurrent = 0;

  for (const row of rows) {
    const key = overrideKey(row);
    const override = overrides.events[key];
    const normalized = normalizeEvent(row, override);
    const overrideInvalid = normalized.requiresReview.some(
      (reason) => reason.startsWith("override-") || reason.startsWith("date-override-"),
    );
    const requestedDateCorrection = !overrideInvalid ? override?.dateCorrection : undefined;
    const correctedRangeAudit = requestedDateCorrection
      ? auditDateRange(row.startDate, requestedDateCorrection.endDate, longRangeDays)
      : null;
    const correctedRangeInvalid = correctedRangeAudit?.kind === "reversed";
    const canApplyDateCorrection = Boolean(requestedDateCorrection && !correctedRangeInvalid);
    const correctedEndDate = canApplyDateCorrection && requestedDateCorrection
      ? requestedDateCorrection.endDate
      : row.endDate;
    const dateAudit = auditDateRange(row.startDate, correctedEndDate, longRangeDays);
    const reviewReasons = [...normalized.requiresReview];
    if (correctedRangeInvalid) reviewReasons.push("date-override-range-invalid");
    if (dateAudit.kind === "reversed") {
      reversedRanges += 1;
      reviewReasons.push("reversed-date-range:start-date-only-fallback");
    } else if (dateAudit.kind === "long") {
      longRanges += 1;
      reviewReasons.push(`long-date-range:${dateAudit.durationDays}-days`);
    }

    if (reviewReasons.length) {
      reviews.push({
        id: row.id,
        key,
        eventName: row.eventName,
        source: row.source,
        reasons: [...new Set(reviewReasons)],
        durationDays: dateAudit.durationDays,
      });
    }

    const proposed: PlannedUpdate = {
      id: row.id,
      countryCode: row.currentCountryCode ?? normalized.countryCode,
      city: row.currentCity ?? normalized.city,
      attendanceMode: row.currentAttendanceMode ?? normalized.attendanceMode,
      timezoneIana: row.currentTimezoneIana ?? normalized.timezoneIana,
      correctEndDate: canApplyDateCorrection,
      endDate: correctedEndDate,
    };
    const changesNormalizedFields =
      proposed.countryCode !== row.currentCountryCode ||
      proposed.city !== row.currentCity ||
      proposed.attendanceMode !== row.currentAttendanceMode ||
      proposed.timezoneIana !== row.currentTimezoneIana;
    const changesDate = proposed.correctEndDate && proposed.endDate !== row.endDate;

    if (normalized.countryCode || normalized.city) locationMapped += 1;
    if (normalized.attendanceMode) attendanceMapped += 1;
    if (normalized.timezoneIana) timezoneMapped += 1;
    if (hasNormalizedProposal(proposed)) recordsMapped += 1;
    else recordsUnmapped += 1;

    if (changesNormalizedFields || changesDate) updates.push(proposed);
    else alreadyCurrent += 1;
  }

  let updatedRows = 0;
  if (apply) {
    // Small, independently idempotent updates make a partial interruption safe:
    // rerunning fills only remaining null normalized fields.
    for (const update of updates) {
      updatedRows += await prisma.$executeRaw(Prisma.sql`
        UPDATE events
        SET
          country_code = COALESCE(country_code, ${update.countryCode}),
          city = COALESCE(city, ${update.city}),
          attendance_mode = COALESCE(attendance_mode, ${update.attendanceMode}),
          timezone_iana = COALESCE(timezone_iana, ${update.timezoneIana}),
          end_date = CASE
            WHEN ${update.correctEndDate} THEN ${update.endDate}::date
            ELSE end_date
          END
        WHERE id = ${update.id}
          AND (
            (country_code IS NULL AND ${update.countryCode}::varchar IS NOT NULL)
            OR (city IS NULL AND ${update.city}::varchar IS NOT NULL)
            OR (attendance_mode IS NULL AND ${update.attendanceMode}::varchar IS NOT NULL)
            OR (timezone_iana IS NULL AND ${update.timezoneIana}::varchar IS NOT NULL)
            OR (${update.correctEndDate} AND end_date IS DISTINCT FROM ${update.endDate}::date)
          )
      `);
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        overrideVersion: overrides.version,
        longRangeReviewThresholdDays: longRangeDays,
        summary: {
          total: rows.length,
          recordsMapped,
          recordsUnmapped,
          locationMapped,
          attendanceMapped,
          timezoneMapped,
          alreadyCurrent,
          updatesPlanned: updates.length,
          updatedRows,
          review: reviews.length,
          reversedRanges,
          longRanges,
        },
        reviewRows: reviews.slice(0, 100),
        reviewRowsTruncated: reviews.length > 100,
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
