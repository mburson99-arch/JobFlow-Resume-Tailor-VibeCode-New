import { useState } from "react";

export function readLocalStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useLocalStorageState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readLocalStorage(key, fallback));

  const setStoredValue = (next: T | ((current: T) => T)) => {
    setValue((current) => {
      const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
      localStorage.setItem(key, JSON.stringify(resolved));
      return resolved;
    });
  };

  const removeStoredValue = () => {
    localStorage.removeItem(key);
    setValue(fallback);
  };

  return [value, setStoredValue, removeStoredValue] as const;
}
