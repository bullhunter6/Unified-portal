import "server-only";

import { createHash } from "node:crypto";
import { enqueueEmailWithHistory } from "@/lib/alerts/email-queue";
import { env } from "@/lib/config/env";
import { createEsgRequestClock } from "./dates";
import { listEligibleEsgEventDigestRecipientEmails } from "./digest-recipients";
import { listEsgWeeklyDigestEvents } from "./repository";
import {
  getEsgWeeklyDigestWindow,
  isEsgWeeklyDigestDue,
} from "./weekly-digest-dates";
import {
  ESG_WEEKLY_DIGEST_TEMPLATE_VERSION,
  renderEsgWeeklyDigest,
} from "./weekly-digest-template";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DELIVERY_KEY_PREFIX = "esg-events-weekly:v1";
const DEFAULT_TEST_RECIPIENT = "saikrishna.pashapu@finvizier.com";

export type EsgWeeklyDigestMode = "production" | "test";

export type EsgWeeklyDigestDelivery = {
  recipient: string;
  queueId: number | null;
  historyId: number | null;
  deduplicated: boolean;
  error: string | null;
};

export type EsgWeeklyDigestQueueResult = {
  status: "disabled" | "not-due" | "no-recipients" | "queued";
  mode: EsgWeeklyDigestMode;
  weekStart: string;
  weekEnd: string;
  eventCount: number;
  onlineCount: number;
  otherCount: number;
  deliveries: ReadonlyArray<EsgWeeklyDigestDelivery>;
};

export class EsgWeeklyDigestQueueError extends Error {
  constructor(public readonly result: EsgWeeklyDigestQueueResult) {
    super("One or more ESG weekly digest deliveries could not be queued");
    this.name = "EsgWeeklyDigestQueueError";
  }
}

function normalizedEmail(value: string): string {
  const email = value.trim().toLocaleLowerCase("en");
  if (!email || email.length > 255 || !EMAIL_PATTERN.test(email)) {
    throw new Error("ESG events digest contains an invalid recipient email address");
  }
  return email;
}

export function parseEsgWeeklyDigestRecipients(raw: string | undefined): string[] {
  const recipients = (raw ?? "")
    .split(/[;,]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizedEmail);
  return Array.from(new Set(recipients));
}

async function productionRecipients(weekStart: string): Promise<string[]> {
  return listEligibleEsgEventDigestRecipientEmails(weekStart);
}

function testRecipient(): string {
  const recipients = parseEsgWeeklyDigestRecipients(
    env.ESG_EVENTS_DIGEST_TEST_RECIPIENT ?? DEFAULT_TEST_RECIPIENT,
  );
  if (recipients.length !== 1) {
    throw new Error("ESG_EVENTS_DIGEST_TEST_RECIPIENT must contain exactly one email address");
  }
  return recipients[0];
}

function deliveryKey(weekStart: string, recipient: string): string {
  const fingerprint = createHash("sha256").update(recipient).digest("hex").slice(0, 32);
  return `${DELIVERY_KEY_PREFIX}:${weekStart}:${fingerprint}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown queue error";
}

export function isEsgWeeklyDigestEnabled(): boolean {
  return env.ESG_EVENTS_DIGEST_ENABLED?.trim().toLocaleLowerCase("en") === "true";
}

export async function queueEsgEventsWeeklyDigest(args: {
  mode: EsgWeeklyDigestMode;
  now?: Date;
  ownerUserId?: number | null;
}): Promise<EsgWeeklyDigestQueueResult> {
  const now = args.now ? new Date(args.now.getTime()) : new Date();
  const window = getEsgWeeklyDigestWindow(now);
  const clock = createEsgRequestClock(now);
  const recipients = args.mode === "test"
    ? [testRecipient()]
    : await productionRecipients(window.weekStart);
  if (recipients.length === 0) {
    return {
      status: "no-recipients",
      mode: args.mode,
      weekStart: window.weekStart,
      weekEnd: window.weekEnd,
      eventCount: 0,
      onlineCount: 0,
      otherCount: 0,
      deliveries: [],
    };
  }
  const events = await listEsgWeeklyDigestEvents(window, clock);
  const template = renderEsgWeeklyDigest({
    weekStart: window.weekStart,
    weekEnd: window.weekEnd,
    events,
    portalBaseUrl: env.NEXTAUTH_URL,
    testMode: args.mode === "test",
  });
  const eventIds = events.map((event) => event.id);

  const deliveries = await Promise.all(recipients.map(async (recipient): Promise<EsgWeeklyDigestDelivery> => {
    try {
      const queued = await enqueueEmailWithHistory({
        userId: args.ownerUserId ?? null,
        to: recipient,
        subject: template.subject,
        text: template.text,
        html: template.html,
        domain: "esg",
        alertType: "esg_events_weekly",
        contentType: "event_digest",
        contentIds: eventIds,
        totalItems: events.length,
        priority: 10,
        deliveryKey: args.mode === "production"
          ? deliveryKey(window.weekStart, recipient)
          : undefined,
        jobId: `${args.mode === "test" ? "test:" : ""}esg-events-week:${window.weekStart}`,
        templateVersion: ESG_WEEKLY_DIGEST_TEMPLATE_VERSION,
        metadata: {
          feature: "esg_events_weekly_digest",
          mode: args.mode,
          generatedAt: clock.nowIso,
          timezone: "Asia/Dubai",
          weekStart: window.weekStart,
          weekEnd: window.weekEnd,
          eventIds,
          eventCount: events.length,
          onlineCount: template.onlineCount,
          otherCount: template.otherCount,
        },
      });
      return {
        recipient,
        queueId: queued.queueId,
        historyId: queued.historyId,
        deduplicated: queued.deduplicated,
        error: null,
      };
    } catch (error) {
      return {
        recipient,
        queueId: null,
        historyId: null,
        deduplicated: false,
        error: errorMessage(error),
      };
    }
  }));

  const result: EsgWeeklyDigestQueueResult = {
    status: "queued",
    mode: args.mode,
    weekStart: window.weekStart,
    weekEnd: window.weekEnd,
    eventCount: events.length,
    onlineCount: template.onlineCount,
    otherCount: template.otherCount,
    deliveries,
  };
  if (deliveries.some((delivery) => delivery.error)) {
    throw new EsgWeeklyDigestQueueError(result);
  }
  return result;
}

export async function queueDueEsgEventsWeeklyDigest(
  now = new Date(),
): Promise<EsgWeeklyDigestQueueResult> {
  const window = getEsgWeeklyDigestWindow(now);
  if (!isEsgWeeklyDigestEnabled()) {
    return {
      status: "disabled",
      mode: "production",
      weekStart: window.weekStart,
      weekEnd: window.weekEnd,
      eventCount: 0,
      onlineCount: 0,
      otherCount: 0,
      deliveries: [],
    };
  }
  if (!isEsgWeeklyDigestDue(now)) {
    return {
      status: "not-due",
      mode: "production",
      weekStart: window.weekStart,
      weekEnd: window.weekEnd,
      eventCount: 0,
      onlineCount: 0,
      otherCount: 0,
      deliveries: [],
    };
  }
  return queueEsgEventsWeeklyDigest({ mode: "production", now, ownerUserId: null });
}
