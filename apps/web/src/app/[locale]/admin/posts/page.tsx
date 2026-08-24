"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api, formatDate, tLocal, type Post } from "@/lib/api";
import { useAppLocale } from "@/components/locale-provider";

export default function AdminPostsPage() {
  const t = useTranslations("admin");
  const { locale } = useAppLocale();

  const { token } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");

  async function load() {
    if (!token) return;
    try {
      const data = await api<Post[]>("/posts/admin/all", { token });
      setPosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function remove(id: string) {
    if (!token || !confirm(t("confirmDeletePost"))) return;
    await api(`/posts/${id}`, { method: "DELETE", token });
    await load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-section-title text-ink">
            {t("posts")}
          </h1>
          <p className="mt-1 text-ink-soft">{t("postsLead")}</p>
        </div>
        <Link
          href="/admin/posts/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep"
        >
          {t("create")}
        </Link>
      </div>

      {error && <p className="mt-4 text-red-700">{error}</p>}

      <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)] bg-white/80">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-mist/70 text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">{t("title")}</th>
              <th className="px-4 py-3 font-medium">{t("category")}</th>
              <th className="px-4 py-3 font-medium">{t("status")}</th>
              <th className="px-4 py-3 font-medium">{t("date")}</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-t border-[var(--line)]">
                <td className="px-4 py-3">{tLocal(post.title, locale)}</td>
                <td className="px-4 py-3">
                  {post.category
                    ? tLocal(post.category.name, locale)
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {post.status === "PUBLISHED" ? t("published") : t("draft")}
                </td>
                <td className="px-4 py-3">
                  {formatDate(post.publishedAt || post.updatedAt, locale)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {post.status === "PUBLISHED" && post.slug && (
                    <a
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mr-3 text-ink-soft hover:underline"
                    >
                      {t("viewOnSite")}
                    </a>
                  )}
                  <Link
                    href={`/admin/posts/${post.id}`}
                    className="mr-3 text-accent-deep hover:underline"
                  >
                    {t("edit")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(post.id)}
                    className="text-red-700 hover:underline"
                  >
                    {t("delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
