"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import {
  AdminPreviewPanel,
  ViewOnSiteLink,
} from "@/components/admin-preview";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useAuth } from "@/lib/auth";
import {
  api,
  ApiError,
  asLocalized,
  emptyLocalized,
  isCompleteLocalized,
  mediaUrl,
  tLocal,
  uploadImage,
  type Category,
  type LocalizedText,
  type Post,
  type PostStatus,
} from "@/lib/api";

type FormState = {
  title: LocalizedText;
  slug: string;
  excerpt: LocalizedText;
  content: LocalizedText;
  coverImage: string;
  images: string[];
  status: PostStatus;
  categoryId: string;
};

const empty: FormState = {
  title: emptyLocalized(),
  slug: "",
  excerpt: emptyLocalized(),
  content: emptyLocalized(),
  coverImage: "",
  images: [],
  status: "DRAFT",
  categoryId: "",
};

const fieldClass =
  "mt-1 w-full rounded-md border border-[var(--line)] bg-white/85 px-3 py-2 outline-none focus:border-accent";

export default function AdminPostEditorPage() {
  const t = useTranslations("admin");
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const { token } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(empty);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<Category[]>("/categories", { token }).then(setCategories).catch(() => {});
    if (!isNew) {
      api<Post>(`/posts/admin/${params.id}`, { token })
        .then((post) =>
          setForm({
            title: asLocalized(post.title),
            slug: post.slug,
            excerpt: asLocalized(post.excerpt),
            content: asLocalized(post.content),
            coverImage: post.coverImage || "",
            images: post.images || [],
            status: post.status,
            categoryId: post.category?.id || post.categoryId || "",
          }),
        )
        .catch((err: Error) => setError(err.message));
    }
  }, [token, isNew, params.id]);

  async function handleUpload(
    file: File,
    mode: "cover" | "gallery" | "insert",
  ) {
    if (!token) return;
    setUploading(true);
    setError("");
    try {
      const res = await uploadImage(file, token);
      if (mode === "cover") {
        setForm((prev) => ({ ...prev, coverImage: res.url }));
      } else if (mode === "gallery") {
        setForm((prev) => ({
          ...prev,
          images: [...prev.images, res.url],
        }));
      } else {
        const markdown = `\n\n![image](${res.url})\n\n`;
        setForm((prev) => ({
          ...prev,
          content: {
            ...prev.content,
            am: `${prev.content.am || ""}${markdown}`,
          },
          images: prev.images.includes(res.url)
            ? prev.images
            : [...prev.images, res.url],
        }));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (
      !isCompleteLocalized(form.title) ||
      !isCompleteLocalized(form.content)
    ) {
      setError(t("requiredAllLangs"));
      return;
    }
    if (form.excerpt.am.trim() && !isCompleteLocalized(form.excerpt)) {
      setError(t("requiredAllLangs"));
      return;
    }
    setPending(true);
    setError("");
    const body = {
      title: { am: form.title.am.trim() },
      slug: form.slug || undefined,
      excerpt: isCompleteLocalized(form.excerpt)
        ? { am: form.excerpt.am.trim() }
        : undefined,
      content: { am: form.content.am.trim() },
      coverImage: form.coverImage || undefined,
      images: form.images,
      status: form.status,
      categoryId: form.categoryId || undefined,
    };
    try {
      if (isNew) {
        await api("/posts", { method: "POST", token, body });
      } else {
        await api(`/posts/${params.id}`, { method: "PATCH", token, body });
      }
      router.push("/admin/posts");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-section-title text-ink">
          {isNew ? t("newPost") : t("edit")}
        </h1>
        <ViewOnSiteLink
          href={`/blog/${form.slug}`}
          published={form.status === "PUBLISHED"}
          hasSlug={Boolean(form.slug.trim())}
        />
      </div>

      <form onSubmit={onSubmit} className="mt-6 grid gap-4">
        <label className="block text-sm">
          {t("title")} *
          <input
            required
            value={form.title.am || ""}
            onChange={(e) =>
              setForm({
                ...form,
                title: { ...form.title, am: e.target.value },
              })
            }
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          {t("slug")}
          <input
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          {t("excerpt")}
          <textarea
            rows={2}
            value={form.excerpt.am || ""}
            onChange={(e) =>
              setForm({
                ...form,
                excerpt: { ...form.excerpt, am: e.target.value },
              })
            }
            className={fieldClass}
          />
        </label>
        <div>
          <p className="mb-2 text-sm font-medium">{t("content")} *</p>
          <RichTextEditor
            value={form.content.am || ""}
            onChange={(am) =>
              setForm((prev) => ({
                ...prev,
                content: { ...prev.content, am },
              }))
            }
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="cursor-pointer rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm hover:bg-mist">
            {t("uploadImage")}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading || !token}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file, "gallery");
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div>
          <p className="text-sm">{t("cover")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-ink-soft">
              {t("uploadCover")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading || !token}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file, "cover");
                  e.target.value = "";
                }}
              />
            </label>
            <input
              placeholder="https://…"
              value={form.coverImage}
              onChange={(e) =>
                setForm({ ...form, coverImage: e.target.value })
              }
              className={`${fieldClass} mt-0 max-w-md`}
            />
          </div>
          {form.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl(form.coverImage)}
              alt=""
              className="mt-3 h-40 w-full max-w-md rounded-lg object-cover"
            />
          )}
        </div>

        {form.images.length > 0 && (
          <div>
            <p className="text-sm">{t("gallery")}</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {form.images.map((src) => (
                <div key={src} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrl(src)}
                    alt=""
                    className="h-28 w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white"
                    onClick={() =>
                      setForm({
                        ...form,
                        images: form.images.filter((item) => item !== src),
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            {t("status")}
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as PostStatus })
              }
              className={fieldClass}
            >
              <option value="DRAFT">{t("draft")}</option>
              <option value="PUBLISHED">{t("published")}</option>
            </select>
          </label>
          <label className="block text-sm">
            {t("category")}
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className={fieldClass}
            >
              <option value="">{t("noCategory")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {typeof c.name === "string" ? c.name : tLocal(c.name)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}

        <AdminPreviewPanel
          title={form.title.am || ""}
          excerpt={form.excerpt.am || ""}
          content={form.content.am || ""}
        />

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-soft disabled:opacity-60"
          >
            {pending ? t("saving") : t("save")}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/posts")}
            className="rounded-md border border-[var(--line)] px-4 py-2.5 text-sm"
          >
            {t("cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
