import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { loadConfig } from "@/lib/prompt";
import ChatApp from "@/components/chat/ChatApp";

export const dynamic = "force-dynamic";

export const metadata = { title: "בא לי - צ'אט" };

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const config = await loadConfig();
  return (
    <ChatApp
      user={{ displayName: user.displayName, role: user.role, avatarUrl: user.avatarUrl }}
      quickPrompts={config.quickPrompts}
    />
  );
}
