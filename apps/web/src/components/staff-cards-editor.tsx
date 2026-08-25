"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { mediaUrl, uploadImage } from "@/lib/api";
import {
  emptyStaffCard,
  type StaffCard,
} from "@/lib/staff-content";

const fieldClass =
  "mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-[length:var(--text-base)] outline-none focus:border-accent";

type Props = {
  intro: string;
  people: StaffCard[];
  token: string | null;
  /** Name + role only (parent council etc.) */
  listMode?: boolean;
  onIntroChange: (intro: string) => void;
  onPeopleChange: (people: StaffCard[]) => void;
  onError: (message: string) => void;
};

export function StaffCardsEditor({
  intro,
  people,
  token,
  listMode = false,
  onIntroChange,
  onPeopleChange,
  onError,
}: Props) {
  const t = useTranslations("admin");
  const [openId, setOpenId] = useState<string | null>(people[0]?.id ?? null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function updatePerson(id: string, patch: Partial<StaffCard>) {
    onPeopleChange(
      people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  function addPerson() {
    const card = emptyStaffCard();
    onPeopleChange([...people, card]);
    setOpenId(card.id);
  }

  function removePerson(id: string) {
    if (!confirm(t("staffDeleteConfirm"))) return;
    const next = people.filter((p) => p.id !== id);
    onPeopleChange(next);
    if (openId === id) setOpenId(next[0]?.id ?? null);
  }

  function movePerson(id: string, dir: -1 | 1) {
    const idx = people.findIndex((p) => p.id === id);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= people.length) return;
    const next = [...people];
    const tmp = next[idx];
    next[idx] = next[nextIdx];
    next[nextIdx] = tmp;
    onPeopleChange(next);
  }

  async function uploadPhoto(id: string, file: File | null) {
    if (!file || !token) return;
    setUploadingId(id);
    onError("");
    try {
      const { url } = await uploadImage(file, token);
      updatePerson(id, { photo: url });
    } catch (err) {
      onError(err instanceof Error ? err.message : t("editorUploadFailed"));
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--line)] bg-mist/40 px-4 py-3 text-sm text-ink-soft">
        {listMode ? t("membersEditorLead") : t("staffEditorLead")}
      </div>

      <label className="block text-sm font-medium text-ink">
        {t("staffIntro")}
        <textarea
          className={fieldClass}
          rows={2}
          value={intro}
          onChange={(e) => onIntroChange(e.target.value)}
          placeholder={t("staffIntroPlaceholder")}
        />
        <span className="mt-1 block text-xs font-normal text-ink-soft">
          {t("staffIntroHint")}
        </span>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">
          {listMode ? t("membersPeople") : t("staffPeople")}{" "}
          <span className="font-normal text-ink-soft">({people.length})</span>
        </p>
        <button
          type="button"
          onClick={addPerson}
          className="rounded-md bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:bg-accent-deep"
        >
          {listMode ? t("membersAdd") : t("staffAdd")}
        </button>
      </div>

      {!people.length ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] bg-white px-4 py-8 text-center text-sm text-ink-soft">
          {listMode ? t("membersEmpty") : t("staffEmpty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {people.map((person, index) => {
            const open = openId === person.id;
            return (
              <li
                key={person.id}
                className="overflow-hidden rounded-xl border border-[var(--line)] bg-white"
              >
                <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
                  {!listMode ? (
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-mist">
                      {person.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaUrl(person.photo)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-ink-soft">
                          —
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-mist text-xs font-semibold text-ink-soft">
                      {index + 1}
                    </span>
                  )}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setOpenId(open ? null : person.id)}
                  >
                    <p className="truncate font-medium text-ink">
                      {person.name || t("staffNamePlaceholder")}
                    </p>
                    <p className="truncate text-xs text-ink-soft">
                      {person.role ||
                        (listMode
                          ? t("membersRolePlaceholder")
                          : t("staffRolePlaceholder"))}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      className="h-8 w-8 rounded text-ink-soft hover:bg-mist disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => movePerson(person.id, -1)}
                      title={t("menuMoveUp")}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="h-8 w-8 rounded text-ink-soft hover:bg-mist disabled:opacity-30"
                      disabled={index === people.length - 1}
                      onClick={() => movePerson(person.id, 1)}
                      title={t("menuMoveDown")}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-sm text-accent-deep hover:underline"
                      onClick={() => setOpenId(open ? null : person.id)}
                    >
                      {open ? t("staffCollapse") : t("edit")}
                    </button>
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-sm text-red-700 hover:underline"
                      onClick={() => removePerson(person.id)}
                    >
                      {t("delete")}
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="space-y-3 border-t border-[var(--line)] bg-mist/20 px-3 py-4 sm:px-4">
                    {!listMode ? (
                      <div className="flex flex-wrap gap-4">
                        <div className="h-28 w-28 overflow-hidden rounded-xl bg-white">
                          {person.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={mediaUrl(person.photo)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-ink-soft">
                              {t("staffNoPhoto")}
                            </div>
                          )}
                        </div>
                        <div className="flex min-w-[12rem] flex-1 flex-col justify-center gap-2">
                          <input
                            ref={(el) => {
                              fileRefs.current[person.id] = el;
                            }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              void uploadPhoto(
                                person.id,
                                e.target.files?.[0] || null,
                              );
                              e.target.value = "";
                            }}
                          />
                          <button
                            type="button"
                            disabled={uploadingId === person.id || !token}
                            onClick={() =>
                              fileRefs.current[person.id]?.click()
                            }
                            className="w-fit rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium hover:bg-mist disabled:opacity-60"
                          >
                            {uploadingId === person.id
                              ? t("editorUploading")
                              : person.photo
                                ? t("staffChangePhoto")
                                : t("staffAddPhoto")}
                          </button>
                          {person.photo ? (
                            <button
                              type="button"
                              className="w-fit text-sm text-red-700 hover:underline"
                              onClick={() =>
                                updatePerson(person.id, { photo: "" })
                              }
                            >
                              {t("staffRemovePhoto")}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <label className="block text-sm font-medium text-ink">
                      {t("staffName")}
                      <input
                        className={fieldClass}
                        value={person.name}
                        onChange={(e) =>
                          updatePerson(person.id, { name: e.target.value })
                        }
                        placeholder={t("staffNamePlaceholder")}
                      />
                    </label>

                    <label className="block text-sm font-medium text-ink">
                      {listMode ? t("membersRole") : t("staffRole")}
                      <input
                        className={fieldClass}
                        value={person.role}
                        onChange={(e) =>
                          updatePerson(person.id, { role: e.target.value })
                        }
                        placeholder={
                          listMode
                            ? t("membersRolePlaceholder")
                            : t("staffRolePlaceholder")
                        }
                      />
                    </label>

                    {!listMode ? (
                      <label className="block text-sm font-medium text-ink">
                        {t("staffBio")}
                        <textarea
                          className={fieldClass}
                          rows={5}
                          value={person.bio}
                          onChange={(e) =>
                            updatePerson(person.id, { bio: e.target.value })
                          }
                          placeholder={t("staffBioPlaceholder")}
                        />
                        <span className="mt-1 block text-xs font-normal text-ink-soft">
                          {t("staffBioHint")}
                        </span>
                      </label>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
