import { PrismaClient as ESGPrismaClient } from "../generated/client";

const url = process.env.ESG_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("ESG_DATABASE_URL is missing");

declare global { var __esgPrisma: ESGPrismaClient | undefined; }

export const esgPrisma =
  global.__esgPrisma ??
  new ESGPrismaClient({
    log: ["warn", "error"],
    datasources: { db: { url } },
  });

if (process.env.NODE_ENV !== "production") global.__esgPrisma = esgPrisma;
