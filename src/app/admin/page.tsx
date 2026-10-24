import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import AdminApp from "@/components/admin/AdminApp";

export const dynamic = "force-dynamic";

export const metadata = { title: "בא לי - ניהול הורים" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "parent") redirect("/chat");
  return <AdminApp me={{ id: user.id, displayName: user.displayName, email: user.email }} />;
}
