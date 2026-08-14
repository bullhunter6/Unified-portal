import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    ESG_EVENTS_DIGEST_ENABLED: "true",
    ESG_EVENTS_DIGEST_RECIPIENTS:
      "saikrishna.pashapu@finvizier.com,darya.gaeva@finvizier.com",
    ESG_EVENTS_DIGEST_TEST_RECIPIENT: "saikrishna.pashapu@finvizier.com",
    NEXTAUTH_URL: "https://portal.example.test",
  },
  enqueue: vi.fn(),
  listEvents: vi.fn(),
  listRecipients: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/config/env", () => ({ env: mocks.env }));
vi.mock("@/lib/alerts/email-queue", () => ({
  enqueueEmailWithHistory: mocks.enqueue,
}));
vi.mock("./digest-recipients", () => ({
  listEligibleEsgEventDigestRecipientEmails: mocks.listRecipients,
}));
vi.mock("./repository", () => ({
  listEsgWeeklyDigestEvents: mocks.listEvents,
}));

import {
  EsgWeeklyDigestQueueError,
  parseEsgWeeklyDigestRecipients,
  queueDueEsgEventsWeeklyDigest,
  queueEsgEventsWeeklyDigest,
} from "./weekly-digest";

beforeEach(() => {
  mocks.env.ESG_EVENTS_DIGEST_ENABLED = "true";
  mocks.env.ESG_EVENTS_DIGEST_RECIPIENTS =
    "saikrishna.pashapu@finvizier.com,darya.gaeva@finvizier.com";
  mocks.env.ESG_EVENTS_DIGEST_TEST_RECIPIENT = "saikrishna.pashapu@finvizier.com";
  mocks.env.NEXTAUTH_URL = "https://portal.example.test";
  mocks.listRecipients.mockResolvedValue([
    "saikrishna.pashapu@finvizier.com",
    "darya.gaeva@finvizier.com",
  ]);
  mocks.listEvents.mockResolvedValue([]);
  mocks.enqueue.mockResolvedValue({ queueId: 11, historyId: 12, deduplicated: false });
});

describe("ESG weekly digest delivery", () => {
  it("normalizes and deduplicates configured recipients", () => {
    expect(parseEsgWeeklyDigestRecipients(
      " SAIKRISHNA.PASHAPU@finvizier.com;saikrishna.pashapu@finvizier.com ",
    )).toEqual(["saikrishna.pashapu@finvizier.com"]);
    expect(() => parseEsgWeeklyDigestRecipients("not-an-email"))
      .toThrow("invalid recipient");
  });

  it("does no database work while disabled or before Monday 09:00 Dubai", async () => {
    mocks.env.ESG_EVENTS_DIGEST_ENABLED = "false";
    await expect(queueDueEsgEventsWeeklyDigest(new Date("2026-08-10T06:00:00.000Z")))
      .resolves.toMatchObject({ status: "disabled" });
    expect(mocks.listEvents).not.toHaveBeenCalled();

    mocks.env.ESG_EVENTS_DIGEST_ENABLED = "true";
    await expect(queueDueEsgEventsWeeklyDigest(new Date("2026-08-10T04:59:59.000Z")))
      .resolves.toMatchObject({ status: "not-due" });
    expect(mocks.listEvents).not.toHaveBeenCalled();
  });

  it("queues one permanently deduplicated production delivery per recipient", async () => {
    const result = await queueDueEsgEventsWeeklyDigest(
      new Date("2026-08-10T05:00:00.000Z"),
    );

    expect(result).toMatchObject({
      status: "queued",
      mode: "production",
      weekStart: "2026-08-10",
      weekEnd: "2026-08-16",
    });
    expect(mocks.listRecipients).toHaveBeenCalledWith("2026-08-10");
    expect(mocks.enqueue).toHaveBeenCalledTimes(2);
    const calls = mocks.enqueue.mock.calls.map(([args]) => args);
    expect(calls.map((args) => args.to)).toEqual([
      "saikrishna.pashapu@finvizier.com",
      "darya.gaeva@finvizier.com",
    ]);
    expect(calls.every((args) => args.userId === null)).toBe(true);
    expect(calls.every((args) => args.deliveryKey.startsWith("esg-events-weekly:v1:2026-08-10:")))
      .toBe(true);
    expect(calls[0].deliveryKey).not.toBe(calls[1].deliveryKey);
  });

  it("treats an empty database recipient list as authoritative", async () => {
    mocks.listRecipients.mockResolvedValueOnce([]);

    const result = await queueDueEsgEventsWeeklyDigest(
      new Date("2026-08-10T05:00:00.000Z"),
    );

    expect(result).toMatchObject({
      status: "no-recipients",
      mode: "production",
      weekStart: "2026-08-10",
      deliveries: [],
    });
    // The legacy environment value deliberately remains populated in this
    // fixture. It must never revive recipients disabled in the database.
    expect(mocks.env.ESG_EVENTS_DIGEST_RECIPIENTS).toContain("finvizier.com");
    expect(mocks.listEvents).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("forces test deliveries to the single configured dev recipient", async () => {
    const result = await queueEsgEventsWeeklyDigest({
      mode: "test",
      now: new Date("2026-08-12T12:00:00.000Z"),
      ownerUserId: 42,
    });

    expect(result.deliveries).toHaveLength(1);
    expect(mocks.listRecipients).not.toHaveBeenCalled();
    expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42,
      to: "saikrishna.pashapu@finvizier.com",
      deliveryKey: undefined,
      subject: expect.stringMatching(/^\[TEST\]/),
    }));
  });

  it("reports partial queue failures so the worker retries safely", async () => {
    mocks.enqueue
      .mockResolvedValueOnce({ queueId: 11, historyId: 12, deduplicated: false })
      .mockRejectedValueOnce(new Error("temporary database failure"));

    await expect(queueDueEsgEventsWeeklyDigest(new Date("2026-08-11T05:00:00.000Z")))
      .rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(EsgWeeklyDigestQueueError);
        const digestError = error as EsgWeeklyDigestQueueError;
        expect(digestError.result.deliveries).toEqual([
          expect.objectContaining({ error: null }),
          expect.objectContaining({ error: "temporary database failure" }),
        ]);
        return true;
      });
  });
});
