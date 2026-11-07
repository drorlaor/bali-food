"use client";

import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, X } from "lucide-react";
import { APP_VERSION, FEATURE_RELEASE_ID } from "@/lib/version";

interface VersionInfo {
  version: string;
  buildTime: string;
  notes?: string;
}

export default function VersionNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState<VersionInfo | null>(null);
  const [justUpdatedNote, setJustUpdatedNote] = useState<string | null>(null);

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem("bali_seen_version");
    const lastSeenFeatureRelease = localStorage.getItem("bali_seen_feature_release");

    if (!lastSeenVersion) {
      localStorage.setItem("bali_seen_version", APP_VERSION);
    } else if (lastSeenVersion !== APP_VERSION) {
      localStorage.setItem("bali_seen_version", APP_VERSION);
      // Only show the small toast if the full What's New modal is not about to pop up
      if (lastSeenFeatureRelease === FEATURE_RELEASE_ID) {
        setJustUpdatedNote(`האפליקציה עודכנה לגרסה ${APP_VERSION}`);
        setTimeout(() => setJustUpdatedNote(null), 4000);
      }
    }

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

    checkServerVersion();
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
    window.location.reload();
  }

  return (
    <>
      {updateAvailable && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed inset-x-3 top-2 z-[100] mx-auto max-w-lg animate-pop"
          dir="rtl"
        >
          <div className="brand-gradient flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-white shadow-2xl shadow-mango-500/40">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <Sparkles size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight">יש חידושים באפליקציה! 🎉</p>
                <p className="truncate text-xs text-white/90">
                  {updateAvailable.notes || `גרסה ${updateAvailable.version} זמינה כעת`}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                id="btn-update-reload"
                onClick={handleReload}
                className="flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-stone-900 shadow-md transition hover:bg-stone-50 active:scale-95"
              >
                <RefreshCw size={13} />
                עדכן עכשיו
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

      {justUpdatedNote && !updateAvailable && (
        <aside
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex justify-center px-4"
          dir="rtl"
        >
          <div className="flex animate-pop items-center gap-2 rounded-full bg-stone-900/90 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur">
            <Sparkles size={14} className="text-mango-400" />
            {justUpdatedNote}
          </div>
        </aside>
      )}
    </>
  );
}
