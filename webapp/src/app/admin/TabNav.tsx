"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";

type TabKey = "controls" | "mint";

const tabs: { key: TabKey; label: string }[] = [
  { key: "controls", label: "Admin Controls" },
  { key: "mint", label: "Mint" },
];

export function TabNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const active = (params.get("tab") as TabKey) || "controls";

  const onSelect = (key: TabKey) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", key);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const btnRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = tabs.findIndex((t) => t.key === active);
    if (e.key === "ArrowRight") {
      const next = (currentIndex + 1) % tabs.length as 0 | 1;
      onSelect(tabs[next].key);
      btnRefs.current[next]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      const prev = (currentIndex - 1 + tabs.length) % tabs.length as 0 | 1;
      onSelect(tabs[prev].key);
      btnRefs.current[prev]?.focus();
      e.preventDefault();
    }
  };

  return (
    <div className="w-full sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-700 mb-4">
      <div className="flex gap-2 px-4" role="tablist" aria-label="Admin sections" onKeyDown={onKeyDown}>
        {tabs.map((t, i) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              ref={(el) => (btnRefs.current[i] = el)}
              type="button"
              onClick={() => onSelect(t.key)}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={`px-4 py-2 -mb-px rounded-t-md text-sm font-medium transition-colors border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                isActive
                  ? "border-emerald-500 text-emerald-700 dark:text-emerald-300"
                  : "border-transparent text-gray-600 hover:text-emerald-700 dark:text-gray-300 dark:hover:text-emerald-300"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
