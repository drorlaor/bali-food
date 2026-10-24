"use client";

import { useEffect, useState } from "react";
import { MessagesSquare, ChevronLeft, Wrench } from "lucide-react";
import { Markdown } from "@/components/chat/Bits";
import { CATEGORY_LABELS, parseJson, type MemoryUpdate } from "@/lib/types";
import { api, ChildPicker, fmtDate, Spinner, type AdminUser } from "./ui";

type SessionRow = { id: string; title: string; createdAt: string | null; updatedAt: string | null; messageCount: number };
type Message = { id: string; role: "user" | "assistant"; content: string; toolCallsJson: string | null; createdAt: string | null };

export default function AuditTab({ users }: { users: AdminUser[] }) {
  const kids = users.filter((u) => u.role === "child");
  const [childId, setChildId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);

  useEffect(() => {
    if (!childId && kids.length) setChildId(kids[0].id);
  }, [kids, childId]);

  useEffect(() => {
    if (!childId) return;
    setSessions(null);
    setActive(null);
    api<{ sessions: SessionRow[] }>(`/api/admin/sessions?userId=${childId}`).then((d) => setSessions(d.sessions)).catch(() => setSessions([]));
  }, [childId]);

  useEffect(() => {
    if (!active) return;
    setMessages(null);
    api<{ messages: Message[] }>(`/api/admin/sessions?sessionId=${active}`).then((d) => setMessages(d.messages)).catch(() => setMessages([]));
  }, [active]);

  return (
    <div className="space-y-5">
      <ChildPicker users={users} value={childId} onChange={setChildId} />
      <div className="grid gap-5 lg:grid-cols-3">
        <section className={`card lg:col-span-1 ${active ? "hidden lg:block" : ""}`}>
          <h2 className="mb-3 flex items-center gap-2 font-bold"><MessagesSquare size={18} className="text-mango-500" /> שיחות</h2>
          {!sessions ? (
            <Spinner />
          ) : sessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400">אין עדיין שיחות</p>
          ) : (
            <div className="max-h-[70vh] space-y-1.5 overflow-y-auto">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  id={`session-${s.id}`}
                  onClick={() => setActive(s.id)}
                  className={`w-full rounded-xl px-3 py-2 text-right transition ${active === s.id ? "bg-mango-50 ring-1 ring-mango-300" : "bg-white/70 ring-1 ring-stone-100 hover:ring-mango-200"}`}
                >
                  <div className="truncate font-medium">{s.title}</div>
                  <div className="text-xs text-stone-400">{fmtDate(s.updatedAt)} - {s.messageCount} הודעות</div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className={`card lg:col-span-2 ${active ? "" : "hidden lg:block"}`}>
          {!active ? (
            <p className="py-16 text-center text-sm text-stone-400">בחרו שיחה כדי לצפות בתמליל המלא</p>
          ) : !messages ? (
            <Spinner />
          ) : (
            <div className="space-y-3">
              <button onClick={() => setActive(null)} className="btn-ghost lg:hidden"><ChevronLeft size={16} className="rotate-180" /> חזרה לרשימה</button>
              {messages.map((m) => {
                const tools = parseJson<MemoryUpdate[]>(m.toolCallsJson, []);
                return (
                  <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-start" : "items-end"}`}>
                    <div className={`max-w-[90%] rounded-2xl px-4 py-2 ${m.role === "user" ? "bg-mango-100 text-stone-800" : "bg-white ring-1 ring-stone-100"}`}>
                      {m.role === "user" ? <div className="whitespace-pre-wrap text-[15px]">{m.content}</div> : <Markdown>{m.content}</Markdown>}
                    </div>
                    <span className="mt-0.5 text-[10px] text-stone-400">{fmtDate(m.createdAt)}</span>
                    {tools.length > 0 && (
                      <div className="mt-1 w-full max-w-[90%] space-y-1">
                        {tools.map((t, i) => (
                          <div key={i} dir="ltr" className={`flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5 font-mono text-[11px] ${t.success ? "bg-violet-50 text-violet-800 ring-1 ring-violet-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}>
                            <Wrench size={12} />
                            <b>{t.action}</b>
                            {t.category && <span>category={t.category}</span>}
                            {t.nutritionalGroup && <span>group={t.nutritionalGroup}</span>}
                            {t.itemOrFact && <span dir="rtl">&quot;{t.itemOrFact}&quot;</span>}
                            {t.notes && <span dir="rtl">({t.notes})</span>}
                            <span className="opacity-60">factId={t.factId || "-"}</span>
                            {!t.success && <span>error: {t.error}</span>}
                            {t.category && <span dir="rtl" className="font-sans opacity-70">[{CATEGORY_LABELS[t.category]}]</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
