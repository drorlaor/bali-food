"use client";

import { useEffect, useState, useCallback } from "react";
import {
  MessagesSquare,
  ChevronLeft,
  Wrench,
  AlertTriangle,
  RefreshCw,
  Trash2,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { Markdown } from "@/components/chat/Bits";
import { CATEGORY_LABELS, parseJson, type MemoryUpdate } from "@/lib/types";
import { api, ChildPicker, fmtDate, Spinner, type AdminUser } from "./ui";

type SessionRow = { id: string; title: string; createdAt: string | null; updatedAt: string | null; messageCount: number };
type Message = { id: string; role: "user" | "assistant"; content: string; toolCallsJson: string | null; createdAt: string | null };

interface AiErrorLogRow {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  sessionId: string | null;
  modelName: string;
  errorCode: string | null;
  errorMessage: string;
  promptSummary: string | null;
  createdAt: string | null;
}

export default function AuditTab({ users }: { users: AdminUser[] }) {
  const [subTab, setSubTab] = useState<"sessions" | "errors">("sessions");

  // Sessions state
  const kids = users.filter((u) => u.role === "child");
  const [childId, setChildId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);

  // Errors state
  const [errorLogs, setErrorLogs] = useState<AiErrorLogRow[] | null>(null);
  const [loadingErrors, setLoadingErrors] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadErrorLogs = useCallback(async () => {
    setLoadingErrors(true);
    try {
      const data = await api<{ logs: AiErrorLogRow[] }>("/api/admin/errors");
      setErrorLogs(data.logs || []);
    } catch {
      setErrorLogs([]);
    } finally {
      setLoadingErrors(false);
    }
  }, []);

  useEffect(() => {
    loadErrorLogs();
  }, [loadErrorLogs]);

  useEffect(() => {
    if (!childId && kids.length) setChildId(kids[0].id);
  }, [kids, childId]);

  useEffect(() => {
    if (!childId) return;
    setSessions(null);
    setActive(null);
    api<{ sessions: SessionRow[] }>(`/api/admin/sessions?userId=${childId}`)
      .then((d) => setSessions(d.sessions))
      .catch(() => setSessions([]));
  }, [childId]);

  useEffect(() => {
    if (!active) return;
    setMessages(null);
    api<{ messages: Message[] }>(`/api/admin/sessions?sessionId=${active}`)
      .then((d) => setMessages(d.messages))
      .catch(() => setMessages([]));
  }, [active]);

  async function handleClearErrors() {
    if (!confirm("האם למחוק את כל רשומות השגיאות ביומן?")) return;
    setClearing(true);
    try {
      await api("/api/admin/errors", { method: "DELETE" });
      setErrorLogs([]);
    } catch {
      alert("שגיאה במחיקת יומן השגיאות");
    } finally {
      setClearing(false);
    }
  }

  const errorCount = errorLogs?.length ?? 0;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Subtab navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            id="subtab-sessions"
            onClick={() => setSubTab("sessions")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
              subTab === "sessions"
                ? "bg-stone-900 text-white shadow-sm"
                : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
            }`}
          >
            <MessagesSquare size={16} />
            שיחות ילדים
          </button>
          <button
            id="subtab-errors"
            onClick={() => {
              setSubTab("errors");
              loadErrorLogs();
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
              subTab === "errors"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
            }`}
          >
            <AlertTriangle size={16} />
            יומן שגיאות והתראות AI
            {errorCount > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-black ${
                  subTab === "errors" ? "bg-white text-rose-600" : "bg-rose-500 text-white"
                }`}
              >
                {errorCount}
              </span>
            )}
          </button>
        </div>

        {subTab === "errors" && (
          <div className="flex items-center gap-2">
            <button
              onClick={loadErrorLogs}
              disabled={loadingErrors}
              className="btn-ghost flex items-center gap-1.5 text-xs"
              title="רענון יומן"
            >
              <RefreshCw size={14} className={loadingErrors ? "animate-spin" : ""} />
              רענון
            </button>
            {errorCount > 0 && (
              <button
                onClick={handleClearErrors}
                disabled={clearing}
                className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <Trash2 size={14} />
                ניקוי יומן שגיאות
              </button>
            )}
          </div>
        )}
      </div>

      {/* SESSIONS SUBTAB */}
      {subTab === "sessions" && (
        <div className="space-y-5">
          <ChildPicker users={users} value={childId} onChange={setChildId} />
          <div className="grid gap-5 lg:grid-cols-3">
            <section className={`card lg:col-span-1 ${active ? "hidden lg:block" : ""}`}>
              <h2 className="mb-3 flex items-center gap-2 font-bold">
                <MessagesSquare size={18} className="text-mango-500" /> שיחות
              </h2>
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
                      className={`w-full rounded-xl px-3 py-2 text-right transition ${
                        active === s.id
                          ? "bg-mango-50 ring-1 ring-mango-300"
                          : "bg-white/70 ring-1 ring-stone-100 hover:ring-mango-200"
                      }`}
                    >
                      <div className="truncate font-medium">{s.title}</div>
                      <div className="text-xs text-stone-400">
                        {fmtDate(s.updatedAt)} - {s.messageCount} הודעות
                      </div>
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
                  <button onClick={() => setActive(null)} className="btn-ghost lg:hidden">
                    <ChevronLeft size={16} className="rotate-180" /> חזרה לרשימה
                  </button>
                  {messages.map((m) => {
                    const tools = parseJson<MemoryUpdate[]>(m.toolCallsJson, []);
                    return (
                      <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-start" : "items-end"}`}>
                        <div
                          className={`max-w-[90%] rounded-2xl px-4 py-2 ${
                            m.role === "user" ? "bg-mango-100 text-stone-800" : "bg-white ring-1 ring-stone-100"
                          }`}
                        >
                          {m.role === "user" ? (
                            <div className="whitespace-pre-wrap text-[15px]">{m.content}</div>
                          ) : (
                            <Markdown>{m.content}</Markdown>
                          )}
                        </div>
                        <span className="mt-0.5 text-[10px] text-stone-400">{fmtDate(m.createdAt)}</span>
                        {tools.length > 0 && (
                          <div className="mt-1 w-full max-w-[90%] space-y-1">
                            {tools.map((t, i) => (
                              <div
                                key={i}
                                dir="ltr"
                                className={`flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-1.5 font-mono text-[11px] ${
                                  t.success
                                    ? "bg-violet-50 text-violet-800 ring-1 ring-violet-200"
                                    : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                                }`}
                              >
                                <Wrench size={12} />
                                <b>{t.action}</b>
                                {t.category && <span>category={t.category}</span>}
                                {t.nutritionalGroup && <span>group={t.nutritionalGroup}</span>}
                                {t.itemOrFact && <span dir="rtl">&quot;{t.itemOrFact}&quot;</span>}
                                {t.notes && <span dir="rtl">({t.notes})</span>}
                                <span className="opacity-60">factId={t.factId || "-"}</span>
                                {!t.success && <span>error: {t.error}</span>}
                                {t.category && (
                                  <span dir="rtl" className="font-sans opacity-70">
                                    [{CATEGORY_LABELS[t.category]}]
                                  </span>
                                )}
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
      )}

      {/* ERRORS & QUOTA SUBTAB */}
      {subTab === "errors" && (
        <div className="space-y-4">
          {/* Quota & Billing guidance alert */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-amber-950 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
              <div className="space-y-2 text-sm leading-relaxed">
                <h3 className="font-bold text-amber-900">
                  מדריך להסרת מגבלת ה-20 בקשות ביום של Google AI Studio (שגיאת 429 Quota Exceeded)
                </h3>
                <p>
                  חשבון חינמי של Google AI Studio מוגבל ל-<strong>20 בקשות ביום</strong> בלבד במודלים הניסיוניים.
                  כשעוברים את ה-20, גוגל חוסמת בקשות ל-12 שעות.
                </p>
                <div className="rounded-xl bg-white/80 p-3 ring-1 ring-amber-200/80">
                  <p className="font-semibold text-stone-900">איך פותרים את זה לתמיד ב-2 דקות?</p>
                  <ol className="mt-1 list-decimal space-y-1 pr-5 text-xs text-stone-700">
                    <li>
                      היכנסו ל-
                      <a
                        href="https://console.cloud.google.com/billing"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 font-bold text-amber-700 underline mx-1"
                      >
                        Google Cloud Console Billing <ExternalLink size={11} />
                      </a>
                    </li>
                    <li>
                      בחרו את הפרויקט שלכם (למשל <code className="bg-stone-100 px-1 py-0.5 rounded font-mono">coral-bucksaw-442815-n4</code>) וחברו אליו כרטיס אשראי לחשבון Pay-As-You-Go.
                    </li>
                    <li>
                      המכסה תזנק מיידית מ-<strong>20 בקשות ביום</strong> ל-<strong>1,000+ בקשות בדקה</strong>!
                    </li>
                    <li className="font-bold text-emerald-800">
                      עלות: עבור שימוש משפחתי של ילדים, העלות היא אגורות בודדות בחודש (סנטים בודדים).
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Error log list */}
          <section className="card space-y-3">
            <h2 className="flex items-center gap-2 font-bold text-stone-900">
              <AlertTriangle size={18} className="text-rose-500" />
              רשימת תקלות שנרשמו בשיחות
            </h2>

            {loadingErrors && !errorLogs ? (
              <Spinner />
            ) : !errorLogs || errorLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-stone-400">
                <CheckCircle2 size={40} className="mb-2 text-emerald-500" />
                <p className="font-bold text-stone-700">אין תקלות מתועדות</p>
                <p className="text-xs text-stone-400">כל קריאות ה-AI האחרונות עברו בהצלחה!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {errorLogs.map((log) => {
                  const isQuota =
                    log.errorCode?.includes("429") ||
                    log.errorCode?.includes("QUOTA") ||
                    log.errorMessage.includes("Quota") ||
                    log.errorMessage.includes("429");

                  return (
                    <div
                      key={log.id}
                      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-2.5 transition hover:border-rose-200"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold font-mono ${
                              isQuota
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {log.errorCode || "ERROR"}
                          </span>
                          <span className="rounded-lg bg-stone-100 px-2 py-0.5 text-xs font-mono font-medium text-stone-600">
                            {log.modelName}
                          </span>
                          <span className="text-xs font-bold text-stone-800">
                            משתמש: {log.userName || log.userEmail || "אנונימי"}
                          </span>
                        </div>
                        <span className="text-xs text-stone-400">{fmtDate(log.createdAt)}</span>
                      </div>

                      {log.promptSummary && (
                        <div className="rounded-xl bg-stone-50 p-2.5 text-xs text-stone-700">
                          <span className="font-bold text-stone-500 ml-1">הודעת המשתמש:</span>
                          <span className="italic">“{log.promptSummary}”</span>
                        </div>
                      )}

                      <details className="text-xs text-stone-600">
                        <summary className="cursor-pointer font-semibold text-rose-600 hover:underline">
                          פירוט השגיאה הטכנית
                        </summary>
                        <pre
                          dir="ltr"
                          className="mt-2 max-h-48 overflow-auto rounded-xl bg-stone-900 p-3 font-mono text-[11px] text-rose-300 whitespace-pre-wrap break-all"
                        >
                          {log.errorMessage}
                        </pre>
                      </details>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
