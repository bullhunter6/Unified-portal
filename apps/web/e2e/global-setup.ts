import bcrypt from "bcryptjs";
import type { FullConfig } from "@playwright/test";
import { esgPrisma } from "@esgcredit/db-esg";

export default async function globalSetup(_config: FullConfig) {
  const email = process.env.E2E_EMAIL ?? "e2e-user@example.test";
  const password = process.env.E2E_PASSWORD ?? "E2e-Smoke-Password!42";
  const passwordHash = await bcrypt.hash(password, 10);

  await esgPrisma.users.upsert({
    where: { email },
    update: {
      password_hash: passwordHash,
      is_active_db: true,
      is_admin: false,
      team: "esg",
    },
    create: {
      username: "e2e-smoke-user",
      email,
      password: "",
      password_hash: passwordHash,
      first_name: "E2E",
      last_name: "User",
      is_active_db: true,
      is_admin: false,
      team: "esg",
    },
  });

  return async () => {
    await esgPrisma.users.deleteMany({ where: { email } });
    await esgPrisma.$disconnect();
  };
}
