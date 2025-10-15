import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import ProfileLayout from "@/components/profile/ProfileLayout";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/signin");
  }

  return <ProfileLayout session={session} />;
}