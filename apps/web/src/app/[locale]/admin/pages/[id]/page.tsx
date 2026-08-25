"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { ViewOnSiteLink } from "@/components/admin-preview";
import { RichTextEditor } from "@/components/rich-text-editor";
import { StaffCardsEditor } from "@/components/staff-cards-editor";
import { PageYearsEditor } from "@/components/page-years-editor";
import { useAuth } from "@/lib/auth";
import {
  mergeContentAndMedia,
  splitContentAndMedia,
  type PageImage,
  type PagePdf,
} from "@/lib/content-media";
import {
  isPeopleListPage,
  isStaffPageContent,
  parseStaffContent,
  serializeStaffContent,
  type StaffCard,
} from "@/lib/staff-content";
import {
  api,
  ApiError,
  asLocalized,
  emptyLocalized,
  mediaUrl,
  uploadImage,
  type LocalizedText,
  type Page,
  type PostStatus,
} from "@/lib/api";

type FormState = {
  title: LocalizedText;
  slug: string;
  excerpt: LocalizedText;
  text: string;
  images: PageImage[];
  pdfs: PagePdf[];
  coverImage: string;
  status: PostStatus;
  staffMode: boolean;
  staffIntro: string;
  staffPeople: StaffCard[];
  parentSlug: string;
  yearLabel: string;
  listMode: boolean;
};

type TabId = "text" | "media";

const empty: FormState = {
  title: emptyLocalized(),
  slug: "",
  excerpt: emptyLocalized(),
  text: "",
  images: [],
  pdfs: [],
  coverImage: "",
  status: "DRAFT",
  staffMode: false,
  staffIntro: "",
  staffPeople: [],
  parentSlug: "",
  yearLabel: "",
  listMode: false,
};

const fieldClass =
  "mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-[length:var(--text-base)] outline-none focus:border-accent";

