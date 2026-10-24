"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpenText, Baby, ScrollText, Users, MessageCircle, LogOut } from "lucide-react";
import ConfigTab from "./ConfigTab";
import ChildrenTab from "./ChildrenTab";
import AuditTab from "./AuditTab";
import UsersTab from "./UsersTab";
import { ToastView, useToast, useUsers } from "./ui";

const TABS = [
  { key: "config", label: "חוקת התזונה והמזווה", short: "חוקה ומזווה", icon: BookOpenText },
  { key: "children", label: "פרופילי ילדים וזיכרון", short: "ילדים", icon: Baby },
  { key: "audit", label: "יומן שיחות ובקרה", short: "יומן", icon: ScrollText },
  { key: "users", label: "ניהול משתמשים", short: "משתמשים", icon: Users },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AdminApp({ me }: { me: { id: string; displayName: string; email: string } }) {
  const [tab, setTab] = useState<TabKey>("config");
  const { users, reload } = useUsers();
  const { toast, show } = useToast();

  return (
    <div className="min-h-dvh pb-24 md:pb-8">
      <header className="glass sticky top-0 z-30 border-b border-white/60">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl brand-gradient shadow-md shadow-mango-500/30">
            <img src="/icon.svg" alt="" className="h-9 w-9" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-extrabold leading-tight">
              <span className="brand-text">בא לי</span> - לוח בקרה להורים
            </h1>
            <p className="text-xs text-stone-500">{me.displayName} - {me.email}</p>
          </div>
          <Link id="goto-chat-link" href="/chat" className="btn-ghost">
            <MessageCircle size={16} /> <span className="hidden sm:inline">לצ'אט</span>
          </Link>
          <a id="admin-signout" href="/api/auth/signout" className="btn-ghost px-2.5" title="התנתקות">
            <LogOut size={16} />
          </a>
        </div>
        <nav className="mx-auto hidden max-w-6xl gap-1 px-4 md:flex">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                id={`tab-${t.key}`}
                onClick={() => setTab(t.key)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition ${active ? "text-mango-600" : "text-stone-500 hover:text-stone-800"}`}
              >
                <Icon size={16} /> {t.label}
                {active && <span className="absolute inset-x-3 -bottom-px h-[3px] rounded-full brand-gradient" />}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div key={tab} className="animate-fade-up">
          {tab === "config" && <ConfigTab toast={show} />}
          {tab === "children" && <ChildrenTab users={users} toast={show} />}
          {tab === "audit" && <AuditTab users={users} />}
          {tab === "users" && <UsersTab users={users} reload={reload} meId={me.id} toast={show} />}
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="glass fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-white/60 pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              id={`mtab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${active ? "text-mango-600" : "text-stone-500"}`}
            >
              <Icon size={20} /> {t.short}
            </button>
          );
        })}
      </nav>
      <ToastView toast={toast} />
    </div>
  );
}
