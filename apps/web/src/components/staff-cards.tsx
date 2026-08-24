"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { normalizeStaffBio } from "@/lib/staff-content";

export type StaffPerson = {
  name: string;
  role?: string;
  bio?: string;
  photo: string;
};

type Props = {
  people: StaffPerson[];
};

type BioBlock = { label?: string; lines: string[] };

function decodeHtml(s: string) {
  return s
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&amp;/gi, "&")
    .replace(/&gt;/gi, ">")
    .replace(/&lt;/gi, "<")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function cleanText(s: string) {
  return decodeHtml(s)
    .replace(/[`´]/g, "")
    .replace(/\s*[>]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split scraped Weebly bio walls into readable labeled sections. */
export function formatStaffBio(raw: string): BioBlock[] {
  let text = cleanText(raw);
  if (!text) return [];

  // Insert breaks before common Armenian CV headers
  const headers = [
    "Ծնվել է",
    "Ծննդյան տարեթիվ",
    "Ծննդավայր",
    "Ծնված",
    "Կրթություն",
    "Աշխատանքային գործունեություն",
    "Աշխատանքային փորձ",
    "Աշխատանք՝",
    "Աշխատանք:",
  ];
  const displayLabel: Record<string, string> = {
    "Ծննդյան տարեթիվ": "Ծնվել է",
    Ծննդավայր: "Ծնվել է",
    Ծնված: "Ծնվել է",
    "Աշխատանքային գործունեություն": "Աշխատանք",
    "Աշխատանքային փորձ": "Աշխատանք",
    "Աշխատանք՝": "Աշխատանք",
    "Աշխատանք:": "Աշխատանք",
  };
  for (const h of headers) {
    text = text.replace(new RegExp(`(?<!^)\\s*(${h})`, "gi"), "\n|||$1");
  }
  // Break work history year ranges onto new lines
  text = text.replace(/\s+(\d{4})\s*[-–—]\s*(\d{4}|ներկա|ից)\s*/g, "\n$1–$2 ");

  const chunks = text
    .split(/\n+/)
    .map((c) => c.replace(/^\|\|\|/, "").trim())
    .filter(Boolean);

  const blocks: BioBlock[] = [];
  for (const chunk of chunks) {
    const header = headers.find((h) =>
      chunk.toLowerCase().startsWith(h.toLowerCase()),
    );
    if (header) {
      const rest = chunk.slice(header.length).replace(/^[\s:՝`]+/, "").trim();
      // Further split long work history by years already broken
      const lines = rest
        ? rest.split(/\n+/).map((l) => l.trim()).filter(Boolean)
        : [];
      blocks.push({
        label: displayLabel[header] || header,
        lines: lines.length ? lines : [],
      });
    } else {
      const last = blocks[blocks.length - 1];
      if (last && last.label) {
        last.lines.push(chunk);
      } else {
        blocks.push({ lines: [chunk] });
      }
    }
  }

  return blocks.filter((b) => b.lines.length > 0 || b.label);
}

function bioPreview(blocks: BioBlock[], maxLen = 140) {
  const flat = blocks
    .map((b) => (b.label ? `${b.label}՝ ${b.lines.join(" ")}` : b.lines.join(" ")))
    .join(" ");
  if (flat.length <= maxLen) return flat;
  return `${flat.slice(0, maxLen).replace(/\s+\S*$/, "")}…`;
}

