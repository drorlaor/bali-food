"use client";

import { useState } from "react";
import { UserPlus, Pencil, Power, Check, X, Crown, Baby } from "lucide-react";
import { api, fmtDate, type AdminUser } from "./ui";

type Toast = (k: "ok" | "err", t: string) => void;

export default function UsersTab({ users, reload, meId, toast }: { users: AdminUser[]; reload: () => Promise<void>; meId: string; toast: Toast }) {
  const [form, setForm] = useState({ email: "", displayName: "", role: "child", birthYear: new Date().getFullYear() - 10 });
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState({ email: "", displayName: "", role: "child" });
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
      setForm({ ...form, email: "", displayName: "" });
      await reload();
      toast("ok", "המשתמש נוסף לרשימת המשפחה");
    } catch (err) {
      toast("err", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(body: Record<string, unknown>) {
    try {
      await api("/api/admin/users", { method: "PATCH", body: JSON.stringify(body) });
      setEditing(null);
      await reload();
      toast("ok", "עודכן");
    } catch (err) {
      toast("err", (err as Error).message);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <section className="card h-fit">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold"><UserPlus size={18} className="text-mango-500" /> הוספת בן/בת משפחה</h2>
        <p className="mb-3 text-sm text-stone-500">רק כתובות Gmail ברשימה יוכלו להיכנס לאפליקציה.</p>
        <form onSubmit={add} className="space-y-2.5">
          <input id="new-user-email" type="email" dir="ltr" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="child@gmail.com" className="input-base" />
          <input id="new-user-name" required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="שם לתצוגה" className="input-base" />
          <div className="grid grid-cols-2 gap-2">
            {(["child", "parent"] as const).map((r) => (
              <button
                key={r}
                type="button"
                id={`new-user-role-${r}`}
                onClick={() => setForm({ ...form, role: r })}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition ${form.role === r ? "brand-gradient text-white" : "bg-white ring-1 ring-stone-200"}`}
              >
                {r === "child" ? <Baby size={15} /> : <Crown size={15} />} {r === "child" ? "ילד/ה" : "הורה"}
              </button>
            ))}
          </div>
          {form.role === "child" && (
            <div className="flex items-center gap-2">
              <label htmlFor="new-user-birthyear" className="shrink-0 text-sm text-stone-600">שנת לידה</label>
              <input id="new-user-birthyear" type="number" dir="ltr" value={form.birthYear} onChange={(e) => setForm({ ...form, birthYear: Number(e.target.value) })} className="input-base" />
            </div>
          )}
          <button id="new-user-submit" type="submit" disabled={busy} className="btn-primary w-full">
            <UserPlus size={16} /> {busy ? "מוסיף..." : "הוספה"}
          </button>
        </form>
      </section>

      <section className="card lg:col-span-2">
        <h2 className="mb-3 text-lg font-bold">רשימת המשפחה ({users.length})</h2>
        <div className="space-y-2">
          {users.map((u) =>
            editing === u.id ? (
              <div key={u.id} className="grid gap-2 rounded-xl bg-mango-50/60 p-3 ring-1 ring-mango-200 sm:grid-cols-12">
                <input aria-label="אימייל" dir="ltr" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} className="input-base sm:col-span-5" />
                <input aria-label="שם" value={edit.displayName} onChange={(e) => setEdit({ ...edit, displayName: e.target.value })} className="input-base sm:col-span-3" />
                <select aria-label="תפקיד" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} className="input-base sm:col-span-2">
                  <option value="child">ילד/ה</option>
                  <option value="parent">הורה</option>
                </select>
                <div className="flex gap-1 sm:col-span-2">
                  <button onClick={() => patch({ id: u.id, ...edit })} className="btn-primary flex-1 px-2" title="שמור"><Check size={16} /></button>
                  <button onClick={() => setEditing(null)} className="btn-ghost px-2" title="ביטול"><X size={16} /></button>
                </div>
              </div>
            ) : (
              <div key={u.id} className={`flex items-center gap-3 rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-stone-100 ${u.isActive ? "" : "opacity-55"}`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-white ${u.role === "parent" ? "bg-stone-800" : "brand-gradient"}`}>
                  {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : u.displayName.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">
                    {u.displayName}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${u.role === "parent" ? "bg-stone-800 text-white" : "bg-mango-100 text-mango-700"}`}>{u.role === "parent" ? "הורה" : "ילד/ה"}</span>
                    {!u.isActive && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700">מושבת</span>}
                    {u.id === meId && <span className="text-[10px] text-stone-400">(את/ה)</span>}
                  </div>
                  <div className="truncate text-xs text-stone-500" dir="ltr" style={{ textAlign: "right" }}>{u.email}</div>
                </div>
                <span className="hidden text-[11px] text-stone-400 sm:block">{fmtDate(u.createdAt)}</span>
                <button
                  onClick={() => {
                    setEditing(u.id);
                    setEdit({ email: u.email, displayName: u.displayName, role: u.role });
                  }}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-mango-50 hover:text-mango-600"
                  title="עריכה"
                >
                  <Pencil size={15} />
                </button>
                {u.id !== meId && (
                  <button
                    onClick={() => patch({ id: u.id, isActive: !u.isActive })}
                    className={`rounded-lg p-1.5 ${u.isActive ? "text-stone-400 hover:bg-rose-50 hover:text-rose-600" : "text-green-600 hover:bg-green-50"}`}
                    title={u.isActive ? "השבתה" : "הפעלה"}
                  >
                    <Power size={15} />
                  </button>
                )}
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}