function suggestSlug(title: string) {
  const map: Record<string, string> = {
    ա: "a",
    բ: "b",
    գ: "g",
    դ: "d",
    ե: "e",
    զ: "z",
    է: "e",
    ը: "y",
    թ: "t",
    ժ: "zh",
    ի: "i",
    լ: "l",
    խ: "kh",
    ծ: "ts",
    կ: "k",
    հ: "h",
    ձ: "dz",
    ղ: "gh",
    ճ: "ch",
    մ: "m",
    յ: "y",
    ն: "n",
    շ: "sh",
    ո: "o",
    չ: "ch",
    պ: "p",
    ջ: "j",
    ռ: "r",
    ս: "s",
    վ: "v",
    տ: "t",
    ր: "r",
    ց: "ts",
    ու: "u",
    փ: "p",
    ք: "q",
    և: "ev",
    օ: "o",
    ֆ: "f",
  };
  const lower = title.trim().toLowerCase();
  let out = "";
  for (let i = 0; i < lower.length; i++) {
    if (lower.slice(i, i + 2) === "ու") {
      out += "u";
      i++;
      continue;
    }
    const ch = lower[i];
    if (map[ch]) out += map[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else if (/\s|[-_/]/.test(ch)) out += "-";
  }
  return out
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export default function AdminPageEditor() {
  const t = useTranslations("admin");
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const { token } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(empty);
  const [tab, setTab] = useState<TabId>("text");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!token || isNew) return;
    api<Page>(`/pages/admin/${params.id}`, { token })
      .then((page) => {
        const content = asLocalized(page.content);
        const split = splitContentAndMedia(content.am || "");
        const staffMode = isStaffPageContent(split.text, page.slug);
        const listMode = isPeopleListPage(page.slug);
        const staff = staffMode
          ? parseStaffContent(split.text)
          : { intro: "", people: [] as StaffCard[] };
        setForm({
          title: asLocalized(page.title),
          slug: page.slug,
          excerpt: asLocalized(page.excerpt),
          text: staffMode ? "" : split.text,
          images: listMode ? [] : split.images,
          pdfs: split.pdfs,
          coverImage: page.coverImage || "",
          status: page.status,
          staffMode,
          staffIntro: staff.intro,
          staffPeople: staff.people,
          parentSlug: page.parentSlug || "",
          yearLabel: page.yearLabel || "",
          listMode,
        });
        setSlugTouched(true);
      })
      .catch((err: Error) => setError(err.message));
  }, [token, isNew, params.id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    const bodyText = form.staffMode
      ? serializeStaffContent(form.title.am, form.staffIntro, form.staffPeople)
      : form.text;
    const contentAm = mergeContentAndMedia(
      bodyText,
      form.listMode ? [] : form.images,
      form.pdfs,
    );
    if (!form.title.am.trim() || !contentAm.trim()) {
      setError(t("requiredAllLangs"));
      return;
    }
    if (form.staffMode && form.staffPeople.some((p) => !p.name.trim())) {
      setError(t("staffNameRequired"));
      return;
    }
    setPending(true);
    setError("");
    setSavedFlash(false);
    const slug =
      form.slug.trim() || suggestSlug(form.title.am) || `page-${Date.now()}`;
    const content = { am: contentAm };
    const body = {
      title: { am: form.title.am.trim() },
      slug,
      excerpt: form.excerpt.am.trim()
        ? { am: form.excerpt.am.trim() }
        : undefined,
      content,
      coverImage: form.coverImage || undefined,
      status: form.status,
    };
    try {
      if (isNew) {
        const created = await api<Page>("/pages", {
          method: "POST",
          token,
          body,
        });
        router.push(`/admin/pages/${created.id}`);
      } else {
        await api(`/pages/${params.id}`, {
          method: "PATCH",
          token,
          body,
        });
        setForm((f) => ({ ...f, slug }));
        setSavedFlash(true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  async function uploadFile(
    file: File | null,
    kind: "cover" | "image" | "pdf",
  ) {
    if (!file || !token) return;
    setUploading(true);
    setError("");
    try {
      const { url } = await uploadImage(file, token);
      if (kind === "cover") {
        setForm((f) => ({ ...f, coverImage: url }));
      } else if (kind === "image") {
        setForm((f) => ({
          ...f,
          images: [...f.images, { url, alt: "" }],
        }));
      } else {
        const label = file.name.replace(/\.pdf$/i, "") || t("editorPdfDefaultLabel");
        setForm((f) => ({
          ...f,
          pdfs: [...f.pdfs, { url, label }],
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("editorUploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    {
      id: "text",
      label: form.staffMode
        ? form.listMode
          ? t("sectionMembers")
          : t("sectionStaff")
        : t("sectionText"),
    },
    { id: "media", label: t("sectionMedia") },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-section-title text-ink">
            {isNew ? t("newPage") : t("editPage")}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{t("pageEditorLead")}</p>
        </div>
        <ViewOnSiteLink
          href={`/p/${form.slug}`}
          published={form.status === "PUBLISHED"}
          hasSlug={Boolean(form.slug.trim())}
        />
      </div>

      <div className="mt-6 flex gap-1 rounded-xl border border-[var(--line)] bg-mist/50 p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              tab === item.id
                ? "bg-white text-ink shadow-sm"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-6">
        {!isNew && token ? (
          <PageYearsEditor
            pageId={params.id}
            token={token}
            parentSlug={form.parentSlug || form.slug}
            isYearPage={Boolean(form.parentSlug)}
          />
        ) : null}

        {tab === "text" && (
          <section className="space-y-4 rounded-xl border border-[var(--line)] bg-white p-4 sm:p-5">
            <label className="block text-sm font-medium text-ink">
              {t("title")}
              <input
                className={fieldClass}
                value={form.title.am}
                onChange={(e) => {
                  const am = e.target.value;
                  setForm((f) => ({
                    ...f,
                    title: { ...f.title, am },
                    slug: !slugTouched && isNew ? suggestSlug(am) : f.slug,
                  }));
                }}
                required
                placeholder={t("titlePlaceholder")}
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              {t("excerpt")}
              <textarea
                className={fieldClass}
                rows={2}
                value={form.excerpt.am}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    excerpt: { ...f.excerpt, am: e.target.value },
                  }))
                }
                placeholder={t("excerptPlaceholder")}
              />
              <span className="mt-1 block text-xs font-normal text-ink-soft">
                {t("excerptHint")}
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--line)]"
                  checked={form.status === "PUBLISHED"}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.checked ? "PUBLISHED" : "DRAFT",
                    }))
                  }
                />
                {t("publishToggle")}
              </label>
              <span className="text-xs text-ink-soft">
                {form.status === "PUBLISHED"
                  ? t("publishedHint")
                  : t("draftHint")}
              </span>
            </div>

            <div>
              {form.staffMode ? (
                <StaffCardsEditor
                  intro={form.staffIntro}
                  people={form.staffPeople}
                  token={token}
                  listMode={form.listMode}
                  onIntroChange={(staffIntro) =>
                    setForm((f) => ({ ...f, staffIntro }))
                  }
                  onPeopleChange={(staffPeople) =>
                    setForm((f) => ({ ...f, staffPeople }))
                  }
                  onError={setError}
                />
              ) : (
                <>
                  <p className="mb-2 text-sm font-medium text-ink">
                    {t("content")}
                  </p>
                  <RichTextEditor
                    textOnly
                    value={form.text}
                    onChange={(text) => setForm((f) => ({ ...f, text }))}
                  />
                </>
              )}
            </div>
          </section>
        )}

        {tab === "media" && (
          <section className="space-y-8 rounded-xl border border-[var(--line)] bg-white p-4 sm:p-5">
            <div>
              <p className="text-sm font-medium text-ink">{t("cover")}</p>
              <p className="mt-1 text-xs text-ink-soft">{t("coverHint")}</p>
              <div className="mt-3 flex flex-wrap items-start gap-4">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-[var(--line)] bg-mist/40 px-4 py-3 text-sm text-ink hover:bg-mist">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) =>
                      void uploadFile(e.target.files?.[0] ?? null, "cover")
                    }
                  />
                  {uploading ? t("loading") : t("uploadCover")}
                </label>
                {form.coverImage && (
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mediaUrl(form.coverImage)}
                      alt=""
                      className="h-28 w-44 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      className="mt-2 text-xs text-red-700 hover:underline"
                      onClick={() =>
                        setForm((f) => ({ ...f, coverImage: "" }))
                      }
                    >
                      {t("removeCover")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-ink">{t("mediaPhotos")}</p>
              {form.staffMode ? (
                <p className="mt-1 text-xs text-ink-soft">{t("staffMediaPhotosHint")}</p>
              ) : (
                <>
              <p className="mt-1 text-xs text-ink-soft">{t("mediaPhotosHint")}</p>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-[var(--line)] bg-mist/40 px-4 py-3 text-sm text-ink hover:bg-mist">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    void uploadFile(e.target.files?.[0] ?? null, "image");
                    e.target.value = "";
                  }}
                />
                {uploading ? t("loading") : t("mediaAddPhoto")}
              </label>
                </>
              )}
              {form.images.length > 0 && (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {form.images.map((img, idx) => (
                    <li
                      key={`${img.url}-${idx}`}
                      className="overflow-hidden rounded-lg border border-[var(--line)] bg-mist/30"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={mediaUrl(img.url)}
                        alt={img.alt}
                        className="h-36 w-full object-cover"
                      />
                      <div className="flex items-center justify-between gap-2 px-2 py-2">
                        <span className="truncate text-xs text-ink-soft">
                          {t("mediaPhotoN", { n: idx + 1 })}
                        </span>
                        <button
                          type="button"
                          className="text-xs text-red-700 hover:underline"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              images: f.images.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          {t("delete")}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-ink">{t("mediaPdfs")}</p>
              <p className="mt-1 text-xs text-ink-soft">{t("mediaPdfsHint")}</p>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-[var(--line)] bg-mist/40 px-4 py-3 text-sm text-ink hover:bg-mist">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    void uploadFile(e.target.files?.[0] ?? null, "pdf");
                    e.target.value = "";
                  }}
                />
                {uploading ? t("loading") : t("mediaAddPdf")}
              </label>
              {form.pdfs.length > 0 && (
                <ul className="mt-4 divide-y divide-[var(--line)] rounded-lg border border-[var(--line)]">
                  {form.pdfs.map((pdf, idx) => (
                    <li
                      key={`${pdf.url}-${idx}`}
                      className="flex flex-wrap items-center gap-3 px-3 py-2.5"
                    >
                      <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-accent-deep">
                        PDF
                      </span>
                      <input
                        className="min-w-0 flex-1 rounded border border-[var(--line)] px-2 py-1 text-sm"
                        value={pdf.label}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            pdfs: f.pdfs.map((p, i) =>
                              i === idx
                                ? { ...p, label: e.target.value }
                                : p,
                            ),
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="text-xs text-red-700 hover:underline"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            pdfs: f.pdfs.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        {t("delete")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        <details className="rounded-xl border border-[var(--line)] bg-white/70 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-ink-soft">
            {t("advancedSettings")}
          </summary>
          <label className="mt-3 block text-sm font-medium text-ink">
            {t("slug")}
            <input
              className={fieldClass}
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((f) => ({ ...f, slug: e.target.value }));
              }}
              placeholder="about"
            />
            <span className="mt-1 block text-xs font-normal text-ink-soft">
              {t("slugHint")}
            </span>
          </label>
        </details>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {savedFlash && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {t("savedOk")}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pb-8">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-deep disabled:opacity-60"
          >
            {pending ? t("saving") : t("save")}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/pages")}
            className="rounded-md border border-[var(--line)] bg-white px-5 py-2.5 text-sm"
          >
            {t("cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
