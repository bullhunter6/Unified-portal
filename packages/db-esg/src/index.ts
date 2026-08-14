import { PrismaClient as ESGPrismaClient } from "../generated/client";
import {
  isReadOnlyPrismaOperation,
  isTransientPrismaConnectivityError,
} from "./retry-policy";
export {
  isReadOnlyPrismaOperation,
  isTransientPrismaConnectivityError,
} from "./retry-policy";

const url = process.env.ESG_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("ESG_DATABASE_URL is missing");

declare global { var __esgPrisma: ESGPrismaClient | undefined; }

// --------------- retry helpers ---------------
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function withRetry(client: ESGPrismaClient) {
  return client.$extends({
    query: {
      $allOperations: async ({ args, query, operation, model }: any) => {
        if (!isReadOnlyPrismaOperation(operation)) {
          return query(args);
        }
        let lastError: unknown;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            lastError = error;
            if (attempt < MAX_RETRIES && isTransientPrismaConnectivityError(error)) {
              const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
              console.warn(
                `[esg-prisma-retry] ${model ?? "raw"}.${operation} failed ` +
                `(attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms…`,
                error instanceof Error ? error.message : error,
              );
              await sleep(delay);
            } else {
              throw error;
            }
          }
        }
        throw lastError;
      },
    },
  });
}
// --------------- end retry helpers ---------------

const baseClient =
  global.__esgPrisma ??
  new ESGPrismaClient({
    log: ["warn", "error"],
    datasources: { db: { url } },
  });

if (process.env.NODE_ENV !== "production") global.__esgPrisma = baseClient;

export const esgPrisma = withRetry(baseClient) as unknown as ESGPrismaClient;

export async function connectEsgWithRetry(): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await baseClient.$connect();
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_RETRIES || !isTransientPrismaConnectivityError(error)) throw error;
      await sleep(BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 250));
    }
  }
  throw lastError;
}
