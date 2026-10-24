"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, Trash2, Pencil, Plus, ShoppingBasket, Bot, UserRound, Check, X } from "lucide-react";
import { CATEGORY_LABELS, GROUP_LABELS } from "@/lib/types";
import { api, ChildPicker, fmtDate, Spinner, type AdminUser } from "./ui";

type Profile = {
  userId: string;
  birthYear: number;
  activityProfile: string;
  kitchenPermissions: string;
  medicalOrDietaryNotes: string;
  parentCustomDirectives: string;
  updatedAt: string | null;
};
type Fact = {
  id: string;
  category: string;
  nutritionalGroup: string;
  itemOrFact: string;
  notes: string | null;
  createdBy: "ai" | "parent";
  createdAt: string | null;
};
type Draft = { category: string; nutritionalGroup: string; itemOrFact: string; notes: string };
type Toast = (k: "ok" | "err", t: string) => void;

const EMPTY_DRAFT: Draft = { category: "liked_ingredient", nutritionalGroup: "protein", itemOrFact: "", notes: "" };

export default function ChildrenTab({ users, toast }: { users: AdminUser[]; toast: Toast }) {
  const kids = users.filter((u) => u.role === "child");
  const [childId, setChildId] = useState<string | null>(null);
  useEffect(() => {
    if (!childId && kids.length) setChildId(kids[0].id);
  }, [kids, childId]);

  return (
    <div className="space-y-5">
      <ChildPicker users={users} value={childId} onChange={setChildId} />
      {childId && (
        <div key={childId} className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <ProfileCard userId={childId} toast={toast} />
          </div>
          <div className="lg:col-span-3">
            <MemoryManager userId={childId} toast={toast} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileCard({ userId, toast }: { userId: string; toast: Toast }) {
  const [p, setP] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api<{ profile: Profile }>(`/api/admin/profiles?userId=${userId}`)
      .then((d) => setP(d.profile))
      .catch((e) => toast("err", e.message));
  }, [userId, toast]);
  if (!p) return <div className="card"><Spinner /></div>;

  const age = new Date().getFullYear() - p.birthYear;
  const field = (key: keyof Profile, label: string, hint: string, rows = 3) => (
    <div>
      <label htmlFor={`pf-${key}`} className="mb-1 block text-sm font-semibold text-stone-700">{label}</label>
      <textarea
        id={`pf-${key}`}
        rows={rows}
        value={String(p[key] ?? "")}
        onChange={(e) => setP({ ...p, [key]: e.target.value })}
        placeholder={hint}
        className="input-base"
      />
    </div>
  );

  async function save() {
    setSaving(true);
    try {
      const d = await api<{ profile: Profile }>("/api/admin/profiles", { method: "PUT", body: JSON.stringify(p) });
      setP(d.profile);
      toast("ok", "הפרופיל נשמר");
    } catch (e) {
      toast("err", (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">פרופיל קבוע</h2>
        <span className="text-xs text-stone-400">עודכן: {fmtDate(p.updatedAt)}</span>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="pf-birthYear" className="mb-1 block text-sm font-semibold text-stone-700">שנת לידה</label>
          <input id="pf-birthYear" type="number" dir="ltr" value={p.birthYear} onChange={(e) => setP({ ...p, birthYear: Number(e.target.value) })} className="input-base" />
        </div>
        <div className="rounded-xl bg-mango-50 px-4 py-2 text-center ring-1 ring-mango-200">
          <div className="text-xs text-stone-500">גיל</div>
          <div className="text-xl font-extrabold text-mango-600">{age}</div>
        </div>
      </div>
      {field("activityProfile", "פרופיל פעילות גופנית", "למשל: כדורגל 3 פעמים בשבוע, 17:00-19:00")}
      {field("kitchenPermissions", "הרשאות בטיחות במטבח (קשיח!)", "מה מותר ומה אסור להפעיל במטבח")}
      {field("medicalOrDietaryNotes", "הערות רפואיות / תזונתיות", "אלרגיות, רגישויות, צמחונות...", 2)}
      {field("parentCustomDirectives", "הנחיות מיוחדות מההורים", "למשל: לעודד יותר ירקות בכריך", 2)}
      <button id="profile-save" onClick={save} disabled={saving} className="btn-primary w-full">
        <Save size={16} /> {saving ? "שומר..." : "שמירת פרופיל"}
      </button>
    </section>
  );
}

function FactForm({ initial, onSubmit, onCancel, submitLabel }: { initial: Draft; onSubmit: (d: Draft) => void; onCancel?: () => void; submitLabel: string }) {
  const [d, setD] = useState(initial);
  return (
    <form
      className="grid gap-2 sm:grid-cols-12"
      onSubmit={(e) => {
        e.preventDefault();
        if (d.itemOrFact.trim()) onSubmit(d);
      }}
    >
      <select aria-label="קטגוריה" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} className="input-base sm:col-span-3">
        {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select aria-label="קבוצה תזונתית" value={d.nutritionalGroup} onChange={(e) => setD({ ...d, nutritionalGroup: e.target.value })} className="input-base sm:col-span-2">
        {Object.entries(GROUP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input aria-label="פריט" value={d.itemOrFact} onChange={(e) => setD({ ...d, itemOrFact: e.target.value })} placeholder="פריט / עובדה" className="input-base sm:col-span-3" />
      <input aria-label="הערות" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} placeholder="הערות" className="input-base sm:col-span-2" />
      <div className="flex gap-1 sm:col-span-2">
        <button type="submit" className="btn-primary flex-1 px-2" title={submitLabel}>
          {onCancel ? <Check size={16} /> : <Plus size={16} />} <span className="sm:hidden lg:inline">{submitLabel}</span>
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost px-2" title="ביטול"><X size={16} /></button>
        )}
      </div>
    </form>
  );
}

function MemoryManager({ userId, toast }: { userId: string; toast: Toast }) {
  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    const d = await api<{ facts: Fact[] }>(`/api/admin/memory?userId=${userId}`);
    setFacts(d.facts);
  }, [userId]);
  useEffect(() => {
    load().catch((e) => toast("err", e.message));
  }, [load, toast]);

  async function add(d: Draft) {
    try {
      await api("/api/admin/memory", { method: "POST", body: JSON.stringify({ ...d, userId }) });
      setFormKey((k) => k + 1);
      await load();
      toast("ok", "נוסף לזיכרון");
    } catch (e) {
      toast("err", (e as Error).message);
    }
  }
  async function update(id: string, d: Draft) {
    try {
      await api("/api/admin/memory", { method: "PATCH", body: JSON.stringify({ ...d, id }) });
      setEditing(null);
      await load();
      toast("ok", "עודכן");
    } catch (e) {
      toast("err", (e as Error).message);
    }
  }
  async function remove(f: Fact) {
    if (!confirm(`למחוק את "${f.itemOrFact}"?`)) return;
    try {
      await api(`/api/admin/memory?id=${f.id}`, { method: "DELETE" });
      await load();
      toast("ok", "נמחק");
    } catch (e) {
      toast("err", (e as Error).message);
    }
  }

  if (!facts) return <div className="card"><Spinner /></div>;
  const wishlist = facts.filter((f) => f.category === "wishlist_to_try");
  const shown = facts.filter((f) => filter === "all" || f.category === filter);

  const row = (f: Fact) =>
    editing === f.id ? (
      <div key={f.id} className="rounded-xl bg-mango-50/60 p-2 ring-1 ring-mango-200">
        <FactForm
          initial={{ category: f.category, nutritionalGroup: f.nutritionalGroup, itemOrFact: f.itemOrFact, notes: f.notes || "" }}
          onSubmit={(d) => update(f.id, d)}
          onCancel={() => setEditing(null)}
          submitLabel="שמור"
        />
      </div>
    ) : (
      <div key={f.id} className="group flex items-center gap-3 rounded-xl bg-white/80 px-3 py-2 ring-1 ring-stone-100 transition hover:ring-mango-200">
        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">{CATEGORY_LABELS[f.category]}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{f.itemOrFact}</div>
          <div className="truncate text-xs text-stone-400">
            {GROUP_LABELS[f.nutritionalGroup]}
            {f.notes ? ` - ${f.notes}` : ""}
          </div>
        </div>
        <span title={f.createdBy === "ai" ? "נשמר ע\"י ה-AI" : "נוסף ע\"י הורה"} className="flex shrink-0 items-center gap-1 text-[11px] text-stone-400">
          {f.createdBy === "ai" ? <Bot size={13} /> : <UserRound size={13} />} {fmtDate(f.createdAt)}
        </span>
        <button onClick={() => setEditing(f.id)} className="rounded-lg p-1.5 text-stone-400 hover:bg-mango-50 hover:text-mango-600" title="עריכה"><Pencil size={15} /></button>
        <button onClick={() => remove(f)} className="rounded-lg p-1.5 text-stone-400 hover:bg-rose-50 hover:text-rose-600" title="מחיקה"><Trash2 size={15} /></button>
      </div>
    );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border-2 border-dashed border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <h3 className="mb-2 flex items-center gap-2 font-bold text-green-800">
          <ShoppingBasket size={18} /> דברים שהילד ביקש לנסות / לקנות
          <span className="rounded-full bg-green-600 px-2 text-xs text-white">{wishlist.length}</span>
        </h3>
        {wishlist.length ? (
          <div className="flex flex-wrap gap-2">
            {wishlist.map((f) => (
              <span key={f.id} title={f.notes || ""} className="rounded-full bg-white px-3 py-1 text-sm text-green-900 ring-1 ring-green-200">{f.itemOrFact}</span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-green-700/70">רשימת הקניות-לניסיון ריקה כרגע</p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">זיכרון נלמד ({facts.length})</h2>
        <div className="flex flex-wrap gap-1.5">
          {[["all", "הכל"], ...Object.entries(CATEGORY_LABELS)].map(([k, v]) => (
            <button
              key={k}
              id={`mem-filter-${k}`}
              onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${filter === k ? "bg-stone-800 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:ring-stone-300"}`}
            >
              {v} ({k === "all" ? facts.length : facts.filter((f) => f.category === k).length})
            </button>
          ))}
        </div>
        <div className="space-y-1.5">{shown.length ? shown.map(row) : <p className="py-6 text-center text-sm text-stone-400">אין פריטים בקטגוריה</p>}</div>
        <div className="border-t border-stone-200 pt-3">
          <p className="mb-2 text-sm font-semibold text-stone-700">הוספה ידנית כהורה</p>
          <FactForm key={formKey} initial={EMPTY_DRAFT} onSubmit={add} submitLabel="הוסף" />
        </div>
      </section>
    </div>
  );
}
