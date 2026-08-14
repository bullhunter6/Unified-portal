import { describe, expect, it, vi } from "vitest";
import { isTransientPrismaConnectivityError } from "@esgcredit/db-esg";
import {
  createTransientPollState,
  pollWithTransientBackoff,
} from "./worker-resilience";

describe("worker database poll resilience", () => {
  it("backs off after P1001, skips early polls, and resets after recovery", async () => {
    const state = createTransientPollState();
    const p1001 = { code: "P1001", message: "Can't reach database server" };
    let now = 10_000;
    const unavailableOperation = vi.fn().mockRejectedValue(p1001);

    const unavailable = await pollWithTransientBackoff(
      state,
      unavailableOperation,
      isTransientPrismaConnectivityError,
      { now: () => now, random: () => 0 },
    );

    expect(unavailable).toMatchObject({
      status: "unavailable",
      error: p1001,
      firstFailure: true,
      retryDelayMs: 1_000,
    });
    expect(state).toEqual({
      consecutiveFailures: 1,
      retryAt: 11_000,
      unavailable: true,
    });

    now = 10_999;
    const recoveryOperation = vi.fn().mockResolvedValue(["job-1"]);
    await expect(
      pollWithTransientBackoff(
        state,
        recoveryOperation,
        isTransientPrismaConnectivityError,
        { now: () => now, random: () => 0 },
      ),
    ).resolves.toEqual({ status: "skipped" });
    expect(recoveryOperation).not.toHaveBeenCalled();

    now = 11_000;
    await expect(
      pollWithTransientBackoff(
        state,
        recoveryOperation,
        isTransientPrismaConnectivityError,
        { now: () => now, random: () => 0 },
      ),
    ).resolves.toEqual({
      status: "success",
      value: ["job-1"],
      recovered: true,
    });
    expect(state).toEqual({
      consecutiveFailures: 0,
      retryAt: 0,
      unavailable: false,
    });
  });

  it("bounds exponential retry delays at thirty seconds", async () => {
    const state = createTransientPollState();
    const error = { code: "P1001" };
    let now = 0;

    for (let attempt = 1; attempt <= 12; attempt += 1) {
      now = state.retryAt;
      const result = await pollWithTransientBackoff(
        state,
        async () => { throw error; },
        isTransientPrismaConnectivityError,
        { now: () => now, random: () => 0.999_999 },
      );
      expect(result.status).toBe("unavailable");
      if (result.status === "unavailable") {
        expect(result.retryDelayMs).toBeLessThanOrEqual(30_000);
      }
    }

    expect(state.consecutiveFailures).toBe(12);
    expect(state.retryAt - now).toBe(30_000);
  });

  it("rethrows transient failures when retry is disabled for --once mode", async () => {
    const state = createTransientPollState();
    const error = { code: "P1001" };

    await expect(
      pollWithTransientBackoff(
        state,
        async () => { throw error; },
        isTransientPrismaConnectivityError,
        { retryTransientErrors: false },
      ),
    ).rejects.toBe(error);
    expect(state).toEqual(createTransientPollState());
  });

  it("rethrows non-transient database failures", async () => {
    const state = createTransientPollState();
    const error = { code: "P2021", message: "The table does not exist" };

    await expect(
      pollWithTransientBackoff(
        state,
        async () => { throw error; },
        isTransientPrismaConnectivityError,
      ),
    ).rejects.toBe(error);
    expect(state).toEqual(createTransientPollState());
  });

  it("classifies connectivity codes and messages without hiding config errors", () => {
    expect(isTransientPrismaConnectivityError({ code: "P1001" })).toBe(true);
    expect(isTransientPrismaConnectivityError({ errorCode: "P1017" })).toBe(true);
    expect(
      isTransientPrismaConnectivityError(new Error("Connection reset by peer")),
    ).toBe(true);

    expect(isTransientPrismaConnectivityError({ code: "P1000" })).toBe(false);
    expect(isTransientPrismaConnectivityError({ code: "P2021" })).toBe(false);
    expect(
      isTransientPrismaConnectivityError(new Error("Authentication failed")),
    ).toBe(false);
  });
});
