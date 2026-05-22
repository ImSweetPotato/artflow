"use client";

import { useState, useCallback, useEffect } from "react";
import { addProjectCategory, deleteProjectCategory, getProjectCategories } from "@/lib/api";

export interface ProjectCategoryOption {
  key: string;
  label: string;
}

function makeProjectKey(label: string) {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `project_${normalized || Date.now()}`;
}

export function useProjectCategories() {
  const [projectCategories, setProjectCategories] = useState<ProjectCategoryOption[]>([]);

  useEffect(() => {
    getProjectCategories().then(setProjectCategories).catch(() => {});
  }, []);

  const addSharedProjectCategory = useCallback(async (label: string): Promise<ProjectCategoryOption> => {
    const created = await addProjectCategory(makeProjectKey(label), label.trim());
    setProjectCategories((prev) => [...prev, created]);
    return created;
  }, []);

  const removeSharedProjectCategory = useCallback(async (key: string) => {
    await deleteProjectCategory(key);
    setProjectCategories((prev) => prev.filter((c) => c.key !== key));
  }, []);

  return { projectCategories, addSharedProjectCategory, removeSharedProjectCategory };
}
