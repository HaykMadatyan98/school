import { cache } from "react";
import { api, ApiError, type Category, type MenuItem, type Page, type Post } from "@/lib/api";

/** Shared ISR window for public CMS reads. */
export const PUBLIC_REVALIDATE = 60;

export const getPublicMenu = cache(async (): Promise<MenuItem[]> => {
  try {
    return await api<MenuItem[]>("/menu", {
      revalidate: PUBLIC_REVALIDATE,
      tags: ["menu"],
    });
  } catch {
    return [];
  }
});

export const getPublishedPosts = cache(async (): Promise<Post[]> => {
  try {
    return await api<Post[]>("/posts", {
      revalidate: PUBLIC_REVALIDATE,
      tags: ["posts"],
    });
  } catch {
    return [];
  }
});

export const getCategories = cache(async (): Promise<Category[]> => {
  try {
    return await api<Category[]>("/categories", {
      revalidate: PUBLIC_REVALIDATE,
      tags: ["categories"],
    });
  } catch {
    return [];
  }
});

export const getPageBySlug = cache(async (slug: string): Promise<Page | null> => {
  try {
    return await api<Page>(`/pages/by-slug/${slug}`, {
      revalidate: PUBLIC_REVALIDATE,
      tags: ["pages", `page:${slug}`],
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
});

export const getPageYears = cache(async (parentSlug: string): Promise<Page[]> => {
  try {
    return await api<Page[]>(`/pages/years/${parentSlug}`, {
      revalidate: PUBLIC_REVALIDATE,
      tags: ["pages", `page-years:${parentSlug}`],
    });
  } catch {
    return [];
  }
});

export const getPostBySlug = cache(async (slug: string): Promise<Post | null> => {
  try {
    return await api<Post>(`/posts/by-slug/${slug}`, {
      revalidate: PUBLIC_REVALIDATE,
      tags: ["posts", `post:${slug}`],
    });
  } catch {
    return null;
  }
});

export const getPublishedPages = cache(async (): Promise<Page[]> => {
  try {
    return await api<Page[]>("/pages", {
      revalidate: PUBLIC_REVALIDATE,
      tags: ["pages"],
    });
  } catch {
    return [];
  }
});
