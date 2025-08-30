"use client";

import type React from "react";
import { ENV } from "../config/environment";

export function DevOnly({ children }: { children: React.ReactNode }) {
  if (ENV.CHAIN_SELECTION !== "local") {
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-xl font-semibold mb-2">Developer Page</h1>
        <p className="text-gray-700 dark:text-gray-300">
          This page is only available when running the local development stack.
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Switch to the local environment (npm run dev:local) to use this tool.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

export default DevOnly;

