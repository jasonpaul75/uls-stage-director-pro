import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/portal");
  }
  const role = session.user.globalRole;
  if (role !== "DIRECTOR" && role !== "ULS_ADMIN") {
    redirect("/producer");
  }
  return <div className="min-h-screen bg-black text-neutral-50">{children}</div>;
}
