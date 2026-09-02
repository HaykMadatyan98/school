/**
 * Rewrite legacy /uploads/ image URLs inside :::wsite-html blocks to Drive/lh3 URLs.
 * Uses fresh-wsite-import cache (.cache/fresh-wsite-map.json).
 *
 * Run: npx tsx scripts/fix-wsite-image-urls.ts
 * Optional: DRY=1 ONLY=news-2024-2025
 */
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();
const CACHE_PATH = resolve(__dirname, '../.cache/fresh-wsite-map.json');
const DRY = process.env.DRY === '1';
const ONLY = (process.env.ONLY || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

type ImportCache = {
  files: Record<string, string>;
};

function loadCache(): ImportCache {
  if (!existsSync(CACHE_PATH)) {
    throw new Error(`Cache not found: ${CACHE_PATH}. Run import:fresh-wsite first.`);
  }
  const raw = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as ImportCache;
  return { files: raw.files || {} };
}

function buildLookup(files: Record<string, string>) {
  const map = new Map<string, string>();

  function add(key: string, value: string) {
    if (!key || !value || key === value) return;
    if (!map.has(key)) map.set(key, value);
  }

  for (const [from, to] of Object.entries(files)) {
    add(from, to);
    const noQuery = from.split('?')[0];
    add(noQuery, to);
    try {
      const path = new URL(from).pathname;
      add(path, to);
    } catch {
      /* ignore */
    }
    const pathOnly = from.replace(/^https?:\/\/[^/]+/i, '');
    if (pathOnly.startsWith('/')) add(pathOnly, to);
  }

  return map;
}

function resolveUploadPath(path: string, map: Map<string, string>) {
  const clean = path.split('?')[0];
  const candidates = [
    clean,
    `http://school78.safe.am${clean}`,
    clean.replace(/_orig(\.[a-z0-9]+)$/i, '$1'),
    `http://school78.safe.am${clean.replace(/_orig(\.[a-z0-9]+)$/i, '$1')}`,
  ];

  for (const key of candidates) {
    const hit = map.get(key);
    if (hit) return hit;
  }

  const idMatch =
    clean.match(/\/(\d+)\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ||
    clean.match(/\/(\d+)_orig\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);
  if (idMatch) {
    const id = idMatch[1];
    for (const [key, value] of map.entries()) {
      if (
        key.includes(`/${id}.`) ||
        key.includes(`/${id}_orig.`) ||
        key.endsWith(`/${id}.jpg`) ||
        key.endsWith(`/${id}.png`)
      ) {
        return value;
      }
    }
  }

  return null;
}

const UPLOAD_RE = /\/uploads\/[^"'\\\s<>]+/gi;

function rewriteUploadUrls(content: string, map: Map<string, string>) {
  let replacements = 0;
  let unresolved = 0;
  const seenUnresolved = new Set<string>();

  const out = content.replace(UPLOAD_RE, (match) => {
    const resolved = resolveUploadPath(match, map);
    if (resolved) {
      replacements++;
      return resolved;
    }
    unresolved++;
    seenUnresolved.add(match.split('?')[0].slice(0, 80));
    return match;
  });

  return { out, replacements, unresolved, seenUnresolved };
}

async function main() {
  const cache = loadCache();
  const map = buildLookup(cache.files);
  console.log('Lookup keys', map.size, 'DRY', DRY);

  const pages = await prisma.page.findMany({
    select: { id: true, slug: true, content: true },
    orderBy: { slug: 'asc' },
  });

  let updated = 0;
  let skipped = 0;
  let totalReplacements = 0;
  let totalUnresolved = 0;
  const allUnresolved = new Set<string>();

  for (const pg of pages) {
    if (ONLY.length && !ONLY.includes(pg.slug)) {
      skipped++;
      continue;
    }

    const am = pg.content?.am || '';
    if (!UPLOAD_RE.test(am)) {
      skipped++;
      UPLOAD_RE.lastIndex = 0;
      continue;
    }
    UPLOAD_RE.lastIndex = 0;

    const { out, replacements, unresolved, seenUnresolved } =
      rewriteUploadUrls(am, map);
    for (const u of seenUnresolved) allUnresolved.add(u);

    if (out === am) {
      skipped++;
      continue;
    }

    totalReplacements += replacements;
    totalUnresolved += unresolved;

    if (!DRY) {
      await prisma.page.update({
        where: { id: pg.id },
        data: {
          content: {
            ...(pg.content as object),
            am: out,
          },
        },
      });
    }

    updated++;
    console.log('fixed', pg.slug, replacements, 'urls', unresolved, 'unresolved');
  }

  console.log({
    updated,
    skipped,
    total: pages.length,
    totalReplacements,
    totalUnresolved,
    uniqueUnresolved: allUnresolved.size,
  });

  if (allUnresolved.size) {
    console.log('Sample unresolved:', [...allUnresolved].slice(0, 15));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