function BioRich({ blocks }: { blocks: BioBlock[] }) {
  if (!blocks.length) return null;
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => (
        <div key={i}>
          {b.label ? (
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
              {b.label}
            </p>
          ) : null}
          <ul
            className={
              b.lines.length > 1
                ? "mt-1.5 space-y-1.5"
                : "mt-1.5"
            }
          >
            {b.lines.map((line, j) => (
              <li
                key={j}
                className="text-[0.95rem] leading-relaxed text-ink-soft"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function normalizePerson(raw: StaffPerson): StaffPerson {
  const name = cleanText(raw.name || "")
    .replace(/^\d{1,3}\s+/, "")
    .trim();
  const role = cleanText(raw.role || "").trim();
  const bio = raw.bio ? normalizeStaffBio(cleanText(raw.bio)) : undefined;
  return {
    ...raw,
    name: name || "Աշխատակից",
    role: role || undefined,
    bio: bio || undefined,
    photo: raw.photo?.trim() || "",
  };
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function Avatar({
  person,
  className = "",
}: {
  person: StaffPerson;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(person.photo) && !failed;

  return (
    <div className={`relative overflow-hidden bg-[#d7e5ec] ${className}`}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.photo}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover object-[center_18%]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#c5d8e2] to-[#9eb9c8] text-3xl font-semibold tracking-wide text-white/85">
          {initials(person.name)}
        </div>
      )}
    </div>
  );
}

export function StaffCards({ people }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const normalized = useMemo(() => people.map(normalizePerson), [people]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.role && p.role.toLowerCase().includes(q)) ||
        (p.bio && p.bio.toLowerCase().includes(q)),
    );
  }, [normalized, query]);

  const active = open !== null ? normalized[open] : null;
  const activeBlocks = useMemo(
    () => (active?.bio ? formatStaffBio(active.bio) : []),
    [active],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!people.length) return null;

  return (
    <div className="not-prose my-6 md:my-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[length:var(--text-sm)] text-ink-soft">
          <span className="font-semibold text-ink">{filtered.length}</span>
          <span className="mx-1 text-ink-soft/40">/</span>
          {normalized.length} աշխատակից
        </p>
        <label className="relative block w-full sm:max-w-sm">
          <span className="sr-only">Որոնում</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Որոնել անունով կամ պաշտոնով…"
            className="input-school"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
        {filtered.map((person) => {
          const idx = normalized.indexOf(person);
          const blocks = person.bio ? formatStaffBio(person.bio) : [];
          const preview = blocks.length ? bioPreview(blocks, 160) : "";

          return (
            <article
              key={`${person.name}-${idx}`}
              className="group flex flex-col overflow-hidden rounded-[1.05rem] border border-[var(--line)] bg-white shadow-[0_12px_40px_-28px_rgba(12,36,56,0.55)] transition duration-300 hover:-translate-y-0.5 hover:border-accent/25 hover:shadow-[0_18px_48px_-24px_rgba(12,36,56,0.48)] sm:min-h-0"
            >
              <Avatar
                person={person}
                className="aspect-[4/3] w-full shrink-0 sm:aspect-[5/4]"
              />

              <div className="flex min-w-0 flex-1 flex-col px-4 py-4 sm:px-5 sm:py-5">
                <h3 className="text-[1.05rem] font-semibold leading-snug tracking-tight text-ink md:text-[1.1rem]">
                  {person.name}
                </h3>
                {person.role ? (
                  <p className="mt-1.5 text-[0.8125rem] font-medium leading-snug text-accent-deep">
                    {person.role}
                  </p>
                ) : null}

                {preview ? (
                  <>
                    <p className="mt-3 line-clamp-4 flex-1 text-[0.875rem] leading-relaxed text-ink-soft">
                      {preview}
                    </p>
                    <button
                      type="button"
                      onClick={() => setOpen(idx)}
                      className="mt-3 self-start text-[0.8125rem] font-semibold text-ink underline-offset-2 hover:underline"
                    >
                      Ավելին
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {!filtered.length ? (
        <p className="mt-6 text-center text-[length:var(--text-sm)] text-ink-soft">
          Որոնման արդյունք չի գտնվել։
        </p>
      ) : null}

      {active && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/55 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(null)}
          role="dialog"
          aria-modal
        >
          <div
            className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[1.2rem] border border-[var(--line)] bg-white p-4 shadow-2xl sm:max-h-[88vh] sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-start">
              <Avatar
                person={active}
                className="mx-auto aspect-square h-28 w-28 shrink-0 rounded-[1rem] sm:mx-0 sm:h-28 sm:w-28"
              />
              <div className="min-w-0 flex-1 text-center sm:pt-1 sm:text-left">
                <h3 className="text-[1.15rem] font-semibold leading-snug text-ink sm:text-[1.25rem]">
                  {active.name}
                </h3>
                {active.role ? (
                  <p className="mt-2 text-[0.875rem] font-medium leading-snug text-accent-deep sm:text-[0.9rem]">
                    {active.role}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="absolute right-3 top-3 h-9 w-9 shrink-0 rounded-md text-ink-soft hover:bg-mist sm:static sm:right-auto sm:top-auto"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="pt-5">
              <BioRich blocks={activeBlocks} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Optional lead text above staff grid (intro without duplicate H2). */
export function StaffPageLead({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 max-w-3xl text-[length:var(--text-base)] leading-[var(--leading-relaxed)] text-ink-soft md:text-[length:var(--text-lg)]">
      {children}
    </p>
  );
}
