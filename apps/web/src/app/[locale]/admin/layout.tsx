"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin");
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";

  const nav = [
    { href: "/admin", label: t("overview") },
    { href: "/admin/posts", label: t("posts") },
    { href: "/admin/pages", label: t("pages") },
    { href: "/admin/menu", label: t("menu") },
    { href: "/admin/categories", label: t("categories") },
    { href: "/admin/users", label: t("users") },
  ];

  useEffect(() => {
    if (!loading && !user && !isLogin) {
      router.replace("/admin/login");
    }
    if (!loading && user && isLogin) {
      router.replace("/admin");
    }
  }, [loading, user, isLogin, router]);

  if (isLogin) {
    return <>{children}</>;
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-soft">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-[var(--line)] bg-ink text-white md:min-h-screen md:border-b-0 md:border-r md:border-ink-soft/30">
        <div className="px-5 py-6">
          <Link
            href="/"
            className="text-section-title"
          >
            School 78
          </Link>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/55">
            {t("panel")}
          </p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 md:flex-col">
          {nav.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm whitespace-nowrap ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden border-t border-white/10 px-5 py-4 md:block">
          <p className="text-sm">{user.name}</p>
          <p className="text-xs text-white/55">{user.role}</p>
          <button
            type="button"
            onClick={() => {
              logout();
              router.push("/admin/login");
            }}
            className="mt-3 text-sm text-amber-300 hover:underline"
          >
            {t("logout")}
          </button>
        </div>
      </aside>
      <div>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-white/60 px-4 py-3 backdrop-blur sm:px-5 sm:py-4 md:px-8">
          <p className="text-sm text-ink-soft">{t("editorial")}</p>
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => {
                logout();
                router.push("/admin/login");
              }}
              className="text-sm text-accent-deep md:hidden"
            >
              {t("logout")}
            </button>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-5 sm:py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
