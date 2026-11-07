import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { DEFAULT_PARENT_QUICK_PROMPTS, loadConfig } from "@/lib/prompt";
import ChatApp from "@/components/chat/ChatApp";

export const dynamic = "force-dynamic";

export const metadata = { title: "בא לי - צ'אט" };

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const config = await loadConfig();
  const prompts = user.role === "parent" ? DEFAULT_PARENT_QUICK_PROMPTS : config.quickPrompts;
  return (
    <ChatApp
      user={{ displayName: user.displayName, role: user.role, avatarUrl: user.avatarUrl }}
      quickPrompts={prompts}
    />
  );
}
