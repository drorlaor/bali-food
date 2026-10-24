"use client";

import ReactMarkdown from "react-markdown";
import { BookmarkPlus, BookmarkMinus } from "lucide-react";
import { memoryUpdateLabel, type MemoryUpdate } from "@/lib/types";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-chat text-[15px] leading-relaxed">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}

export function MemoryBadges({ updates }: { updates: MemoryUpdate[] }) {
  const ok = updates.filter((u) => u.success);
  if (!ok.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {ok.map((u, i) => {
        const save = u.action === "save_child_preference";
        return (
          <span
            key={i}
            className={`inline-flex animate-pop items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              save ? "bg-leaf-400/15 text-green-700 ring-1 ring-green-200" : "bg-stone-100 text-stone-600 ring-1 ring-stone-200"
            }`}
          >
            {save ? <BookmarkPlus size={12} /> : <BookmarkMinus size={12} />}
            {save ? "+ " : "- "}
            {memoryUpdateLabel(u)}
          </span>
        );
      })}
    </div>
  );
}
