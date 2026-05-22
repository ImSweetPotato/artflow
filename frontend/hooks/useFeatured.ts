"use client";

import { useState, useCallback, useEffect } from "react";
import { InspirationCase } from "@/lib/inspiration-data";
import {
  getPublicFeatured,
  getMyFeatured,
  addFeaturedApi,
  updateFeaturedTitleApi,
  deleteFeaturedApi,
  publishFeaturedApi,
  unpublishFeaturedApi,
  getAdminAllFeatured,
  AdminFeatured,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export function useFeatured() {
  const { user } = useAuth();
  const [publicFeatured, setPublicFeatured] = useState<InspirationCase[]>([]);
  const [myFeatured, setMyFeatured] = useState<InspirationCase[]>([]);
  const [adminAll, setAdminAll] = useState<AdminFeatured[]>([]);

  // 公共精选（所有人可读）
  useEffect(() => {
    getPublicFeatured().then((rows) => setPublicFeatured(rows as InspirationCase[])).catch(() => {});
  }, []);

  // 私有收藏（需登录）
  useEffect(() => {
    if (!user) return;
    getMyFeatured().then((rows) => setMyFeatured(rows as InspirationCase[])).catch(() => {});
  }, [user]);

  // 管理员：所有用户的收藏
  const loadAdminAll = useCallback(async () => {
    if (!user?.isAdmin) return;
    try {
      const rows = await getAdminAllFeatured();
      setAdminAll(rows);
    } catch {}
  }, [user]);

  const addFeatured = useCallback(async (item: InspirationCase) => {
    try {
      const created = await addFeaturedApi({
        id: item.id,
        category: item.category,
        categoryLabel: item.categoryLabel,
        title: item.title,
        author: item.author,
        prompt: item.prompt,
        imageUrl: item.imageUrl ?? "",
        refImageUrl: item.refImageUrl,
      });
      setMyFeatured((prev) => [created as InspirationCase, ...prev]);
      return created as InspirationCase;
    } catch {}
    return null;
  }, []);

  const removeFeatured = useCallback(async (id: string) => {
    try {
      await deleteFeaturedApi(id);
      setMyFeatured((prev) => prev.filter((i) => i.id !== id));
    } catch {}
  }, []);

  const updateFeaturedTitle = useCallback(async (id: string, title: string) => {
    try {
      await updateFeaturedTitleApi(id, title);
      setMyFeatured((prev) => prev.map((i) => i.id === id ? { ...i, title } : i));
    } catch {}
  }, []);

  const publishFeatured = useCallback(async (id: string) => {
    try {
      const updated = await publishFeaturedApi(id);
      setPublicFeatured((prev) => {
        if (prev.find((i) => i.id === id)) return prev;
        return [updated as InspirationCase, ...prev];
      });
      setAdminAll((prev) => prev.map((i) => i.id === id ? { ...i, isPublic: true } : i));
    } catch {}
  }, []);

  const unpublishFeatured = useCallback(async (id: string) => {
    try {
      await unpublishFeaturedApi(id);
      setPublicFeatured((prev) => prev.filter((i) => i.id !== id));
      setAdminAll((prev) => prev.map((i) => i.id === id ? { ...i, isPublic: false } : i));
    } catch {}
  }, []);

  return {
    publicFeatured,
    myFeatured,
    adminAll,
    loadAdminAll,
    addFeatured,
    removeFeatured,
    updateFeaturedTitle,
    publishFeatured,
    unpublishFeatured,
    // 保持向后兼容
    featured: [...publicFeatured, ...myFeatured],
  };
}
