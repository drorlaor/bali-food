"use client";

import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, X } from "lucide-react";
import { APP_VERSION } from "@/lib/version";

interface VersionInfo {
  version: string;
  buildTime: string;
  notes?: string;
}

export default function VersionNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState<VersionInfo | null>(null);
  const [justUpdatedNote, setJustUpdatedNote] = useState<string | null>(null);

  useEffect(() => {
    // Check if the user just updated to this version
    const lastSeen = localStorage.getItem("bali_seen_version");
    if (!lastSeen) {
      localStorage.setItem("bali_seen_version", APP_VERSION);
    } else if (lastSeen !== APP_VERSION) {
      setJustUpdatedNote(`האפליקציה עודכנה לגרסה ${APP_VERSION}`);
      localStorage.setItem("bali_seen_version", APP_VERSION);
      setTimeout(() => setJustUpdatedNote(null), 4000);
    }

    // Function to check if a newer version is deployed on server
    async function checkServerVersion() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data: VersionInfo = await res.json();
        if (data.version && data.version !== APP_VERSION) {
          setUpdateAvailable(data);
        }
      } catch {
        // Ignore network hiccups
      }
    }

    // Check periodically and when tab becomes active
    const interval = setInterval(checkServerVersion, 60000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkServerVersion();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  function handleReload() {
    if (updateAvailable) {
      localStorage.setItem("bali_seen_version", updateAvailable.version);
    }
    window.location.reload();
  }

  return (
    <>
      {/* Banner when a new version is deployed on Vercel */}
      {updateAvailable && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-2 inset-x-3 z-[100] mx-auto max-w-lg animate-pop"
          dir="rtl"
        >
          <div className="flex items-center justify-between gap-3 rounded-2xl brand-gradient px-4 py-3 text-white shadow-2xl shadow-mango-500/40">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <Sparkles size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight">עודכנה גרסה חדשה באפליקציה!</p>
                <p className="truncate text-xs text-white/85">
                  {updateAvailable.notes || `גרסה ${updateAvailable.version} זמינה כעת`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                id="btn-update-reload"
                onClick={handleReload}
                className="flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-stone-900 shadow-md transition hover:bg-stone-50 active:scale-95"
              >
                <RefreshCw size={13} />
                רענון
              </button>
              <button
                onClick={() => setUpdateAvailable(null)}
                className="rounded-xl p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
                aria-label="סגור"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Toast when first opening the new version */}
      {justUpdatedNote && !updateAvailable && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex animate-pop items-center gap-2 rounded-full bg-stone-900/90 backdrop-blur px-4 py-2 text-xs font-semibold text-white shadow-xl"
          dir="rtl"
        >
          <Sparkles size={14} className="text-mango-400" />
          {justUpdatedNote}
        </aside>
      )}
    </>
  );
}
