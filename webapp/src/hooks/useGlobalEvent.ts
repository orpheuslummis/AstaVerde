import { type DependencyList, useEffect } from "react";

/**
 * Custom hook for managing global window event listeners with automatic cleanup
 * @param eventName - The name of the event to listen for
 * @param handler - The event handler function
 * @param deps - Optional dependency array for the effect
 */
export function useGlobalEvent(eventName: string, handler: EventListener, deps: DependencyList = []) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Add the event listener
    window.addEventListener(eventName, handler);

    // Cleanup function to remove the listener
    return () => {
      window.removeEventListener(eventName, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Specialized hook for the astaverde:refetch event
 * @param handler - The function to call when refetch is triggered
 * @param deps - Optional dependency array for the effect
 */
export function useAstaVerdeRefetch(handler: () => void, deps: DependencyList = []) {
  useGlobalEvent("astaverde:refetch", handler as EventListener, deps);
}

/**
 * Helper function to dispatch the astaverde:refetch event
 */
export function dispatchRefetch() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("astaverde:refetch"));
  }
}
