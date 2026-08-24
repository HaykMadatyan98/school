"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api, formatDate, tLocal, type Stats } from "@/lib/api";
import { useAppLocale } from "@/components/locale-provider";

type DriveStatus = {
  configured: boolean;
  authMode: string | null;
  folderId: string | null;
  hasOAuthClient: boolean;
  hasRefreshToken: boolean;
  callbackUrl: string;
};

export default function AdminDashboardPage() {
  const t = useTranslations("admin");
  const { locale } = useAppLocale();

  const { token, user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [drive, setDrive] = useState<DriveStatus | null>(null);
  const [error, setError] = useState("");
  const [driveBusy, setDriveBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<Stats>("/stats", { token })
      .then(setStats)
      .catch((err: Error) => setError(err.message));
    api<DriveStatus>("/uploads/google/status", { token })
      .then(setDrive)
      .catch(() => setDrive(null));
  }, [token]);

  async function connectDrive() {
    if (!token) return;
    setDriveBusy(true);
    try {
      const { url } = await api<{ url: string }>("/uploads/google/auth-url", {
        token,
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drive connect failed");
      setDriveBusy(false);
    }
  }

  if (error && !stats) return <p className="text-red-700">{error}</p>;
  if (!stats) return <p className="text-ink-soft">{t("loading")}</p>;

  const cards = [
    { label: t("statsPosts"), value: stats.posts },
    { label: t("statsPublished"), value: stats.published },
    { label: t("statsPages"), value: stats.pages ?? 0 },
    { label: t("statsMenu"), value: stats.menuItems ?? 0 },
    { label: t("statsCategories"), value: stats.categories },
    { label: t("statsUsers"), value: stats.users },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-section-title text-ink">{t("overview")}</h1>
          <p className="mt-1 text-ink-soft">{t("overviewLead")}</p>
        </div>
        <Link
          href="/admin/posts/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep"
        >
          {t("newPost")}
        </Link>
      </div>

      {drive && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white/80 px-4 py-4">
          <div>
            <p className="text-sm font-medium text-ink">{t("driveTitle")}</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {drive.configured
                ? t("driveConnected", { mode: drive.authMode || "oauth" })
                : t("driveDisconnected")}
            </p>
            {error ? <p className="mt-1 text-sm text-red-700">{error}</p> : null}
          </div>
          {user?.role === "ADMIN" && !drive.configured ? (
            <button
              type="button"
              disabled={driveBusy || !drive.hasOAuthClient}
              onClick={() => void connectDrive()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-60"
            >
              {driveBusy ? t("saving") : t("driveConnect")}
            </button>
          ) : null}
        </div>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-[var(--line)] bg-white/80 px-4 py-5"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">
              {card.label}
            </p>
            <p className="mt-2 text-section-title text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-section-title text-ink">{t("recent")}</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-white/80">
          <table className="w-full text-left text-sm">
            <thead className="bg-mist/70 text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">{t("title")}</th>
                <th className="px-4 py-3 font-medium">{t("status")}</th>
                <th className="px-4 py-3 font-medium">{t("updated")}</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentPosts.map((post) => (
                <tr key={post.id} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/posts/${post.id}`}
                      className="hover:text-accent-deep"
                    >
                      {tLocal(post.title, locale)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {post.status === "PUBLISHED" ? t("published") : t("draft")}
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(post.updatedAt, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
