"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Send,
  Plus,
  UserRound,
  ShieldCheck,
  X,
  Heart,
  ThumbsDown,
  Star,
  ShoppingBasket,
  Lightbulb,
  LogOut,
  History,
  MessageSquare,
  Trash2,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { Markdown, MemoryBadges } from "./Bits";
import { GROUP_LABELS, type MemoryUpdate } from "@/lib/types";

type Msg = { id: string; role: "user" | "assistant"; content: string; memoryUpdates?: MemoryUpdate[]; error?: boolean };
type Fact = { id: string; category: string; nutritionalGroup: string; itemOrFact: string; notes: string | null };
type SessionItem = { id: string; title: string; createdAt: string | null; updatedAt: string | null; messageCount: number };

interface Props {
  user: { displayName: string; role: string; avatarUrl: string | null };
  quickPrompts: string[];
}

// Minimal typing for the Web Speech API.
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

function greetingByTime() {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date()));
  if (h < 11) return "בוקר טוב";
  if (h < 16) return "צהריים טובים";
  if (h < 19) return "אחר צהריים טובים";
  return "ערב טוב";
}

function formatSessionDate(iso: string | null) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("he-IL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export default function ChatApp({ user, quickPrompts }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const [greeting, setGreeting] = useState("שלום");
  const recRef = useRef<SpeechRec | null>(null);
  const baseTextRef = useRef("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.sessions)) setSessions(data.sessions);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setGreeting(greetingByTime());
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setSpeechOk(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || loading) return;
      recRef.current?.stop();
      setInput("");
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: msg }]);
      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: msg }),
        });
        const raw = await res.text();
        let data: { sessionId?: string; messageId?: string; reply?: string; memoryUpdates?: MemoryUpdate[]; error?: string } = {};
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error(res.status === 504 ? "הבקשה ארכה זמן רב מדי (timeout)" : raw.slice(0, 120));
        }
        if (!res.ok) throw new Error(data.error || `שגיאה (${res.status})`);
        setSessionId(data.sessionId || null);
        setMessages((m) => [...m, { id: data.messageId || crypto.randomUUID(), role: "assistant", content: data.reply || "", memoryUpdates: data.memoryUpdates }]);
        fetchSessions();
      } catch (e) {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "אוי, משהו השתבש בחיבור. נסה/י לשלוח שוב בעוד רגע." + (e instanceof Error && e.message ? `\n\n_(${e.message})_` : ""),
            error: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, sessionId, fetchSessions]
  );

  async function loadSession(id: string) {
    setHistoryOpen(false);
    setLoadingSession(true);
    try {
      const res = await fetch(`/api/chat?sessionId=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = await res.json();
      setSessionId(id);
      setMessages(data.messages || []);
    } catch {
      // ignore
    } finally {
      setLoadingSession(false);
    }
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/api/chat?sessionId=${encodeURIComponent(id)}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (sessionId === id) {
        newChat();
      }
    } catch {
      // ignore
    }
  }

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "he-IL";
    rec.interimResults = true;
    rec.continuous = false;
    baseTextRef.current = input ? input.trim() + " " : "";
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput(baseTextRef.current + t);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  function newChat() {
    setMessages([]);
    setSessionId(null);
    setInput("");
  }

  const empty = messages.length === 0 && !loadingSession;
  const isParent = user.role === "parent";

  return (
    <div className="flex h-dvh flex-col">
      {/* Top bar */}
      <header className="glass sticky top-0 z-30 border-b border-white/60 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl brand-gradient shadow-md shadow-mango-500/30">
            <img src="/icon.svg" alt="" className="h-9 w-9" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold leading-tight brand-text">בא לי</span>
              {isParent && (
                <span className="rounded-full bg-mango-100 px-2 py-0.5 text-[11px] font-bold text-mango-800 ring-1 ring-mango-300">
                  מצב הורים
                </span>
              )}
            </div>
            <div className="truncate text-xs text-stone-500">היי {user.displayName}!</div>
          </div>
          <button id="new-chat-btn" onClick={newChat} className="btn-ghost px-2.5" title="שיחה חדשה">
            <Plus size={18} /> <span className="hidden sm:inline">שיחה חדשה</span>
          </button>
          <button
            id="history-btn"
            onClick={() => {
              fetchSessions();
              setHistoryOpen(true);
            }}
            className="btn-ghost px-2.5"
            title="שיחות קודמות"
          >
            <History size={18} /> <span className="hidden sm:inline">שיחות קודמות</span>
          </button>
          {!isParent && (
            <button id="my-profile-btn" onClick={() => setDrawer(true)} className="btn-ghost px-2.5" title="הפרופיל שלי">
              <UserRound size={18} /> <span className="hidden sm:inline">הפרופיל שלי</span>
            </button>
          )}
          {isParent && (
            <>
              <button
                id="shopping-list-btn"
                onClick={() => setShoppingOpen(true)}
                className="btn-ghost px-2.5"
                title="רשימת קניות מומלצת"
              >
                <ShoppingBasket size={18} className="text-leaf-600" /> <span className="hidden sm:inline">רשימת קניות</span>
              </button>
              <Link id="admin-link" href="/admin" className="btn-ghost px-2.5" title="לוח בקרה להורים">
                <ShieldCheck size={18} /> <span className="hidden sm:inline">לוח הורים</span>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-3">
        <div className="mx-auto max-w-2xl py-4">
          {loadingSession ? (
            <div className="flex flex-col items-center justify-center py-20 text-stone-400">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-mango-200 border-t-mango-500" />
              <p className="mt-3 text-sm">טוען שיחה...</p>
            </div>
          ) : empty ? (
            <div className="flex flex-col items-center pt-6 text-center animate-fade-up">
              <div className="mb-4 flex h-24 w-24 animate-float items-center justify-center rounded-[30px] brand-gradient shadow-xl shadow-berry-500/30">
                <img src="/icon.svg" alt="" className="h-20 w-20" />
              </div>
              <h1 className="text-2xl font-extrabold">
                {greeting}, <span className="brand-text">{user.displayName}</span>!
              </h1>
              <p className="mt-1 max-w-md text-stone-600">
                {isParent
                  ? "אני מכיר את ההעדפות והרצונות של כל הילדים במשפחה. נתכנן יחד כריכים למחר, ארוחות או רשימת קניות?"
                  : "מה בא לך היום? ספר/י לי ונרכיב משהו טעים ומשביע"}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {quickPrompts.map((q, i) => (
                  <button
                    key={q}
                    id={`quick-prompt-${i}`}
                    onClick={() => send(q)}
                    style={{ animationDelay: `${i * 60}ms` }}
                    className="animate-pop rounded-full border border-mango-200 bg-white/90 px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:border-mango-400 hover:bg-mango-50 hover:shadow-md active:scale-95"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {sessions.length > 0 && (
                <div className="mt-8 w-full max-w-md text-right">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-stone-500">
                      <History size={14} className="text-mango-500" /> המשך שיחה אחרונה
                    </span>
                    {sessions.length > 3 && (
                      <button
                        onClick={() => setHistoryOpen(true)}
                        className="text-xs font-semibold text-mango-600 hover:underline"
                      >
                        לכל השיחות ({sessions.length})
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {sessions.slice(0, 3).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => loadSession(s.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-stone-200/80 bg-white/80 px-4 py-2.5 text-right shadow-sm transition hover:border-mango-300 hover:bg-white"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <MessageSquare size={16} className="shrink-0 text-mango-500" />
                          <span className="truncate text-sm font-medium text-stone-800">{s.title}</span>
                        </div>
                        <span className="shrink-0 text-[11px] text-stone-400">{formatSessionDate(s.updatedAt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-start animate-pop">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-tr-md brand-gradient px-4 py-2.5 text-[15px] text-white shadow-md shadow-mango-500/20">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex flex-col items-end animate-pop">
                    <div
                      className={`max-w-[90%] rounded-3xl rounded-tl-md px-4 py-2.5 shadow-sm ${
                        m.error ? "border border-rose-200 bg-rose-50 text-rose-800" : "glass"
                      }`}
                    >
                      <Markdown>{m.content}</Markdown>
                    </div>
                    {m.memoryUpdates && <MemoryBadges updates={m.memoryUpdates} />}
                  </div>
                )
              )}
              {loading && (
                <div className="flex justify-end">
                  <div className="glass flex gap-1 rounded-3xl rounded-tl-md px-4 py-3.5">
                    <span className="typing-dot h-2 w-2 rounded-full bg-mango-500" />
                    <span className="typing-dot h-2 w-2 rounded-full bg-mango-500" />
                    <span className="typing-dot h-2 w-2 rounded-full bg-berry-500" />
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="glass border-t border-white/60 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <form
          className="mx-auto flex max-w-2xl items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          {speechOk && (
            <button
              id="mic-btn"
              type="button"
              onClick={toggleMic}
              title={listening ? "עצור הקלטה" : "דבר/י אליי"}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition ${
                listening ? "animate-pulse bg-rose-500 text-white shadow-lg shadow-rose-500/40" : "border border-stone-200 bg-white text-stone-600 hover:border-mango-300"
              }`}
            >
              {listening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}
          <textarea
            id="chat-input"
            ref={taRef}
            dir="rtl"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={
              listening
                ? "מקשיב..."
                : isParent
                  ? "שאל/י על כריכים לילדים, רעיונות לארוחה או רשימת קניות..."
                  : "מה בא לך לאכול?"
            }
            className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl border border-stone-200 bg-white px-4 py-3 text-[15px] outline-none transition focus:border-mango-400 focus:ring-4 focus:ring-mango-200/60"
          />
          <button
            id="send-btn"
            type="submit"
            disabled={!input.trim() || loading}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl brand-gradient text-white shadow-lg shadow-mango-500/30 transition active:scale-95 disabled:opacity-40"
            title="שלח"
          >
            <Send size={20} className="-scale-x-100" />
          </button>
        </form>
      </footer>

      <ProfileDrawer open={drawer} onClose={() => setDrawer(false)} name={user.displayName} />
      {isParent && <ShoppingListDrawer open={shoppingOpen} onClose={() => setShoppingOpen(false)} />}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        sessions={sessions}
        activeId={sessionId}
        onSelect={loadSession}
        onDelete={deleteSession}
        onNewChat={() => {
          setHistoryOpen(false);
          newChat();
        }}
      />
    </div>
  );
}

