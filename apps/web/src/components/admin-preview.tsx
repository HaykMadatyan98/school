"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { renderContent } from "@/components/content";
import { mediaUrl } from "@/lib/api";

export function AdminPreviewPanel({
  title,
  excerpt,
  content,
}: {
  title: string;
  excerpt?: string;
  content: string;
}) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-white/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-ink"
      >
        <span>{t("preview")}</span>
        <span className="text-ink-soft">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--line)] px-4 py-5">
          {!title.trim() && !content.trim() ? (
            <p className="text-sm text-ink-soft">{t("previewEmpty")}</p>
          ) : (
            <article>
              {title.trim() && (
                <h2 className="text-section-title text-ink">
                  {title}
                </h2>
              )}
              {excerpt?.trim() && (
                <p className="mt-2 text-ink-soft">{excerpt}</p>
              )}
              <div className="prose-school mt-4">
                {renderContent(content, mediaUrl)}
              </div>
            </article>
          )}
        </div>
      )}
    </div>
  );
}

export function ViewOnSiteLink({
  href,
  published,
  hasSlug,
}: {
  href: string;
  published: boolean;
  hasSlug: boolean;
}) {
  const t = useTranslations("admin");

  if (!hasSlug) {
    return (
      <span className="text-sm text-ink-soft" title={t("viewNeedsSlug")}>
        {t("viewOnSite")}
      </span>
    );
  }

  if (!published) {
    return (
      <span className="text-sm text-ink-soft" title={t("viewNeedsPublish")}>
        {t("viewOnSite")}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-md border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-mist"
    >
      {t("viewOnSite")} ↗
    </a>
  );
}
