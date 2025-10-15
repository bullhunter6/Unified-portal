import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";

export default async function Root() {
  const session = await getServerSession(authOptions);
  const team = (session as any)?.team || "esg";
  redirect(`/${team}`);
}