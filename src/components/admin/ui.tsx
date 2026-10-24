"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: "parent" | "child";
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string | null;
};

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

export function useUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ users: AdminUser[] }>("/api/admin/users");
      setUsers(d.users);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { users, loading, reload };
}

export function ChildPicker({ users, value, onChange }: { users: AdminUser[]; value: string | null; onChange: (id: string) => void }) {
  const kids = users.filter((u) => u.role === "child");
  if (!kids.length) return <p className="text-sm text-stone-500">אין עדיין ילדים ברשימה. הוסיפו בלשונית "ניהול משתמשים".</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {kids.map((k) => (
        <button
          key={k.id}
          id={`child-pick-${k.id}`}
          onClick={() => onChange(k.id)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            value === k.id ? "brand-gradient text-white shadow-md shadow-mango-500/30" : "bg-white text-stone-700 ring-1 ring-stone-200 hover:ring-mango-300"
          } ${k.isActive ? "" : "opacity-50"}`}
        >
          {k.displayName}
        </button>
      ))}
    </div>
  );
}

export function TagEditor({ id, values, onChange, placeholder }: { id: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  }
  return (
    <div className="rounded-xl border border-stone-200 bg-white/80 p-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex animate-pop items-center gap-1 rounded-full bg-mango-50 px-3 py-1 text-sm text-stone-700 ring-1 ring-mango-200">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="rounded-full p-0.5 text-stone-400 hover:bg-mango-100 hover:text-rose-500" aria-label={`הסר ${v}`}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder || "הוספת פריט..."}
          className="input-base"
        />
        <button type="button" onClick={add} className="btn-ghost shrink-0 px-2.5" aria-label="הוסף">
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

export type Toast = { kind: "ok" | "err"; text: string } | null;

export function ToastView({ toast }: { toast: Toast }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 animate-pop items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-xl ${
        toast.kind === "ok" ? "bg-green-600" : "bg-rose-600"
      }`}
    >
      {toast.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {toast.text}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<Toast>(null);
  const show = useCallback((kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 2600);
  }, []);
  return { toast, show };
}

export function Spinner() {
  return (
    <div className="flex justify-center py-10 text-mango-500">
      <Loader2 className="animate-spin" />
    </div>
  );
}

export function fmtDate(iso: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}
