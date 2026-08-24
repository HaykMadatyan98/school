/**
 * Canonical academic year: always YYYY-YYYY (e.g. 2021-2022).
 * Accepts 2021-22 / 2021-2022 / 2021/22 and normalizes.
 */
export function normalizeAcademicYear(raw: string): string {
  const label = raw.trim().replace(/\s+/g, '').replace(/\//g, '-');

  const full = label.match(/^(\d{4})-(\d{4})$/);
  if (full) {
    const start = Number(full[1]);
    const end = Number(full[2]);
    if (end !== start + 1) {
      throw new Error(
        `Academic year end must be start+1 (got ${label})`,
      );
    }
    return `${start}-${end}`;
  }

  const short = label.match(/^(\d{4})-(\d{2})$/);
  if (short) {
    const start = Number(short[1]);
    const end2 = Number(short[2]);
    const century = Math.floor(start / 100) * 100;
    let end = century + end2;
    if (end <= start) end += 100;
    if (end !== start + 1) {
      throw new Error(
        `Academic year end must be start+1 (got ${label})`,
      );
    }
    return `${start}-${end}`;
  }

  throw new Error('Year must look like 2025-2026');
}

export function tryNormalizeAcademicYear(raw: string): string | null {
  try {
    return normalizeAcademicYear(raw);
  } catch {
    return null;
  }
}

export function yearSortKey(label: string | null | undefined): number {
  if (!label) return 0;
  const m = label.match(/^(\d{4})/);
  return m ? Number(m[1]) : 0;
}
