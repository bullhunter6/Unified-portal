const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;
const MAX_JITTER_MS = 250;

export interface TransientPollState {
  consecutiveFailures: number;
  retryAt: number;
  unavailable: boolean;
}

export type TransientPollResult<T> =
  | { status: "skipped" }
  | { status: "success"; value: T; recovered: boolean }
  | {
      status: "unavailable";
      error: unknown;
      firstFailure: boolean;
      retryDelayMs: number;
    };

interface TransientPollOptions {
  retryTransientErrors?: boolean;
  now?: () => number;
  random?: () => number;
}

export function createTransientPollState(): TransientPollState {
  return {
    consecutiveFailures: 0,
    retryAt: 0,
    unavailable: false,
  };
}

export async function pollWithTransientBackoff<T>(
  state: TransientPollState,
  operation: () => Promise<T>,
  isTransientError: (error: unknown) => boolean,
  options: TransientPollOptions = {},
): Promise<TransientPollResult<T>> {
  const now = options.now ?? Date.now;
  if (state.retryAt > now()) return { status: "skipped" };

  try {
    const value = await operation();
    const recovered = state.unavailable;
    state.consecutiveFailures = 0;
    state.retryAt = 0;
    state.unavailable = false;
    return { status: "success", value, recovered };
  } catch (error) {
    if (options.retryTransientErrors === false || !isTransientError(error)) {
      throw error;
    }

    const firstFailure = !state.unavailable;
    state.consecutiveFailures += 1;
    const exponentialDelay = Math.min(
      MAX_RETRY_DELAY_MS,
      BASE_RETRY_DELAY_MS * 2 ** Math.min(state.consecutiveFailures - 1, 10),
    );
    const availableJitter = Math.min(
      MAX_JITTER_MS,
      MAX_RETRY_DELAY_MS - exponentialDelay,
    );
    const random = options.random ?? Math.random;
    const randomUnit = Math.max(0, Math.min(random(), 0.999_999));
    const retryDelayMs = exponentialDelay + Math.floor(randomUnit * (availableJitter + 1));

    state.retryAt = now() + retryDelayMs;
    state.unavailable = true;
    return {
      status: "unavailable",
      error,
      firstFailure,
      retryDelayMs,
    };
  }
}
