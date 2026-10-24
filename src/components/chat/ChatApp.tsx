"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, MicOff, Send, Plus, UserRound, ShieldCheck, X, Heart, ThumbsDown, Star, ShoppingBasket, Lightbulb, LogOut } from "lucide-react";
import { Markdown, MemoryBadges } from "./Bits";
import { GROUP_LABELS, type MemoryUpdate } from "@/lib/types";

type Msg = { id: string; role: "user" | "assistant"; content: string; memoryUpdates?: MemoryUpdate[]; error?: boolean };
type Fact = { id: string; category: string; nutritionalGroup: string; itemOrFact: string; notes: string | null };

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

export default function ChatApp({ user, quickPrompts }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const [greeting, setGreeting] = useState("שלום");
  const recRef = useRef<SpeechRec | null>(null);
  const baseTextRef = useRef("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGreeting(greetingByTime());
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setSpeechOk(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

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
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "error");
        setSessionId(data.sessionId);
        setMessages((m) => [...m, { id: data.messageId, role: "assistant", content: data.reply, memoryUpdates: data.memoryUpdates }]);
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
    [loading, sessionId]
  );

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

  const empty = messages.length === 0;

  return (
    <div className="flex h-dvh flex-col">
      {/* Top bar */}
      <header className="glass sticky top-0 z-30 border-b border-white/60 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl brand-gradient shadow-md shadow-mango-500/30">
            <img src="/icon.svg" alt="" className="h-9 w-9" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-extrabold leading-tight brand-text">בא לי</div>
            <div className="truncate text-xs text-stone-500">היי {user.displayName}!</div>
          </div>
          <button id="new-chat-btn" onClick={newChat} className="btn-ghost px-2.5" title="שיחה חדשה">
            <Plus size={18} /> <span className="hidden sm:inline">שיחה חדשה</span>
          </button>
          <button id="my-profile-btn" onClick={() => setDrawer(true)} className="btn-ghost px-2.5" title="הפרופיל שלי">
            <UserRound size={18} /> <span className="hidden sm:inline">הפרופיל שלי</span>
          </button>
          {user.role === "parent" && (
            <Link id="admin-link" href="/admin" className="btn-ghost px-2.5" title="ניהול הורים">
              <ShieldCheck size={18} />
            </Link>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-3">
        <div className="mx-auto max-w-2xl py-4">
          {empty ? (
            <div className="flex flex-col items-center pt-8 text-center animate-fade-up">
              <div className="mb-4 flex h-24 w-24 animate-float items-center justify-center rounded-[30px] brand-gradient shadow-xl shadow-berry-500/30">
                <img src="/icon.svg" alt="" className="h-20 w-20" />
              </div>
              <h1 className="text-2xl font-extrabold">
                {greeting}, <span className="brand-text">{user.displayName}</span>!
              </h1>
              <p className="mt-1 text-stone-600">מה בא לך היום? ספר/י לי ונרכיב משהו טעים ומשביע</p>
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
            placeholder={listening ? "מקשיב..." : "מה בא לך לאכול?"}
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
