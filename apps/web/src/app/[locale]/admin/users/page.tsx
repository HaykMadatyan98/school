"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { api, ApiError, type Role, type User } from "@/lib/api";

export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const { token, user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "EDITOR" as Role,
  });

  async function load() {
    if (!token) return;
    const data = await api<User[]>("/users", { token });
    setUsers(data);
  }

  useEffect(() => {
    if (user?.role !== "ADMIN") {
      setError(t("adminOnly"));
      return;
    }
    void load().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError("");
    try {
      await api("/users", { method: "POST", token, body: form });
      setForm({ name: "", email: "", password: "", role: "EDITOR" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    }
  }

  async function remove(id: string) {
    if (!token || !confirm(t("confirmDeleteUser"))) return;
    await api(`/users/${id}`, { method: "DELETE", token });
    await load();
  }

  if (user?.role !== "ADMIN") {
    return <p className="text-ink-soft">{error || t("adminOnly")}</p>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-section-title text-ink">
        {t("users")}
      </h1>

      <form
        onSubmit={onSubmit}
        className="mt-6 grid gap-3 rounded-xl border border-[var(--line)] bg-white/80 p-5 sm:grid-cols-2"
      >
        <input
          required
          placeholder={t("name")}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-md border border-[var(--line)] px-3 py-2"
        />
        <input
          required
          type="email"
          placeholder={t("email")}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded-md border border-[var(--line)] px-3 py-2"
        />
        <input
          required
          type="password"
          placeholder={t("password")}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="rounded-md border border-[var(--line)] px-3 py-2"
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          className="rounded-md border border-[var(--line)] px-3 py-2"
        >
          <option value="EDITOR">{t("editor")}</option>
          <option value="ADMIN">{t("adminRole")}</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white sm:col-span-2 sm:w-fit"
        >
          {t("createUser")}
        </button>
        {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
      </form>

      <ul className="mt-6 divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-white/80">
        {users.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-ink-soft">
                {item.email} · {item.role}
              </p>
            </div>
            {item.id !== user.id && (
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="text-sm text-red-700 hover:underline"
              >
                {t("delete")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
