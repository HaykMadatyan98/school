"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAppLocale } from "@/components/locale-provider";
import { useMenu } from "@/components/menu-provider";
import { tLocal, type MenuItem } from "@/lib/api";
import { LOGO_SRC } from "@/lib/brand";

function isExternal(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

function MenuLink({
  item,
  locale,
  className,
  onNavigate,
  children,
}: {
  item: MenuItem;
  locale: string;
  className?: string;
  onNavigate?: () => void;
  children?: ReactNode;
}) {
  const label = tLocal(item.label, locale);
  const href = item.href || "#";
  const content = children ?? label;

  if (isExternal(href)) {
    return (
      <a
        href={href}
        target={item.openInNewTab ? "_blank" : undefined}
        rel={item.openInNewTab ? "noreferrer" : undefined}
        className={className}
        onClick={onNavigate}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href as "/"} className={className} onClick={onNavigate}>
      {content}
    </Link>
  );
}

function Chevron({ open }: { open?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={`h-2.5 w-2.5 shrink-0 opacity-70 transition ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DesktopNav({ items, locale }: { items: MenuItem[]; locale: string }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <nav
      className="flex w-full justify-center flex-wrap items-center gap-x-1 gap-y-0.5"
      aria-label="Main"
    >
      {items.map((item) => {
        const hasChildren = !!item.children?.length;
        const open = openId === item.id;
        const label = tLocal(item.label, locale);

        return (
          <div
            key={item.id}
            className="relative shrink-0"
            onMouseEnter={() => setOpenId(item.id)}
            onMouseLeave={() => setOpenId(null)}
          >
            <MenuLink
              item={item}
              locale={locale}
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-2 text-[0.8125rem] font-medium leading-none tracking-wide transition ${
                open
                  ? "bg-white/12 text-white"
                  : "text-white/85 hover:bg-white/10 hover:text-white"
              }`}
            >
              {label}
              {hasChildren ? <Chevron open={open} /> : null}
            </MenuLink>
            {hasChildren && open && (
              <div className="absolute left-0 top-full z-[60] min-w-[13.5rem] pt-1.5">
                <div className="max-h-[min(70vh,28rem)] overflow-y-auto overflow-x-hidden rounded-[var(--radius-md)] border border-white/10 bg-ink/95 py-1.5 shadow-xl backdrop-blur-md">
                  {item.children!.map((child) => (
                    <div key={child.id} className="group/sub relative">
                      <MenuLink
                        item={child}
                        locale={locale}
                        className="flex items-center justify-between gap-3 whitespace-nowrap px-3.5 py-2 text-[0.875rem] text-white/85 transition hover:bg-white/10 hover:text-white"
                      >
                        {tLocal(child.label, locale)}
                        {!!child.children?.length && (
                          <span className="text-white/45">›</span>
                        )}
                      </MenuLink>
                      {!!child.children?.length && (
                        <div className="invisible absolute left-full top-0 z-50 ml-1 min-w-[12.5rem] opacity-0 transition group-hover/sub:visible group-hover/sub:opacity-100">
                          <div className="max-h-[min(70vh,28rem)] overflow-y-auto rounded-[var(--radius-md)] border border-white/10 bg-ink/95 py-1.5 shadow-xl">
                            {child.children.map((grand) => (
                              <MenuLink
                                key={grand.id}
                                item={grand}
                                locale={locale}
                                className="block whitespace-nowrap px-3.5 py-2 text-[0.875rem] text-white/85 transition hover:bg-white/10 hover:text-white"
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function MobileNav({
  items,
  locale,
  onClose,
}: {
  items: MenuItem[];
  locale: string;
  onClose: () => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <nav className="flex max-h-[min(75vh,32rem)] flex-col gap-0.5 overflow-y-auto overscroll-contain">
      {items.map((item) => {
        const hasChildren = !!item.children?.length;
        const expanded = open[item.id];
        return (
          <div key={item.id}>
            <div className="flex items-center gap-1">
              <MenuLink
                item={item}
                locale={locale}
                onNavigate={onClose}
                className="flex-1 rounded-md px-3 py-2.5 text-sm text-white/90 hover:bg-white/10"
              />
              {hasChildren && (
                <button
                  type="button"
                  aria-label="Expand"
                  className="rounded-md px-3 py-2 text-white/70 hover:bg-white/10"
                  onClick={() =>
                    setOpen((s) => ({ ...s, [item.id]: !s[item.id] }))
                  }
                >
                  {expanded ? "−" : "+"}
                </button>
              )}
            </div>
            {hasChildren && expanded && (
              <div className="ml-3 border-l border-white/15 pl-2">
                {item.children!.map((child) => (
                  <div key={child.id}>
                    <MenuLink
                      item={child}
                      locale={locale}
                      onNavigate={onClose}
                      className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                    />
                    {!!child.children?.length && (
                      <div className="ml-3">
                        {child.children.map((grand) => (
                          <MenuLink
                            key={grand.id}
                            item={grand}
                            locale={locale}
                            onNavigate={onClose}
                            className="block rounded-md px-3 py-1.5 text-sm text-white/70 hover:bg-white/10"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

const fallbackMenu: MenuItem[] = [
  {
    id: "home",
    label: { am: "Գլխավոր" },
    href: "/",
    order: 0,
    visible: true,
    openInNewTab: false,
    parentId: null,
  },
  {
    id: "blog",
    label: { am: "Նորություններ" },
    href: "/blog",
    order: 1,
    visible: true,
    openInNewTab: false,
    parentId: null,
  },
  {
    id: "about",
    label: { am: "Մեր մասին" },
    href: "/p/about",
    order: 2,
    visible: true,
    openInNewTab: false,
    parentId: null,
  },
];

export function SiteHeader() {
  const t = useTranslations();
  const { locale } = useAppLocale();
  const [open, setOpen] = useState(false);
  const menuFromServer = useMenu();
  const menu = menuFromServer.length ? menuFromServer : fallbackMenu;

  return (
    <header className="site-header absolute inset-x-0 top-0 z-50">
      <div className="w-full flex flex-col items-center justify-center border-b border-white/10 bg-ink/80 backdrop-blur-md">
        <div className="w-full mx-auto px-[var(--space-page-x)]">
          <div className="flex w-full items-center justify-between gap-4 py-3 md:py-3.5">
            <Link href="/" className="group flex min-w-0 items-center gap-2.5 sm:gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={LOGO_SRC}
                alt="Դպրոց №78"
                className="h-11 w-auto shrink-0 object-contain drop-shadow-md sm:h-12"
              />
              <span className="flex min-w-0 flex-col">
                <span className="font-display text-[1.2rem] leading-none tracking-tight text-white sm:text-[1.35rem]">
                  {t("brand")}
                </span>
                <span className="mt-1 truncate text-[0.68rem] leading-snug text-white/70 transition group-hover:text-white/90 sm:text-[0.72rem]">
                  {t("tagline")}
                </span>
              </span>
            </Link>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/search"
                className="rounded-[var(--radius-sm)] border border-white/35 px-2.5 py-1.5 text-[0.78rem] font-medium text-white transition hover:bg-white/15 sm:px-3 sm:text-[0.8125rem]"
              >
                {t("nav.search")}
              </Link>
              <button
                type="button"
                aria-label="Menu"
                aria-expanded={open}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-white/35 text-white xl:hidden"
                onClick={() => setOpen((v) => !v)}
              >
                <span className="sr-only">Menu</span>
                <span className="flex flex-col gap-1.5">
                  <span
                    className={`block h-0.5 w-4 bg-white transition ${open ? "translate-y-2 rotate-45" : ""}`}
                  />
                  <span
                    className={`block h-0.5 w-4 bg-white transition ${open ? "opacity-0" : ""}`}
                  />
                  <span
                    className={`block h-0.5 w-4 bg-white transition ${open ? "-translate-y-2 -rotate-45" : ""}`}
                  />
                </span>
              </button>
            </div>
          </div>
        </div>
        <div className="hidden w-full items-center justify-center border-t border-white/10 py-1.5 xl:block">
            <DesktopNav items={menu} locale={locale} />
          </div>
      </div>

      {open && (
        <div className="border-b border-white/15 bg-ink/95 px-[var(--space-page-x)] py-3 backdrop-blur xl:hidden">
          <MobileNav
            items={menu}
            locale={locale}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const t = useTranslations();
  const phone = t("about.phone");
  const email = t("about.email");
  const address = t("about.address");

  return (
    <footer className="border-t border-[var(--line)] bg-white/50">
      <div className="mx-auto grid max-w-[var(--container)] gap-8 px-[var(--space-page-x)] py-10 text-[length:var(--text-sm)] text-ink-soft md:grid-cols-2 md:py-12">
        <div className="min-w-0">
          <p className="font-display text-[length:var(--text-lg)] text-ink">
            {t("brand")}
          </p>
          <p className="mt-2 max-w-sm leading-[var(--leading-relaxed)]">
            {t("footer.blurb")}
          </p>
          <p className="mt-4 text-[length:var(--text-xs)] sm:text-[length:var(--text-sm)]">
            © {new Date().getFullYear()} {t("footer.rights")}
          </p>
        </div>

        <div>
          <p className="text-eyebrow text-ink">{t("about.contacts")}</p>
          <address className="mt-3 not-italic leading-[var(--leading-relaxed)]">
            <p>{address}</p>
            <p className="mt-2">
              <a
                href={`tel:${phone.replace(/\s+/g, "")}`}
                className="text-ink transition hover:text-accent-deep"
              >
                {phone}
              </a>
            </p>
            <p className="mt-1">
              <a
                href={`mailto:${email}`}
                className="text-ink transition hover:text-accent-deep"
              >
                {email}
              </a>
            </p>
          </address>
        </div>
      </div>
    </footer>
  );
}
