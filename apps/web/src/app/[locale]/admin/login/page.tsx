"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export default function AdminLoginPage() {
  const t = useTranslations("admin");
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@school.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await login(email, password);
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink px-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(217,119,6,0.28),transparent_45%),radial-gradient(circle_at_85%_80%,rgba(14,116,144,0.2),transparent_40%)]" />
      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-black/20"
      >
        <p className="text-xs uppercase tracking-[0.22em] text-ink-soft">
          {t("panel")}
        </p>
        <h1 className="mt-2 text-section-title text-ink">
          School 78
        </h1>
        <p className="mt-2 text-sm text-ink-soft">{t("loginLead")}</p>
        <label className="mt-6 block text-sm">
          {t("email")}
          <input
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-paper px-3 py-2 outline-none focus:border-accent"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>
        <label className="mt-4 block text-sm">
          {t("password")}
          <input
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-paper px-3 py-2 outline-none focus:border-accent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-soft disabled:opacity-60"
        >
          {pending ? t("signingIn") : t("signIn")}
        </button>
      </form>
    </div>
  );
}
