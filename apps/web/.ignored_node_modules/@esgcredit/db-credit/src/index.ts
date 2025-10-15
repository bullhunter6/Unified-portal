import { PrismaClient as CreditPrismaClient } from "../generated/client";

const url = process.env.CREDIT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("CREDIT_DATABASE_URL is missing");

declare global { var __creditPrisma: CreditPrismaClient | undefined; }

export const creditPrisma =
  global.__creditPrisma ??
  new CreditPrismaClient({
    log: ["warn", "error"],
    datasources: { db: { url } },
  });

if (process.env.NODE_ENV !== "production") global.__creditPrisma = creditPrisma;
