"use client";
import { useCallback, useSyncExternalStore } from "react";

// A per-device setting in localStorage that renders the default on the server
// and the saved value after hydration, with no effect-driven re-render.
const listeners = new Set<() => void>();

export function useLocalSetting(key: string, fallback: string): [string, (v: string) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      window.addEventListener("storage", cb);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );
  const set = useCallback(
    (v: string) => {
      try {
        localStorage.setItem(key, v);
      } catch {}
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, set];
}
