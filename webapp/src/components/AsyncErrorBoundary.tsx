"use client";

import React from "react";
import ErrorBoundary from "./ErrorBoundary";

interface AsyncErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error) => void;
}

// Specialized error boundary for async operations
export function AsyncErrorBoundary({ children, onError }: AsyncErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="mb-4 text-6xl">⚠️</div>
            <h3 className="mb-2 text-lg font-semibold">Failed to load data</h3>
            <p className="text-sm text-gray-600">
              There was an error loading the requested data. Please try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export default AsyncErrorBoundary;
