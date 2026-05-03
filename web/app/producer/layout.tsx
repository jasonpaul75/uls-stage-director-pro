import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ProducerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/producer");
  }
  const role = session.user.globalRole;
  if (role !== "PRODUCER" && role !== "ULS_ADMIN") {
    redirect("/portal");
  }
  return <div className="min-h-screen bg-zinc-950 text-zinc-50">{children}</div>;
}
