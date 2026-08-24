"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import {
  api,
  ApiError,
  emptyLocalized,
  isCompleteLocalized,
  tLocal,
  type Category,
  type LocalizedText,
} from "@/lib/api";
import { useAppLocale } from "@/components/locale-provider";

export default function AdminCategoriesPage() {
  const t = useTranslations("admin");
  const { locale } = useAppLocale();

  const { token } = useAuth();
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState<LocalizedText>(emptyLocalized());
  const [description, setDescription] = useState<LocalizedText>(emptyLocalized());
  const [error, setError] = useState("");

  async function load() {
    if (!token) return;
    const data = await api<Category[]>("/categories", { token });
    setItems(data);
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!isCompleteLocalized(name)) {
      setError(t("requiredAllLangs"));
      return;
    }
    if (description.am.trim() && !isCompleteLocalized(description)) {
      setError(t("requiredAllLangs"));
      return;
    }
    setError("");
    try {
      await api("/categories", {
        method: "POST",
        token,
        body: {
          name: { am: name.am.trim() },
          description: isCompleteLocalized(description)
            ? { am: description.am.trim() }
            : undefined,
        },
      });
      setName(emptyLocalized());
      setDescription(emptyLocalized());
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    }
  }

  async function remove(id: string) {
    if (!token || !confirm(t("confirmDeleteCategory"))) return;
    await api(`/categories/${id}`, { method: "DELETE", token });
    await load();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-section-title text-ink">
        {t("categories")}
      </h1>

      <form
        onSubmit={onSubmit}
        className="mt-4 grid gap-3 rounded-xl border border-[var(--line)] bg-white/80 p-4 sm:p-5"
      >
        <input
          required
          placeholder={`${t("name")} *`}
          value={name.am || ""}
          onChange={(e) => setName({ ...name, am: e.target.value })}
          className="rounded-md border border-[var(--line)] px-3 py-2"
        />
        <input
          placeholder={t("description")}
          value={description.am || ""}
          onChange={(e) =>
            setDescription({ ...description, am: e.target.value })
          }
          className="rounded-md border border-[var(--line)] px-3 py-2"
        />
        <button
          type="submit"
          className="w-fit rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
        >
          {t("add")}
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>

      <ul className="mt-6 divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-white/80">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div>
              <p className="font-medium">{tLocal(item.name, locale)}</p>
              <p className="text-sm text-ink-soft">
                /{item.slug}
                {typeof item._count?.posts === "number"
                  ? ` · ${item._count.posts}`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="text-sm text-red-700 hover:underline"
            >
              {t("delete")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
