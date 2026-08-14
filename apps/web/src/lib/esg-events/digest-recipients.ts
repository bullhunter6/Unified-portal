import "server-only";

import { esgPrisma } from "@esgcredit/db-esg";
import { z } from "zod";
import { getNextEsgWeeklyDigestWindow } from "./weekly-digest-dates";

const recipientEmailSchema = z
  .string()
  .trim()
  .max(254)
  .email()
  .transform((value) => value.toLocaleLowerCase("en"));
export const ESG_EVENT_DIGEST_MAX_ACTIVE_RECIPIENTS = 250;
export const ESG_EVENT_DIGEST_MAX_TOTAL_RECIPIENTS = 500;

export type EsgEventDigestRecipientDto = {
  id: number;
  email: string;
  isActive: boolean;
  startsOn: string;
  createdAt: string;
  updatedAt: string;
};

export class DuplicateEsgEventDigestRecipientError extends Error {
  constructor(email: string) {
    super(`${email} is already an event digest recipient`);
    this.name = "DuplicateEsgEventDigestRecipientError";
  }
}

export class EsgEventDigestRecipientLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EsgEventDigestRecipientLimitError";
  }
}

export class StaleEsgEventDigestRecipientError extends Error {
  constructor() {
    super("This recipient changed in another admin session. Refresh and try again.");
    this.name = "StaleEsgEventDigestRecipientError";
  }
}

export function normalizeEsgEventDigestRecipientEmail(value: unknown): string {
  const parsed = recipientEmailSchema.safeParse(value);
  if (!parsed.success) throw new RangeError("Enter a valid email address");
  return parsed.data;
}

function positiveId(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError("Recipient id must be a positive integer");
  }
  return value;
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toDto(recipient: {
  id: number;
  email: string;
  is_active: boolean;
  starts_on: Date;
  created_at: Date;
  updated_at: Date;
}): EsgEventDigestRecipientDto {
  return {
    id: recipient.id,
    email: recipient.email,
    isActive: recipient.is_active,
    startsOn: dateOnly(recipient.starts_on),
    createdAt: recipient.created_at.toISOString(),
    updatedAt: recipient.updated_at.toISOString(),
  };
}

export async function listEsgEventDigestRecipients(): Promise<ReadonlyArray<EsgEventDigestRecipientDto>> {
  const recipients = await esgPrisma.esg_event_digest_recipients.findMany({
    orderBy: [{ is_active: "desc" }, { email: "asc" }],
  });
  return recipients.map(toDto);
}

export async function listEligibleEsgEventDigestRecipientEmails(
  weekStart: string,
): Promise<string[]> {
  const recipients = await esgPrisma.esg_event_digest_recipients.findMany({
    where: {
      is_active: true,
      starts_on: { lte: new Date(`${weekStart}T00:00:00.000Z`) },
    },
    orderBy: { email: "asc" },
    select: { email: true },
  });
  return recipients.map(({ email }) => email);
}

export async function createEsgEventDigestRecipient(args: {
  email: unknown;
  adminUserId: number;
  now?: Date;
}): Promise<EsgEventDigestRecipientDto> {
  const email = normalizeEsgEventDigestRecipientEmail(args.email);
  positiveId(args.adminUserId);
  const startsOn = getNextEsgWeeklyDigestWindow(args.now).weekStart;
  try {
    const recipient = await esgPrisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('esg_event_digest_recipients'))`;
      const [active, total] = await Promise.all([
        transaction.esg_event_digest_recipients.count({ where: { is_active: true } }),
        transaction.esg_event_digest_recipients.count(),
      ]);
      if (active >= ESG_EVENT_DIGEST_MAX_ACTIVE_RECIPIENTS) {
        throw new EsgEventDigestRecipientLimitError(
          `The active recipient limit is ${ESG_EVENT_DIGEST_MAX_ACTIVE_RECIPIENTS}`,
        );
      }
      if (total >= ESG_EVENT_DIGEST_MAX_TOTAL_RECIPIENTS) {
        throw new EsgEventDigestRecipientLimitError(
          `The recipient register limit is ${ESG_EVENT_DIGEST_MAX_TOTAL_RECIPIENTS}`,
        );
      }
      return transaction.esg_event_digest_recipients.create({
        data: {
          email,
          is_active: true,
          starts_on: new Date(`${startsOn}T00:00:00.000Z`),
          created_by_user_id: args.adminUserId,
          updated_by_user_id: args.adminUserId,
        },
      });
    });
    return toDto(recipient);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DuplicateEsgEventDigestRecipientError(email);
    }
    throw error;
  }
}

export async function setEsgEventDigestRecipientActive(args: {
  id: number;
  isActive: boolean;
  adminUserId: number;
  expectedUpdatedAt?: string;
  now?: Date;
}): Promise<EsgEventDigestRecipientDto | null> {
  const id = positiveId(args.id);
  positiveId(args.adminUserId);
  const startsOn = getNextEsgWeeklyDigestWindow(args.now).weekStart;
  const expectedUpdatedAt = args.expectedUpdatedAt
    ? new Date(args.expectedUpdatedAt)
    : null;
  if (expectedUpdatedAt && Number.isNaN(expectedUpdatedAt.getTime())) {
    throw new RangeError("expectedUpdatedAt must be a valid timestamp");
  }
  return esgPrisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('esg_event_digest_recipients'))`;
    const existing = await transaction.esg_event_digest_recipients.findUnique({ where: { id } });
    if (!existing) return null;
    if (expectedUpdatedAt && existing.updated_at.getTime() !== expectedUpdatedAt.getTime()) {
      throw new StaleEsgEventDigestRecipientError();
    }
    if (args.isActive === existing.is_active) {
      return toDto(existing);
    }
    if (args.isActive && !existing.is_active) {
      const active = await transaction.esg_event_digest_recipients.count({ where: { is_active: true } });
      if (active >= ESG_EVENT_DIGEST_MAX_ACTIVE_RECIPIENTS) {
        throw new EsgEventDigestRecipientLimitError(
          `The active recipient limit is ${ESG_EVENT_DIGEST_MAX_ACTIVE_RECIPIENTS}`,
        );
      }
    }
    const recipient = await transaction.esg_event_digest_recipients.update({
      where: { id },
      data: args.isActive
        ? {
            is_active: true,
            starts_on: new Date(`${startsOn}T00:00:00.000Z`),
            updated_by_user_id: args.adminUserId,
          }
        : { is_active: false, updated_by_user_id: args.adminUserId },
    });
    return toDto(recipient);
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && error.code === "P2002",
  );
}
