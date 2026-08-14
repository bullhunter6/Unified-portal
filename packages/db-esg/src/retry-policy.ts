const READ_ONLY_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "aggregate",
  "count",
  "groupBy",
]);

const TRANSIENT_CONNECTIVITY_CODES = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1017",
]);

const TRANSIENT_CONNECTIVITY_MESSAGES = [
  "can't reach database server",
  "connection refused",
  "connection reset",
  "connection timed out",
  "server has closed the connection",
  "econnrefused",
  "econnreset",
  "etimedout",
];

export function isReadOnlyPrismaOperation(operation: string): boolean {
  return READ_ONLY_OPERATIONS.has(operation);
}

/**
 * Identifies failures for which a long-running worker may safely pause and
 * start a fresh polling cycle. This does not make an individual raw query safe
 * to replay; raw SQL and writes remain excluded by isReadOnlyPrismaOperation.
 */
export function isTransientPrismaConnectivityError(error: unknown): boolean {
  if (!error || (typeof error !== "object" && typeof error !== "function")) {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    errorCode?: unknown;
    message?: unknown;
  };
  const code = typeof candidate.code === "string"
    ? candidate.code
    : typeof candidate.errorCode === "string"
      ? candidate.errorCode
      : undefined;

  if (code && TRANSIENT_CONNECTIVITY_CODES.has(code)) return true;

  if (typeof candidate.message !== "string") return false;
  const message = candidate.message.toLowerCase();
  return TRANSIENT_CONNECTIVITY_MESSAGES.some((fragment) => message.includes(fragment));
}
