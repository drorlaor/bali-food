"use client";

import { useEffect, useState } from "react";
import { Save, RotateCcw, Zap } from "lucide-react";
import { PANTRY_LABELS, type HouseholdBaselinePantry } from "@/lib/types";
import { api, fmtDate, Spinner, TagEditor } from "./ui";

type Config = {
  masterSystemPrompt: string;
  baselinePantry: HouseholdBaselinePantry;
  modelName: string;
  quickPrompts: string[];
  updatedAt: string | null;
  updatedBy: string | null;
};

export default function ConfigTab({ toast }: { toast: (k: "ok" | "err", t: string) => void }) {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [orig, setOrig] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const c = await api<Config>("/api/admin/config");
    setCfg(c);
    setOrig(JSON.stringify(c));
  }
  useEffect(() => {
    load().catch((e) => toast("err", e.message));
  }, [toast]);

  if (!cfg) return <Spinner />;
  const dirty = JSON.stringify(cfg) !== orig;

  async function save() {
    if (!cfg) return;
    setSaving(true);
    try {
      const c = await api<Config>("/api/admin/config", { method: "PUT", body: JSON.stringify(cfg) });
      setCfg(c);
      setOrig(JSON.stringify(c));
      toast("ok", "ההגדרות נשמרו");
    } catch (e) {
      toast("err", (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <section className="card lg:col-span-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">חוקת התזונה (System Prompt)</h2>
          <span className="text-xs text-stone-400">
            עודכן: {fmtDate(cfg.updatedAt)} {cfg.updatedBy ? `(${cfg.updatedBy})` : ""}
          </span>
        </div>
        <p className="mb-3 text-sm text-stone-500">ההנחיות הכלליות שה-AI מקבל בכל שיחה. הפרופיל הקבוע של כל ילד, המזווה והזיכרון מתווספים אוטומטית.</p>
        <textarea
          id="master-prompt"
          dir="rtl"
          value={cfg.masterSystemPrompt}
          onChange={(e) => setCfg({ ...cfg, masterSystemPrompt: e.target.value })}
          className="input-base min-h-[520px] font-mono text-[13px] leading-6"
        />
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="model-name" className="text-sm text-stone-500">מודל:</label>
          <input id="model-name" dir="ltr" value={cfg.modelName} onChange={(e) => setCfg({ ...cfg, modelName: e.target.value })} className="input-base max-w-56" />
        </div>
      </section>

      <div className="space-y-5 lg:col-span-2">
        <section className="card">
          <h2 className="mb-1 text-lg font-bold">המזווה הקבוע של הבית</h2>
          <p className="mb-3 text-sm text-stone-500">מוצרים שבדרך כלל יש בבית. ה-AI יתעדף אותם להצעות מיידיות.</p>
          <div className="space-y-3">
            {(Object.keys(PANTRY_LABELS) as (keyof HouseholdBaselinePantry)[]).map((k) => (
              <div key={k}>
                <label htmlFor={`pantry-${k}`} className="mb-1 block text-sm font-semibold text-stone-700">{PANTRY_LABELS[k]}</label>
                <TagEditor
                  id={`pantry-${k}`}
                  values={cfg.baselinePantry[k] || []}
                  onChange={(v) => setCfg({ ...cfg, baselinePantry: { ...cfg.baselinePantry, [k]: v } })}
                />
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold"><Zap size={18} className="text-mango-500" /> כפתורי פתיחה מהירה</h2>
          <p className="mb-3 text-sm text-stone-500">הצ'יפים שהילדים רואים בתחילת שיחה חדשה.</p>
          <TagEditor id="quick-prompts" values={cfg.quickPrompts} onChange={(v) => setCfg({ ...cfg, quickPrompts: v })} placeholder="הוספת כפתור..." />
        </section>
      </div>

      <div className={`fixed inset-x-0 bottom-20 z-40 flex justify-center transition md:bottom-6 ${dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}>
        <div className="glass flex items-center gap-2 rounded-full p-1.5 shadow-xl">
          <span className="px-3 text-sm text-stone-600">יש שינויים שלא נשמרו</span>
          <button id="config-reset" onClick={() => setCfg(JSON.parse(orig))} className="btn-ghost rounded-full">
            <RotateCcw size={15} /> ביטול
          </button>
          <button id="config-save" onClick={save} disabled={saving} className="btn-primary rounded-full">
            <Save size={15} /> {saving ? "שומר..." : "שמירה"}
          </button>
        </div>
      </div>
    </div>
  );
}
