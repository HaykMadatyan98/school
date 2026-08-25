"use client";

import { useMemo, useState } from "react";

export type ListPerson = {
  name: string;
  role?: string;
};

type Props = {
  people: ListPerson[];
  /** Shown in the count label, e.g. "անդամ" */
  unitLabel?: string;
};

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

/** Simple editable membership list (name + role) — used for parent council etc. */
export function PeopleList({ people, unitLabel = "անդամ" }: Props) {
  const [query, setQuery] = useState("");

  const normalized = useMemo(
    () =>
      people
        .map((p) => ({
          name: clean(p.name),
          role: p.role ? clean(p.role) : undefined,
        }))
        .filter((p) => p.name),
    [people],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.role && p.role.toLowerCase().includes(q)),
    );
  }, [normalized, query]);

  if (!normalized.length) return null;

  return (
    <div className="not-prose my-6 md:my-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[length:var(--text-sm)] text-ink-soft">
          <span className="font-semibold text-ink">{filtered.length}</span>
          <span className="mx-1 text-ink-soft/40">/</span>
          {normalized.length} {unitLabel}
        </p>
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">Որոնում</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Որոնել անունով…"
            className="input-school"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-white">
        <table className="w-full text-left text-[length:var(--text-sm)] md:text-[length:var(--text-base)]">
          <thead className="bg-mist/60 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-soft">
            <tr>
              <th className="w-10 px-3 py-3 sm:px-4">№</th>
              <th className="px-3 py-3 sm:px-4">Անուն, ազգանուն</th>
              <th className="px-3 py-3 sm:px-4">Դաս / պաշտոն</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((person, i) => (
              <tr
                key={`${person.name}-${person.role || ""}-${i}`}
                className="border-t border-[var(--line)] transition hover:bg-mist/40"
              >
                <td className="px-3 py-3 tabular-nums text-ink-soft sm:px-4">
                  {i + 1}
                </td>
                <td className="px-3 py-3 font-medium text-ink sm:px-4">
                  {person.name}
                </td>
                <td className="px-3 py-3 text-ink-soft sm:px-4">
                  {person.role || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!filtered.length ? (
        <p className="mt-4 text-center text-[length:var(--text-sm)] text-ink-soft">
          Որոնման արդյունք չի գտնվել։
        </p>
      ) : null}
    </div>
  );
}
