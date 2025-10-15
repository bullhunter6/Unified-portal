import Header from "@/components/header/Header";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const team = ((session as any)?.team || "esg") as "esg" | "credit";

  return (
    <>
      <Header domain={team} />
      <div className="min-h-[calc(100vh-64px)]">{children}</div>
    </>
  );
}
