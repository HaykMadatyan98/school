/**
 * Remove scraped Weebly navigation chrome from page bodies/excerpts.
 * That "Menu 2025-2026 ՆՈՐՈւԹՅՈւՆՆԵՐ Այցելություններ…" blob is the old site's
 * hamburger/nav dumped into paragraphs — not real page content.
 *
 * Run: npx tsx scripts/clean-weebly-junk.ts
 */
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

loadEnv();

const prisma = new PrismaClient();

function isNavDump(text: string) {
  const t = text.trim();
  if (/^Menu\s+20\d{2}/i.test(t)) return true;
  if (
    t.length > 80 &&
    /ՆՈՐՈւԹՅՈւՆՆԵՐ|ՆՈՐՈՒԹՅՈՒՆՆԵՐ/i.test(t) &&
    /Այցելություններ|Նախագծային|օրինակելի|ԳՆԱՀԱՏՈՒՄ/i.test(t)
  ) {
    return true;
  }
  if (/File Size:|Download File|@font-face|Powered by Create your own/i.test(t)) {
    return true;
  }
  return false;
}

function cleanAm(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];
  let skippingNav = false;

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push('');
      continue;
    }
    // Start of nav dump (often one very long line)
    if (isNavDump(t)) {
      skippingNav = true;
      continue;
    }
    // Continue skipping if previous was nav and this still looks like glued menu crumbs
    if (
      skippingNav &&
      /Այցելություններ|Նախագծային|օրինակելի|ԳՆԱՀԱՏՈՒՄ|հանդիպումներ|ՆԵՐՔԻՆ/i.test(t) &&
      !t.startsWith('#') &&
      !t.startsWith('-') &&
      !t.startsWith('!') &&
      !t.startsWith('[') &&
      !t.startsWith(':::')
    ) {
      continue;
    }
    skippingNav = false;
    out.push(line);
  }

  return out
    .join('\n')
    .replace(/File Size:\s*[\d.]+\s*kb/gi, ' ')
    .replace(/File Type:\s*\w+/gi, ' ')
    .replace(/Download File/gi, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isJunkExcerpt(s: string) {
  const t = s.trim();
  if (!t) return true;
  if (isNavDump(t)) return true;
  if (/\.(docx|doc|pdf|xlsx|xls)$/i.test(t) && t.length < 120) return true;
  return false;
}

const INTROS: Record<string, string> = {
  events:
    'Դպրոցական միջոցառումների արխիվ։ Ընտրեք ուսումնական տարին կամ բացեք նյութերը ստորև։',
  documents:
    'Դպրոցի պաշտոնական փաստաթղթեր՝ կանոններ, լիցենզիա, հաշվետվություններ և ֆինանսներ։',
  gallery: 'Դպրոցական կյանքի պատկերասրահ։',
  'video-gallery': 'Դպրոցական տեսանյութերի սրահ։',
  'pedagogical-workshop':
    'Մանկավարժական արհեստանոց՝ մեթոդական նյութեր և փորձի փոխանակում։',
  'board-of-trustees': 'Հոգաբարձուների խորհրդի կազմը և նյութերը։',
  'parent-council': 'Ծնողական խորհրդի կազմը և գործունեությունը։',
  vacancies: 'Թափուր աշխատատեղեր Հ. 78 հիմնական դպրոցում։',
};

async function main() {
  const pages = await prisma.page.findMany();
  let cleaned = 0;
  let filled = 0;

  for (const page of pages) {
    const content = page.content as { am?: string; en?: string; ru?: string };
    const excerpt = page.excerpt as { am?: string; en?: string; ru?: string };
    const am0 = content.am || '';
    const am1 = cleanAm(am0);
    let nextAm = am1;
    let nextExcerptAm = excerpt?.am || '';

    const title = ((page.title as { am?: string })?.am || page.slug).trim();
    const withoutTitle = nextAm.replace(/^##\s+.+$/m, '').trim();
    const hasBody =
      withoutTitle.replace(/[#*\s\-]/g, '').length > 20 ||
      /!\[[^\]]*\]\([^)]+\)/.test(nextAm) ||
      /\[[^\]]+\]\([^)]+\)/.test(nextAm) ||
      /:::person/.test(nextAm) ||
      /Ըստ ուսումնական տարվա/.test(nextAm);

    if (!hasBody && INTROS[page.slug]) {
      // Preserve document/image blocks if any somehow remain
      const extras = withoutTitle;
      nextAm = `## ${title}\n\n${INTROS[page.slug]}${extras ? `\n\n${extras}` : ''}`.trim();
      filled++;
    } else if (!hasBody) {
      nextAm = `## ${title}\n\nԲովանդակությունը պատրաստման փուլում է։`.trim();
      filled++;
    }

    if (isJunkExcerpt(nextExcerptAm)) {
      nextExcerptAm = INTROS[page.slug] || title;
    }

    if (nextAm !== am0 || nextExcerptAm !== (excerpt?.am || '')) {
      await prisma.page.update({
        where: { id: page.id },
        data: {
          content: { ...content, am: nextAm },
          excerpt: { ...(excerpt || { en: '', ru: '' }), am: nextExcerptAm },
        },
      });
      cleaned++;
      console.log(
        'fixed',
        page.slug,
        am0.length !== nextAm.length ? `am ${am0.length}->${nextAm.length}` : 'excerpt',
      );
    }
  }

  console.log({ cleaned, filled, total: pages.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
