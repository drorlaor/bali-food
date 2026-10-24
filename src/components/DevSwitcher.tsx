"use client";

import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";

type DevUser = { email: string; displayName: string; role: string };

/** Local-development only bar for switching between family members without Google OAuth. */
export default function DevSwitcher() {
  const [list, setList] = useState<DevUser[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/dev/switch")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setList(d.users || []))
      .catch(() => undefined);
  }, [open]);

  async function switchTo(u: DevUser) {
    await fetch("/api/dev/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: u.email }),
    });
    window.location.href = u.role === "parent" ? "/admin" : "/chat";
  }

  return (
    <div className="fixed bottom-24 left-3 z-[60] md:bottom-4" dir="rtl">
      {open && (
        <div className="mb-2 w-56 animate-pop rounded-2xl border border-violet-200 bg-white/95 p-2 shadow-xl backdrop-blur">
          <p className="px-2 pb-1 text-[11px] font-semibold text-violet-600">מצב פיתוח - החלפת משתמש</p>
          {list.map((u) => (
            <button
              key={u.email}
              id={`dev-switch-${u.email.replace(/[^a-z0-9]/gi, "-")}`}
              onClick={() => switchTo(u)}
              className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-sm hover:bg-violet-50"
            >
              <span>{u.displayName}</span>
              <span className="text-[11px] text-stone-400">{u.role === "parent" ? "הורה" : "ילד/ה"}</span>
            </button>
          ))}
        </div>
      )}
      <button
        id="dev-switcher-toggle"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-500/30"
      >
        <FlaskConical size={14} /> DEV
      </button>
    </div>
  );
}
