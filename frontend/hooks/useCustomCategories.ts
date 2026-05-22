"use client";

import { useState, useCallback, useEffect } from "react";
import { getCategories, addCategory, deleteCategory } from "@/lib/api";

export interface CustomCategory {
  key: string;
  label: string;
}

export function useCustomCategories() {
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  useEffect(() => {
    getCategories().then(setCustomCategories).catch(() => {});
  }, []);

  const addCustomCategory = useCallback(async (label: string): Promise<CustomCategory> => {
    const key = `custom_${Date.now()}`;
    const created = await addCategory(key, label.trim());
    setCustomCategories((prev) => [...prev, created]);
    return created;
  }, []);

  const removeCustomCategory = useCallback(async (key: string) => {
    await deleteCategory(key);
    setCustomCategories((prev) => prev.filter((c) => c.key !== key));
  }, []);

  return { customCategories, addCustomCategory, removeCustomCategory };
}
