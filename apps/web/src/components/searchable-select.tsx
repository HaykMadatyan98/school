"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Accessible name when not wrapped in a label */
  "aria-label"?: string;
};

export function SearchableSelect({
  value,
  onChange,
  options,
  className = "",
  placeholder,
  disabled,
  "aria-label": ariaLabel,
}: Props) {
  const t = useTranslations("admin");
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value);
  const display =
    selected?.label ||
    placeholder ||
    t("selectPlaceholder");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const tId = window.setTimeout(() => searchRef.current?.focus(), 0);
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(tId);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-left text-[length:var(--text-base)] outline-none focus:border-accent disabled:opacity-60"
      >
        <span
          className={
            selected ? "truncate text-ink" : "truncate text-ink-soft"
          }
        >
          {display}
        </span>
        <span className="shrink-0 text-ink-soft" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-hidden rounded-md border border-[var(--line)] bg-white shadow-lg"
        >
          <div className="border-b border-[var(--line)] p-2">
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("selectSearch")}
              className="w-full rounded-md border border-[var(--line)] px-2.5 py-1.5 text-sm outline-none focus:border-accent"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-soft">
                {t("selectEmpty")}
              </li>
            ) : (
              filtered.map((opt) => {
                const active = opt.value === value;
                return (
                  <li key={opt.value || "__empty"}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`block w-full truncate px-3 py-2 text-left text-sm hover:bg-mist ${
                        active ? "bg-mist/70 font-medium text-ink" : "text-ink"
                      }`}
                      onClick={() => pick(opt.value)}
                    >
                      {opt.label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
