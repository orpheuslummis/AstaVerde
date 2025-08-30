"use client";

import React from "react";

interface AdminCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  id?: string; // to allow anchoring with #id
}

export function AdminCard({ title, description, children, footer, id }: AdminCardProps) {
  return (
    <section id={id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <header className="mb-3">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
        )}
      </header>
      <div>{children}</div>
      {footer && <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">{footer}</div>}
    </section>
  );
}

