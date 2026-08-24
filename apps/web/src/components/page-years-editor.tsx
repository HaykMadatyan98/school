"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { api, ApiError, type Page, type PostStatus } from "@/lib/api";

type Props = {
  pageId: string;
  token: string;
  parentSlug: string;
  isYearPage: boolean;
};

export function PageYearsEditor({
  pageId,
  token,
  parentSlug,
  isYearPage,
}: Props) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [years, setYears] = useState<Page[]>([]);
  const [yearInput, setYearInput] = useState("");
  const [publishNew, setPublishNew] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function load() {
    try {
      const list = await api<Page[]>(`/pages/admin/${pageId}/years`, { token });
      setYears(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, token]);

  if (isYearPage) {
    return (
      <div className="rounded-xl border border-[var(--line)] bg-mist/30 px-4 py-3 text-sm text-ink-soft">
        {t("yearPageHint", { parent: parentSlug })}{" "}
        <Link
          href={`/admin/pages`}
          className="font-medium text-accent-deep hover:underline"
        >
          {t("pages")}
        </Link>
      </div>
    );
  }

  async function addYear() {
    if (!yearInput.trim()) return;
    setPending(true);
    setError("");
    try {
      const created = await api<Page>(`/pages/${pageId}/years`, {
        method: "POST",
        token,
        body: {
          yearLabel: yearInput.trim(),
          status: (publishNew ? "PUBLISHED" : "DRAFT") as PostStatus,
        },
      });
      setYearInput("");
      await load();
      router.push(`/admin/pages/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("yearAddFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-[var(--line)] bg-white p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">{t("yearsTitle")}</h2>
        <p className="mt-1 text-xs text-ink-soft">{t("yearsLead")}</p>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[10rem] flex-1 text-sm font-medium text-ink">
          {t("yearLabel")}
          <input
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-accent"
            value={yearInput}
            onChange={(e) => setYearInput(e.target.value)}
            placeholder={t("yearPlaceholder")}
          />
          <span className="mt-1 block text-xs font-normal text-ink-soft">
            {t("yearFormatHint")}
          </span>
        </label>
        <label className="inline-flex items-center gap-2 pb-2.5 text-sm text-ink">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-[var(--line)]"
            checked={publishNew}
            onChange={(e) => setPublishNew(e.target.checked)}
          />
          {t("yearPublish")}
        </label>
        <button
          type="button"
          disabled={pending || !yearInput.trim()}
          onClick={() => void addYear()}
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-60"
        >
          {pending ? t("saving") : t("yearAdd")}
        </button>
      </div>

      {years.length === 0 ? (
        <p className="text-sm text-ink-soft">{t("yearsEmpty")}</p>
      ) : (
        <ul className="divide-y divide-[var(--line)] rounded-lg border border-[var(--line)]">
          {years.map((y) => (
            <li
              key={y.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
            >
              <div>
                <p className="font-medium text-ink">{y.yearLabel || y.slug}</p>
                <p className="font-mono text-xs text-ink-soft">/p/{y.slug}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-ink-soft">
                  {y.status === "PUBLISHED" ? t("published") : t("draft")}
                </span>
                <Link
                  href={`/admin/pages/${y.id}`}
                  className="font-medium text-accent-deep hover:underline"
                >
                  {t("edit")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
