import { esgPrisma } from "@esgcredit/db-esg";
import { creditPrisma } from "@esgcredit/db-credit";

export type Domain = "esg" | "credit";

export function getPrisma(domain: Domain) {
  return domain === "esg" ? esgPrisma : creditPrisma;
}