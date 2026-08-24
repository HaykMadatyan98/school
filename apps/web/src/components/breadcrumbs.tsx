"use client";

import { Link } from "@/i18n/navigation";

export type Crumb = { label: string; href?: string };

type Props = {
  items: Crumb[];
  /** Light text for dark hero backgrounds */
  onDark?: boolean;
  className?: string;
};

export function Breadcrumbs({ items, onDark = false, className = "" }: Props) {
  if (!items.length) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`${onDark ? "mb-3" : "mb-6"} ${className}`.trim()}
    >
      <ol
        className={`flex flex-wrap items-center gap-1.5 text-[length:var(--text-sm)] ${
          onDark ? "text-white/65" : "text-ink-soft"
        }`}
      >
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li
              key={`${item.label}-${i}`}
              className="inline-flex items-center gap-1.5"
            >
              {i > 0 && (
                <span className={onDark ? "text-white/35" : "text-ink-soft/40"}>
                  /
                </span>
              )}
              {item.href && !last ? (
                <Link
                  href={item.href as "/"}
                  className={
                    onDark
                      ? "transition hover:text-white"
                      : "transition hover:text-accent-deep"
                  }
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={
                    last
                      ? onDark
                        ? "font-medium text-white/90"
                        : "font-medium text-ink"
                      : undefined
                  }
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
