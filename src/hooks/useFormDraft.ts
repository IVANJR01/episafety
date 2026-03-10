import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Hook that persists form state in localStorage so drafts survive navigation/refresh.
 * The draft is automatically cleared when the form is successfully saved.
 */
export function useFormDraft<T extends Record<string, any>>(
  key: string,
  defaultValues: T
) {
  const storageKey = `form_draft_${key}`;
  const isInitialized = useRef(false);

  const [form, setForm] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to handle new fields
        return { ...defaultValues, ...parsed };
      }
    } catch { /* ignore */ }
    return defaultValues;
  });

  // Persist to localStorage on every change (debounced effect)
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      return;
    }
    // Only save if form differs from defaults
    const isDirty = Object.keys(defaultValues).some(
      k => form[k] !== defaultValues[k]
    );
    if (isDirty) {
      localStorage.setItem(storageKey, JSON.stringify(form));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [form, storageKey, defaultValues]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const resetForm = useCallback((values?: T) => {
    setForm(values || defaultValues);
    localStorage.removeItem(storageKey);
  }, [defaultValues, storageKey]);

  const hasDraft = useCallback(() => {
    return localStorage.getItem(storageKey) !== null;
  }, [storageKey]);

  return { form, setForm, clearDraft, resetForm, hasDraft };
}
