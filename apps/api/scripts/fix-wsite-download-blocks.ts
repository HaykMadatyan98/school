/**
 * Replace broken Weebly "Download File" widgets with clean markdown doc links.
 * Keeps remaining wsite HTML when a page has other content.
 *
 * Run: npx tsx scripts/fix-wsite-download-blocks.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type DocLink = { label: string; href: string };

function extractDocLinks(html: string): DocLink[] {
  const links: DocLink[] = [];

  const patterns = [
    /<a\b[^>]*title=["'](?:Download file:|Скачать файл:)\s*([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
    /<a\b[^>]*href=["']([^"']+)["'][^>]*title=["'](?:Download file:|Скачать файл:)\s*([^"']+)["'][^>]*>/gi,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
      const a = m[1];
      const b = m[2];
      const label = /\.(pdf|docx?|xlsx?|pptx?)/i.test(a) ? a.trim() : b.trim();
      const href = /drive\.google\.com|lh3\.googleusercontent/i.test(a) ? a : b;
      if (!/drive\.google\.com/i.test(href)) continue;
      links.push({ label, href });
    }
  }

  for (const m of html.matchAll(/\[([^\]]+\.(?:pdf|docx?))\]\((https:\/\/drive\.google\.com[^)]+)\)/gi)) {
    links.push({ label: m[1].trim(), href: m[2] });
  }

  const seen = new Set<string>();
  return links.filter((l) => {
    if (seen.has(l.href)) return false;
    seen.add(l.href);
    return true;
  });
}

function removeDownloadWidgets(html: string) {
  let out = html;
  // Weebly file widget + clearing hr (with or without </hr>)
  out = out.replace(
    /<div>\s*<div style="margin:\s*10px 0 0 -10px">[\s\S]*?<hr style="clear:\s*both[^"]*"[^>]*>\s*(?:<\/hr>)?\s*<\/div>/gi,
    '',
  );
  // Fallback: widget block ending with inner </div></div>
  out = out.replace(
    /<div>\s*<div style="margin:\s*10px 0 0 -10px">[\s\S]*?Download File[\s\S]*?<\/div>\s*<\/div>/gi,
    '',
  );
  // Standalone "Download File" links left in tables
  out = out.replace(
    /<a\b[^>]*>\s*Download File\s*<\/a>/gi,
    '',
  );
  out = out.replace(
    /<a\b[^>]*>\s*Скачать файл\s*<\/a>/gi,
    '',
  );
  return out;
}

function stripWsiteWrapper(content: string) {
  if (!content.includes(':::wsite-html')) {
    return { wrapped: false, inner: content };
  }
  const inner = content
    .replace(/^:::wsite-html\s*\n?/, '')
    .replace(/\n?:::\s*$/, '')
    .trim();
  return { wrapped: true, inner };
}

function isEmptyHtml(html: string) {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length < 20;
}

function existingMarkdownLinks(content: string): DocLink[] {
  const links: DocLink[] = [];
  for (const m of content.matchAll(/\[([^\]]+)\]\((https:\/\/drive\.google\.com[^)]+)\)/g)) {
    links.push({ label: m[1], href: m[2] });
  }
  return links;
}

function mergeLinks(existing: DocLink[], extracted: DocLink[]) {
  const seen = new Set(existing.map((l) => l.href));
  const merged = [...existing];
  for (const l of extracted) {
    if (seen.has(l.href)) continue;
    seen.add(l.href);
    merged.push(l);
  }
  return merged;
}

function toContent(links: DocLink[], innerHtml: string, wasWrapped: boolean) {
  const md = links.map((l) => `[${l.label}](${l.href})`).join('\n\n');
  const body = innerHtml.trim();
  if (!md && !body) return '';
  if (!body || isEmptyHtml(body)) return md;
  if (!md) {
    if (!wasWrapped) return body;
    return `:::wsite-html\n${body}\n:::`;
  }
  if (!wasWrapped) return `${md}\n\n${body}`;
  return `${md}\n\n:::wsite-html\n${body}\n:::`;
}

function needsFix(content: string) {
  return (
    /Download file:|Скачать файл:|Download File|margin:\s*10px 0 0 -10px/i.test(
      content,
    )
  );
}

async function main() {
  const pages = await prisma.page.findMany({
    select: { id: true, slug: true, content: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const pg of pages) {
    const am = pg.content?.am || '';
    if (!needsFix(am)) {
      skipped++;
      continue;
    }

    const { wrapped, inner } = stripWsiteWrapper(am);
    const extracted = extractDocLinks(am);
    const existing = existingMarkdownLinks(am);
    const links = mergeLinks(existing, extracted);

    const cleaned = removeDownloadWidgets(inner);
    const next = toContent(links, cleaned, wrapped);

    if (next === am) {
      skipped++;
      continue;
    }

    if (!links.length && !removeDownloadWidgets(am).includes('margin: 10px 0 0 -10px')) {
      // removed non-drive widgets only
    } else if (!links.length) {
      console.warn('no links extracted', pg.slug);
    }

    await prisma.page.update({
      where: { id: pg.id },
      data: {
        content: {
          ...(pg.content as object),
          am: next,
        },
      },
    });

    updated++;
    console.log(
      'fixed',
      pg.slug,
      links.length,
      'docs',
      isEmptyHtml(cleaned) ? 'docs-only' : 'mixed',
    );
  }

  console.log({ updated, skipped, total: pages.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
