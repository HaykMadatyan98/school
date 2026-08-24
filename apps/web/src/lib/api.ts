import type { AppLocale } from "@/i18n/routing";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

export type Role = "ADMIN" | "EDITOR";
export type PostStatus = "DRAFT" | "PUBLISHED";

export type LocalizedText = {
  am: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt?: string;
};

export type Category = {
  id: string;
  name: LocalizedText | string;
  slug: string;
  description?: LocalizedText | string | null;
  _count?: { posts: number };
};

export type Post = {
  id: string;
  title: LocalizedText | string;
  slug: string;
  excerpt?: LocalizedText | string | null;
  content: LocalizedText | string;
  coverImage?: string | null;
  images?: string[];
  status: PostStatus;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  author?: { id: string; name: string; email: string };
  category?: {
    id: string;
    name: LocalizedText | string;
    slug: string;
    description?: LocalizedText | string | null;
  } | null;
  categoryId?: string | null;
};

export type Stats = {
  users: number;
  posts: number;
  published: number;
  drafts: number;
  categories: number;
  pages?: number;
  menuItems?: number;
  recentPosts: Array<{
    id: string;
    title: LocalizedText | string;
    status: PostStatus;
    updatedAt: string;
    slug: string;
  }>;
};

export type Page = {
  id: string;
  title: LocalizedText | string;
  slug: string;
  excerpt?: LocalizedText | string | null;
  content: LocalizedText | string;
  coverImage?: string | null;
  status: PostStatus;
  publishedAt?: string | null;
  parentSlug?: string | null;
  yearLabel?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MenuItem = {
  id: string;
  label: LocalizedText | string;
  href: string;
  order: number;
  visible: boolean;
  openInNewTab: boolean;
  parentId: string | null;
  children?: MenuItem[];
};

type FetchOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  cache?: RequestCache;
  tags?: string[];
  /** Next.js fetch revalidate (seconds). Ignored in the browser. */
  revalidate?: number | false;
  formData?: FormData;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function tLocal(
  value: LocalizedText | string | null | undefined,
  _locale?: AppLocale | string,
  fallback = "",
): string {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  const legacy = value as LocalizedText & { en?: string; ru?: string };
  return legacy.am || legacy.en || legacy.ru || fallback;
}

export function asLocalized(
  value: LocalizedText | string | null | undefined,
): LocalizedText {
  if (!value) return emptyLocalized();
  if (typeof value === "string") return { am: value };
  const legacy = value as LocalizedText & { en?: string; ru?: string };
  return { am: legacy.am || legacy.en || legacy.ru || "" };
}

export function extractDriveFileId(path?: string | null): string | null {
  if (!path) return null;
  const m =
    path.match(/\/uploads\/media\/drive\/([^/?#]+)/) ||
    path.match(/\/media\/drive\/([^/?#]+)/) ||
    path.match(/lh3\.googleusercontent\.com\/d\/([^/=?]+)/) ||
    path.match(/drive\.google\.com\/file\/d\/([^/]+)/) ||
    path.match(/[?&]id=([^&]+)/);
  return m?.[1] || null;
}

export function mediaUrl(path?: string | null) {
  if (!path) return "";
  // Stage: no external legacy CDN images
  if (/school78\.safe\.am|weebly|unsplash\.com/i.test(path)) return "";

  // Proxy Google Drive through API — browser hotlinking hits 429
  const driveId = extractDriveFileId(path);
  if (driveId) {
    return `${API_ORIGIN}/api/uploads/media/drive/${driveId}`;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const u = new URL(path);
      if (u.pathname.startsWith("/uploads/")) {
        return `${API_ORIGIN}${u.pathname}`;
      }
    } catch {
      /* keep as-is */
    }
    return path;
  }
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Download / open URL for PDFs (same proxy as images). */
export function mediaDownloadUrl(path?: string | null) {
  return mediaUrl(path);
}

export async function api<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const headers: HeadersInit = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (!options.formData) {
    headers["Content-Type"] = "application/json";
  }

  const next =
    options.tags || options.revalidate !== undefined
      ? {
          ...(options.tags ? { tags: options.tags } : {}),
          ...(options.revalidate !== undefined
            ? { revalidate: options.revalidate }
            : {}),
        }
      : undefined;

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.formData
      ? options.formData
      : options.body
        ? JSON.stringify(options.body)
        : undefined,
    cache: options.cache,
    next,
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const data = (await res.json()) as { message?: string | string[] };
      message = Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export async function uploadImage(file: File, token: string) {
  const formData = new FormData();
  formData.append("file", file);
  return api<{ url: string }>("/uploads", {
    method: "POST",
    token,
    formData,
  });
}

export function formatDate(value?: string | null, locale = "en") {
  if (!value) return "—";
  const localeMap: Record<string, string> = {
    en: "en-US",
    ru: "ru-RU",
    am: "hy-AM",
  };
  return new Intl.DateTimeFormat(localeMap[locale] || "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function emptyLocalized(): LocalizedText {
  return { am: "" };
}

export function isCompleteLocalized(value: LocalizedText) {
  return Boolean(value.am.trim());
}
