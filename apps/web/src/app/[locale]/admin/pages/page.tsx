"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api, formatDate, tLocal, type Page } from "@/lib/api";
import { useAppLocale } from "@/components/locale-provider";

export default function AdminPagesPage() {
  const t = useTranslations("admin");
  const { locale } = useAppLocale();
  const { token } = useAuth();
  const [pages, setPages] = useState<Page[]>([]);
  const [error, setError] = useState("");

  async function load() {
    if (!token) return;
    try {
      setPages(await api<Page[]>("/pages/admin/all", { token }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function remove(id: string) {
    if (!token || !confirm(t("confirmDeletePage"))) return;
    await api(`/pages/${id}`, { method: "DELETE", token });
    await load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-section-title text-ink">
            {t("pages")}
          </h1>
          <p className="mt-1 text-ink-soft">{t("pagesLead")}</p>
        </div>
        <Link
          href="/admin/pages/new"
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
              <th className="px-4 py-3 font-medium">{t("slug")}</th>
              <th className="px-4 py-3 font-medium">{t("status")}</th>
              <th className="px-4 py-3 font-medium">{t("updated")}</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id} className="border-t border-[var(--line)]">
                <td className="px-4 py-3">{tLocal(page.title, locale)}</td>
                <td className="px-4 py-3 font-mono text-xs">/p/{page.slug}</td>
                <td className="px-4 py-3">
                  {page.status === "PUBLISHED" ? t("published") : t("draft")}
                </td>
                <td className="px-4 py-3">
                  {formatDate(page.updatedAt, locale)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {page.status === "PUBLISHED" && page.slug && (
                    <a
                      href={`/p/${page.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mr-3 text-ink-soft hover:underline"
                    >
                      {t("viewOnSite")}
                    </a>
                  )}
                  <Link
                    href={`/admin/pages/${page.id}`}
                    className="text-accent-deep hover:underline"
                  >
                    {t("edit")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void remove(page.id)}
                    className="ml-3 text-red-700 hover:underline"
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
