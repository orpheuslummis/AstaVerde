"use client";

import { useEffect, useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  id?: string;
  children: React.ReactNode;
}

export default function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  forceOpen,
  id,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Auto-open if an external signal requests it
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <section id={id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        <span
          className={`transition-transform duration-200 text-gray-500 ${open ? "rotate-180" : "rotate-0"}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && <div className="border-t border-gray-100 dark:border-gray-700 p-6">{children}</div>}
    </section>
  );
}