interface ShoppingItemRow {
  id: string;
  childId: string;
  childName: string;
  item: string;
  notes: string | null;
  groupLabel: string;
}

function ShoppingListDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [wishlist, setWishlist] = useState<ShoppingItemRow[] | null>(null);
  const [liked, setLiked] = useState<ShoppingItemRow[] | null>(null);
  const [recommendation, setRecommendation] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/shopping-list")
      .then((r) => r.json())
      .then((d) => {
        setWishlist(d.wishlist || []);
        setLiked(d.liked || []);
      })
      .catch(() => {
        setWishlist([]);
        setLiked([]);
      });
  }, [open]);

  async function generateAiList() {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/shopping-list", { method: "POST" });
      const data = await res.json();
      if (data.recommendation) setRecommendation(data.recommendation);
    } catch {
      setRecommendation("שגיאה ביצירת ההמלצה, נסו שוב.");
    } finally {
      setGenerating(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-stone-900/30 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        className={`absolute inset-y-0 right-0 flex w-[92%] max-w-md flex-col bg-[#fffaf4] shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="brand-gradient flex items-center justify-between px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
          <div>
            <div className="text-xs opacity-80">מותאם לבקשות והעדפות הילדים</div>
            <div className="text-2xl font-extrabold">רשימת קניות חכמה</div>
          </div>
          <button id="close-shopping-btn" onClick={onClose} className="rounded-full bg-white/20 p-2 hover:bg-white/30">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <button
            id="generate-ai-shopping-btn"
            onClick={generateAiList}
            disabled={generating}
            className="flex w-full items-center justify-center gap-2 rounded-2xl brand-gradient py-3.5 text-sm font-bold text-white shadow-lg shadow-mango-500/25 transition active:scale-95 disabled:opacity-60"
          >
            <Sparkles size={18} className={generating ? "animate-spin" : ""} />
            {generating ? "בונה רשימת קניות מותאמת..." : "הפק המלצת קניות שבועית חכמה (AI)"}
          </button>

          {recommendation && (
            <section className="card border-2 border-mango-300 bg-white space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <h3 className="flex items-center gap-1.5 font-extrabold text-stone-800">
                  <Sparkles size={16} className="text-mango-500" /> המלצת ה-AI לקניות השבוע
                </h3>
                <button
                  onClick={() => copyToClipboard(recommendation)}
                  className="flex items-center gap-1 rounded-xl bg-mango-100 px-3 py-1.5 text-xs font-bold text-mango-800 transition hover:bg-mango-200"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "הועתק!" : "העתק לוואטסאפ"}
                </button>
              </div>
              <div className="text-sm leading-relaxed">
                <Markdown>{recommendation}</Markdown>
              </div>
            </section>
          )}

          <section className="card space-y-2.5">
            <h3 className="flex items-center gap-2 font-bold text-stone-800">
              <ShoppingBasket size={18} className="text-leaf-600" />
              דברים שהילדים ביקשו לנסות ({wishlist?.length || 0})
            </h3>
            {wishlist === null ? (
              <div className="h-16 animate-pulse rounded-2xl bg-stone-100" />
            ) : wishlist.length === 0 ? (
              <p className="text-xs text-stone-400">הילדים עוד לא ביקשו פריטים חדשים לנסות בשיחות.</p>
            ) : (
              <div className="space-y-1.5">
                {wishlist.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-stone-200/80"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-stone-800">{w.item}</span>
                      {w.notes && <span className="mr-1 text-xs text-stone-400">({w.notes})</span>}
                    </div>
                    <span className="shrink-0 rounded-full bg-leaf-50 px-2.5 py-0.5 text-xs font-bold text-leaf-700 ring-1 ring-leaf-200">
                      {w.childName}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card space-y-2.5">
            <h3 className="flex items-center gap-2 font-bold text-stone-800">
              <Heart size={18} className="text-berry-500" />
              מרכיבים וארוחות שהילדים אוהבים ({liked?.length || 0})
            </h3>
            {liked === null ? (
              <div className="h-16 animate-pulse rounded-2xl bg-stone-100" />
            ) : liked.length === 0 ? (
              <p className="text-xs text-stone-400">עוד לא נרשמו מרכיבים אהובים.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {liked.map((l) => (
                  <span
                    key={l.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-700 ring-1 ring-stone-200"
                  >
                    {l.item}
                    <strong className="text-mango-600">({l.childName})</strong>
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function HistoryDrawer({
  open,
  onClose,
  sessions,
  activeId,
  onSelect,
  onDelete,
  onNewChat,
}: {
  open: boolean;
  onClose: () => void;
  sessions: SessionItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onNewChat: () => void;
}) {
  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-stone-900/30 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        className={`absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-[#fffaf4] shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="brand-gradient flex items-center justify-between px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
          <div>
            <div className="text-xs opacity-80">היסטוריית שיחות</div>
            <div className="text-2xl font-extrabold">שיחות קודמות</div>
          </div>
          <button id="close-history-btn" onClick={onClose} className="rounded-full bg-white/20 p-2 hover:bg-white/30">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 pb-2">
          <button
            onClick={onNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-2xl brand-gradient py-3 text-sm font-bold text-white shadow-md shadow-mango-500/20 transition active:scale-95"
          >
            <Plus size={18} /> פתיחת שיחה חדשה
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4 pt-2">
          {sessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-stone-400">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
              עדיין אין שיחות שמורות.
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = s.id === activeId;
              return (
                <div
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={`group flex cursor-pointer items-center justify-between gap-2 rounded-2xl p-3 text-right transition ${
                    isActive
                      ? "bg-mango-50 ring-2 ring-mango-400"
                      : "bg-white ring-1 ring-stone-200/80 hover:ring-mango-300"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-stone-800">{s.title}</div>
                    <div className="mt-0.5 text-xs text-stone-400">
                      {formatSessionDate(s.updatedAt)} · {s.messageCount} הודעות
                    </div>
                  </div>
                  <button
                    onClick={(e) => onDelete(s.id, e)}
                    title="מחק שיחה"
                    className="rounded-xl p-2 text-stone-400 opacity-70 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}

function ProfileDrawer({ open, onClose, name }: { open: boolean; onClose: () => void; name: string }) {
  const [facts, setFacts] = useState<Fact[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setFacts(null);
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setFacts(d.facts || []))
      .catch(() => setFacts([]));
  }, [open]);

  const sections = [
    { key: "liked_ingredient", title: "דברים שאני אוהב/ת", icon: Heart, color: "text-berry-500" },
    { key: "favorite_meal", title: "הארוחות האהובות שלי", icon: Star, color: "text-mango-500" },
    { key: "wishlist_to_try", title: "רוצה לנסות / לקנות", icon: ShoppingBasket, color: "text-leaf-500" },
    { key: "disliked_ingredient", title: "פחות בא לי", icon: ThumbsDown, color: "text-stone-500" },
    { key: "habit_or_context", title: "הרגלים שלי", icon: Lightbulb, color: "text-amber-500" },
  ];

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div onClick={onClose} className={`absolute inset-0 bg-stone-900/30 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`} />
      <aside
        className={`absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-[#fffaf4] shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="brand-gradient flex items-center justify-between px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
          <div>
            <div className="text-xs opacity-80">הפרופיל שלי</div>
            <div className="text-2xl font-extrabold">{name}</div>
          </div>
          <button id="close-profile-btn" onClick={onClose} className="rounded-full bg-white/20 p-2 hover:bg-white/30">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <p className="text-sm text-stone-500">ככה "בא לי" מכיר אותך. ספר/י לו בצ'אט מה אהבת או מה לא - והוא יזכור!</p>
          {facts === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-stone-100" />
              ))}
            </div>
          ) : (
            sections.map((s) => {
              const items = facts.filter((f) => f.category === s.key);
              const Icon = s.icon;
              return (
                <section key={s.key} className="card">
                  <h3 className="mb-2 flex items-center gap-2 font-bold">
                    <Icon size={18} className={s.color} /> {s.title}
                  </h3>
                  {items.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((f) => (
                        <span key={f.id} title={f.notes || GROUP_LABELS[f.nutritionalGroup]} className="rounded-full bg-white px-3 py-1 text-sm ring-1 ring-stone-200">
                          {f.itemOrFact}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-stone-400">עוד אין כאן כלום</p>
                  )}
                </section>
              );
            })
          )}
        </div>
        <div className="border-t border-stone-200 p-4">
          <a id="signout-link" href="/api/auth/signout" className="btn-ghost w-full">
            <LogOut size={16} /> התנתקות
          </a>
        </div>
      </aside>
    </div>
  );
}
