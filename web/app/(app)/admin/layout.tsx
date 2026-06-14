import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Server-side gate: only admins reach the admin section. Client gating in the
// sidebar hides the link, but this is the real enforcement.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "admin") redirect("/dashboard");
  return <>{children}</>;
}
