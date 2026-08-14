import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const recipient = {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const transactionClient = {
    $executeRaw: vi.fn(),
    esg_event_digest_recipients: recipient,
  };
  return {
    recipient,
    transactionClient,
    transaction: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@esgcredit/db-esg", () => ({
  esgPrisma: {
    $transaction: mocks.transaction,
    esg_event_digest_recipients: mocks.recipient,
  },
}));

import {
  DuplicateEsgEventDigestRecipientError,
  ESG_EVENT_DIGEST_MAX_ACTIVE_RECIPIENTS,
  ESG_EVENT_DIGEST_MAX_TOTAL_RECIPIENTS,
  EsgEventDigestRecipientLimitError,
  StaleEsgEventDigestRecipientError,
  createEsgEventDigestRecipient,
  listEligibleEsgEventDigestRecipientEmails,
  listEsgEventDigestRecipients,
  normalizeEsgEventDigestRecipientEmail,
  setEsgEventDigestRecipientActive,
} from "./digest-recipients";

type RecipientRow = {
  id: number;
  email: string;
  is_active: boolean;
  starts_on: Date;
  created_by_user_id: number | null;
  updated_by_user_id: number | null;
  created_at: Date;
  updated_at: Date;
};

function recipientRow(overrides: Partial<RecipientRow> = {}): RecipientRow {
  return {
    id: 1,
    email: "alerts@example.com",
    is_active: true,
    starts_on: new Date("2026-08-10T00:00:00.000Z"),
    created_by_user_id: 7,
    updated_by_user_id: 7,
    created_at: new Date("2026-08-09T10:00:00.000Z"),
    updated_at: new Date("2026-08-09T10:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  mocks.transaction.mockReset();
  mocks.transactionClient.$executeRaw.mockReset();
  mocks.recipient.findMany.mockReset();
  mocks.recipient.count.mockReset();
  mocks.recipient.create.mockReset();
  mocks.recipient.findUnique.mockReset();
  mocks.recipient.update.mockReset();

  mocks.transaction.mockImplementation(
    async (work: (client: typeof mocks.transactionClient) => unknown) =>
      work(mocks.transactionClient),
  );
  mocks.transactionClient.$executeRaw.mockResolvedValue(1);
  mocks.recipient.count.mockResolvedValue(0);
});

describe("ESG event digest recipient data service", () => {
  it("normalizes valid email addresses and rejects malformed input", () => {
    expect(normalizeEsgEventDigestRecipientEmail("  Alerts@Example.COM "))
      .toBe("alerts@example.com");
    expect(() => normalizeEsgEventDigestRecipientEmail("not-an-email"))
      .toThrow("Enter a valid email address");
    expect(() => normalizeEsgEventDigestRecipientEmail(42))
      .toThrow("Enter a valid email address");
    expect(() => normalizeEsgEventDigestRecipientEmail(`${"a".repeat(250)}@x.test`))
      .toThrow("Enter a valid email address");
  });

  it("maps the recipient register to stable DTO values", async () => {
    mocks.recipient.findMany.mockResolvedValue([recipientRow()]);

    await expect(listEsgEventDigestRecipients()).resolves.toEqual([{
      id: 1,
      email: "alerts@example.com",
      isActive: true,
      startsOn: "2026-08-10",
      createdAt: "2026-08-09T10:00:00.000Z",
      updatedAt: "2026-08-09T10:00:00.000Z",
    }]);
    expect(mocks.recipient.findMany).toHaveBeenCalledWith({
      orderBy: [{ is_active: "desc" }, { email: "asc" }],
    });
  });

  it("selects only active recipients eligible for the requested edition", async () => {
    mocks.recipient.findMany.mockResolvedValue([
      { email: "a@example.com" },
      { email: "b@example.com" },
    ]);

    await expect(listEligibleEsgEventDigestRecipientEmails("2026-08-10"))
      .resolves.toEqual(["a@example.com", "b@example.com"]);
    expect(mocks.recipient.findMany).toHaveBeenCalledWith({
      where: {
        is_active: true,
        starts_on: { lte: new Date("2026-08-10T00:00:00.000Z") },
      },
      orderBy: { email: "asc" },
      select: { email: true },
    });
  });

  it("creates a normalized recipient for the current edition before Monday send time", async () => {
    mocks.recipient.create.mockImplementation(async ({ data }) => recipientRow({
      email: data.email,
      starts_on: data.starts_on,
      created_by_user_id: data.created_by_user_id,
      updated_by_user_id: data.updated_by_user_id,
    }));

    const result = await createEsgEventDigestRecipient({
      email: " New.User@Example.COM ",
      adminUserId: 7,
      now: new Date("2026-08-10T04:59:59.000Z"),
    });

    expect(result).toMatchObject({
      email: "new.user@example.com",
      startsOn: "2026-08-10",
      isActive: true,
    });
    expect(mocks.transactionClient.$executeRaw).toHaveBeenCalledOnce();
    expect(mocks.recipient.create).toHaveBeenCalledWith({
      data: {
        email: "new.user@example.com",
        is_active: true,
        starts_on: new Date("2026-08-10T00:00:00.000Z"),
        created_by_user_id: 7,
        updated_by_user_id: 7,
      },
    });
  });

  it("starts a newly added recipient with the next edition after the send is due", async () => {
    mocks.recipient.create.mockImplementation(async ({ data }) => recipientRow({
      email: data.email,
      starts_on: data.starts_on,
    }));

    const result = await createEsgEventDigestRecipient({
      email: "later@example.com",
      adminUserId: 7,
      now: new Date("2026-08-12T12:00:00.000Z"),
    });

    expect(result.startsOn).toBe("2026-08-17");
  });

  it("maps database uniqueness conflicts to a recipient-specific error", async () => {
    mocks.recipient.create.mockRejectedValue({ code: "P2002" });

    await expect(createEsgEventDigestRecipient({
      email: "duplicate@example.com",
      adminUserId: 7,
    })).rejects.toBeInstanceOf(DuplicateEsgEventDigestRecipientError);
  });

  it("enforces active and total register limits while holding the advisory lock", async () => {
    mocks.recipient.count
      .mockResolvedValueOnce(ESG_EVENT_DIGEST_MAX_ACTIVE_RECIPIENTS)
      .mockResolvedValueOnce(ESG_EVENT_DIGEST_MAX_TOTAL_RECIPIENTS - 1);

    await expect(createEsgEventDigestRecipient({
      email: "full@example.com",
      adminUserId: 7,
    })).rejects.toBeInstanceOf(EsgEventDigestRecipientLimitError);
    expect(mocks.recipient.create).not.toHaveBeenCalled();

    mocks.recipient.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(ESG_EVENT_DIGEST_MAX_TOTAL_RECIPIENTS);
    await expect(createEsgEventDigestRecipient({
      email: "register-full@example.com",
      adminUserId: 7,
    })).rejects.toThrow(`recipient register limit is ${ESG_EVENT_DIGEST_MAX_TOTAL_RECIPIENTS}`);
  });

  it("rejects stale activation changes before writing", async () => {
    mocks.recipient.findUnique.mockResolvedValue(recipientRow());

    await expect(setEsgEventDigestRecipientActive({
      id: 1,
      isActive: false,
      adminUserId: 9,
      expectedUpdatedAt: "2026-08-09T11:00:00.000Z",
    })).rejects.toBeInstanceOf(StaleEsgEventDigestRecipientError);
    expect(mocks.recipient.update).not.toHaveBeenCalled();
  });

  it("does not move startsOn when an already-active recipient is saved again", async () => {
    const existing = recipientRow();
    mocks.recipient.findUnique.mockResolvedValue(existing);

    const result = await setEsgEventDigestRecipientActive({
      id: 1,
      isActive: true,
      adminUserId: 9,
      expectedUpdatedAt: existing.updated_at.toISOString(),
      now: new Date("2026-08-12T12:00:00.000Z"),
    });

    expect(result).toMatchObject({ isActive: true, startsOn: "2026-08-10" });
    expect(mocks.recipient.count).not.toHaveBeenCalled();
    expect(mocks.recipient.update).not.toHaveBeenCalled();
  });

  it("reactivates a disabled recipient from the next safe edition", async () => {
    const existing = recipientRow({ is_active: false });
    mocks.recipient.findUnique.mockResolvedValue(existing);
    mocks.recipient.count.mockResolvedValue(4);
    mocks.recipient.update.mockResolvedValue(recipientRow({
      is_active: true,
      starts_on: new Date("2026-08-17T00:00:00.000Z"),
      updated_by_user_id: 9,
    }));

    const result = await setEsgEventDigestRecipientActive({
      id: 1,
      isActive: true,
      adminUserId: 9,
      now: new Date("2026-08-12T12:00:00.000Z"),
    });

    expect(result).toMatchObject({ isActive: true, startsOn: "2026-08-17" });
    expect(mocks.recipient.count).toHaveBeenCalledWith({ where: { is_active: true } });
    expect(mocks.recipient.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        is_active: true,
        starts_on: new Date("2026-08-17T00:00:00.000Z"),
        updated_by_user_id: 9,
      },
    });
  });

  it("soft-disables recipients and records the acting administrator", async () => {
    mocks.recipient.findUnique.mockResolvedValue(recipientRow());
    mocks.recipient.update.mockResolvedValue(recipientRow({
      is_active: false,
      updated_by_user_id: 9,
    }));

    await expect(setEsgEventDigestRecipientActive({
      id: 1,
      isActive: false,
      adminUserId: 9,
    })).resolves.toMatchObject({ isActive: false });
    expect(mocks.recipient.count).not.toHaveBeenCalled();
    expect(mocks.recipient.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { is_active: false, updated_by_user_id: 9 },
    });
  });

  it("returns null for a missing recipient and rejects malformed mutation identifiers", async () => {
    mocks.recipient.findUnique.mockResolvedValue(null);
    await expect(setEsgEventDigestRecipientActive({
      id: 99,
      isActive: false,
      adminUserId: 9,
    })).resolves.toBeNull();

    await expect(setEsgEventDigestRecipientActive({
      id: 0,
      isActive: false,
      adminUserId: 9,
    })).rejects.toThrow("positive integer");
    await expect(setEsgEventDigestRecipientActive({
      id: 1,
      isActive: false,
      adminUserId: 9,
      expectedUpdatedAt: "not-a-timestamp",
    })).rejects.toThrow("valid timestamp");
  });
});
