import axios from "axios";
import { getStoredToken } from "@/contexts/AuthContext";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
});

// 每次请求动态注入 token + 昵称（共享账号场景下定位实际使用者）
api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  if (typeof window !== "undefined") {
    const nickname = localStorage.getItem("artflow_nickname");
    if (nickname) {
      config.headers["X-User-Nickname"] = nickname;
    }
  }
  return config;
});

// 401 时跳转登录页
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// 公共请求（不带 token），用于无需登录的接口
const publicApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
});

export interface Task {
  id: string;
  skill_id: string;
  user_id?: string | null;
  status: "pending" | "running" | "succeeded" | "failed" | "retrying";
  progress: number;
  input_params: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error_message: string | null;
  retry_count: number;
  created_by_ip: string | null;        // 提交时客户端 IP（共享账号追溯用）
  created_by_nickname: string | null;  // 用户自定义昵称
  ownerDisplayName?: string | null;
  ownerUsername?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskOwnerOption {
  id: string;
  displayName: string;
  username: string;
}

export interface TaskLog {
  id: number;
  task_id: string;
  level: string;
  message: string;
  source: string;
  created_at: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  authProvider?: "local" | "feishu";
  hasSofunnyKey?: boolean;
  sofunnyKeyMask?: string | null;
}

export const loginApi = (username: string, password: string) =>
  publicApi.post<{ token: string; user: AuthUser }>("/auth/login", { username, password }).then((r) => r.data);

export const getMeApi = () =>
  api.get<AuthUser>("/auth/me").then((r) => r.data);

export const getMeWithTokenApi = (token: string) =>
  publicApi.get<AuthUser>("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.data);

export const changePasswordApi = (oldPassword: string, newPassword: string) =>
  api.post<{ ok: boolean }>("/auth/change-password", {
    old_password: oldPassword,
    new_password: newPassword,
  }).then((r) => r.data);

export const saveSofunnyKeyApi = (apiKey: string) =>
  api.post<{ ok: boolean; mask: string; message: string; user: AuthUser }>("/auth/sofunny-key", {
    api_key: apiKey,
  }).then((r) => r.data);

export const deleteSofunnyKeyApi = () =>
  api.delete<{ ok: boolean; user: AuthUser }>("/auth/sofunny-key").then((r) => r.data);

export const getSkills = () => api.get<Skill[]>("/skills").then((r) => r.data);
export const getTasks = (params?: { search?: string; status?: string; skill_ids?: string; owner_filter?: string }) =>
  api.get<Task[]>("/tasks", { params: { limit: 50, ...params } }).then((r) => r.data);
export const getTaskOwners = () =>
  api.get<TaskOwnerOption[]>("/tasks/owners").then((r) => r.data);
export const getTask = (id: string) => api.get<Task>(`/tasks/${id}`).then((r) => r.data);
export const getTaskLogs = (id: string) => api.get<TaskLog[]>(`/tasks/${id}/logs`).then((r) => r.data);
export const retryTask = (id: string, mode: "normal" | "safety_rewrite" = "normal") =>
  api.post(`/tasks/${id}/retry`, { mode }).then((r) => r.data);
export const deleteTask = (id: string) => api.delete(`/tasks/${id}`).then((r) => r.data);
export const uploadFile = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api.post<{ file_id: string; path: string }>("/tasks/upload", form).then((r) => r.data);
};
export const createTask = (skill_id: string, params: Record<string, unknown>) =>
  api.post<{ task_id: string }>("/tasks", params, { params: { skill_id } }).then((r) => r.data);

// ── Inspiration: Custom Categories ────────────────────────────────────────────
export interface ApiCategory { key: string; label: string }
export const getCategories = () =>
  api.get<ApiCategory[]>("/inspiration/categories").then((r) => r.data);
export const addCategory = (key: string, label: string) =>
  api.post<ApiCategory>("/inspiration/categories", { key, label }).then((r) => r.data);
export const deleteCategory = (key: string) =>
  api.delete(`/inspiration/categories/${key}`).then((r) => r.data);
export const getProjectCategories = () =>
  publicApi.get<ApiCategory[]>("/inspiration/project-categories").then((r) => r.data);
export const addProjectCategory = (key: string, label: string) =>
  api.post<ApiCategory>("/inspiration/project-categories", { key, label }).then((r) => r.data);
export const deleteProjectCategory = (key: string) =>
  api.delete(`/inspiration/project-categories/${key}`).then((r) => r.data);

// ── Inspiration: Featured Cases ───────────────────────────────────────────────
export interface ApiFeatured {
  id: string; category: string; categoryLabel: string; title: string;
  author: string; prompt: string; imageUrl: string; refImageUrl?: string;
  isPublic: boolean; isFeatured: true; folder: string;
}

/** 公共精选（无需登录） */
export const getPublicFeatured = () =>
  publicApi.get<ApiFeatured[]>("/inspiration/featured").then((r) => r.data);

/** 当前用户私有收藏（需登录） */
export const getMyFeatured = () =>
  api.get<ApiFeatured[]>("/inspiration/featured/mine").then((r) => r.data);

export const addFeaturedApi = (item: Omit<ApiFeatured, "isFeatured" | "folder" | "isPublic">) =>
  api.post<ApiFeatured>("/inspiration/featured", {
    id: item.id, category: item.category, category_label: item.categoryLabel,
    title: item.title, author: item.author, prompt: item.prompt,
    image_url: item.imageUrl, ref_image_url: item.refImageUrl ?? null,
  }).then((r) => r.data);
export const updateFeaturedTitleApi = (id: string, title: string) =>
  api.patch(`/inspiration/featured/${id}/title`, { title }).then((r) => r.data);
export const deleteFeaturedApi = (id: string) =>
  api.delete(`/inspiration/featured/${id}`).then((r) => r.data);

/** 管理员：将用户私有精选推送为公共精选 */
export const publishFeaturedApi = (id: string) =>
  api.post(`/inspiration/featured/${id}/publish`).then((r) => r.data);

/** 管理员：取消公共精选 */
export const unpublishFeaturedApi = (id: string) =>
  api.delete(`/inspiration/featured/${id}/publish`).then((r) => r.data);

/** 管理员：查看所有用户的私有收藏 */
export interface AdminFeatured extends ApiFeatured { userId: string; ownerName: string }
export const getAdminAllFeatured = () =>
  api.get<AdminFeatured[]>("/admin/users/featured").then((r) => r.data);
