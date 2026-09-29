/**
 * Convert doc-heavy pages to editable markdown (no wsite HTML shell).
 *
 * - vacancies, internal-rules, management-board → intro + doc links
 * - psychologist, unesco, yerevan-studies → intro + docs + keep wsite HTML body
 * - tarakarg → curated intro paragraphs
 *
 * Staff/teachers: npm run sync:staff -w api
 * Parent council list: npm run seed:parent-council -w api
 *
 * Run: npx tsx scripts/convert-docs-pages.ts
 * Optional: DRY=1 ONLY=vacancies,tarakarg
 */
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

loadEnv();

const prisma = new PrismaClient();
const DRY = process.env.DRY === '1';
const ONLY = (process.env.ONLY || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

type DocLink = { label: string; href: string };

const DOCS_ONLY = ['vacancies', 'internal-rules', 'management-board'] as const;
const MIXED_GALLERY = ['psychologist', 'unesco', 'yerevan-studies'] as const;

const INTROS: Record<string, string> = {
  'vacancies': "Թափուր աշխատատեղերի մասին տեղեկություններ։ Ակտուալ հայտարարությունների համար կարող եք կապ հաստատել դպրոցի հետ։",
  'internal-rules': "Դպրոցի ներքին կարգապահական կանոնները սահմանում են աշակերտների, ծնողների և աշխատակիցների իրավունքներն ու պարտականությունները։ Ստորև կարող եք ներբեռնել պաշտոնական փաստաթղթերը։",
  'management-board': "Դպրոցի կառավարման խորհրդի կազմը և գործունեության նյութերը։",
  'psychologist': "Հոգեբանի անկյուն՝ խորհուրդներ և նյութեր աշակերտների ու ծնողների համար։",
  'unesco': "ՅՈՒՆԵՍԿՕ-ին առնչվող դպրոցական նախաձեռնություններ։",
  'yerevan-studies': "Երևանագիտության խմբակի նյութեր և միջոցառումներ։"
};

function shouldRun(slug: string) {
  return !ONLY.length || ONLY.includes(slug);
}

function normalizeDriveUrl(href: string) {
  const m = href.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (m) return `https://drive.google.com/file/d/${m[1]}/view`;
  return href.split('?')[0];
}

function cleanLabel(label: string) {
  return label
    .replace(/\s+/g, ' ')
    .replace(/^(Download file:|Скачать файл:)\s*/i, '')
    .trim();
}

function extractDocLinks(content: string): DocLink[] {
  const links: DocLink[] = [];

  for (const m of content.matchAll(
    /\[([^\]]+)\]\((https:\/\/drive\.google\.com[^)]+)\)/g,
  )) {
    links.push({
      label: cleanLabel(m[1]),
      href: normalizeDriveUrl(m[2]),
    });
  }

  const widgetPatterns = [
    /<a\b[^>]*title=["'](?:Download file:|Скачать файл:)\s*([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
    /<a\b[^>]*href=["']([^"']+)["'][^>]*title=["'](?:Download file:|Скачать файл:)\s*([^"']+)["'][^>]*>/gi,
  ];

  for (const re of widgetPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) {
      const a = m[1];
      const b = m[2];
      const label = /\.(pdf|docx?|xlsx?|pptx?)/i.test(a)
        ? cleanLabel(a)
        : cleanLabel(b);
      const href = /drive\.google\.com/i.test(a)
        ? normalizeDriveUrl(a)
        : normalizeDriveUrl(b);
      if (!/drive\.google\.com/i.test(href)) continue;
      if (!label || /^(here|click|download)$/i.test(label)) continue;
      links.push({ label, href });
    }
  }

  for (const m of content.matchAll(
    /href=["'](https:\/\/drive\.google\.com\/file\/d\/[^"']+)["']/gi,
  )) {
    const href = normalizeDriveUrl(m[1]);
    const id = href.match(/\/d\/([^/]+)/)?.[1] || href;
    links.push({ label: `document-${id.slice(0, 8)}`, href });
  }

  const seen = new Set<string>();
  return links.filter((l) => {
    if (!l.label || !l.href) return false;
    if (seen.has(l.href)) return false;
    seen.add(l.href);
    return true;
  });
}

function stripWsiteBlock(content: string) {
  const idx = content.indexOf(':::wsite-html');
  if (idx < 0) return { prefix: content.trim(), inner: '' };
  return {
    prefix: content.slice(0, idx).trim(),
    inner: content.slice(idx).trim(),
  };
}

function docsMarkdown(intro: string, links: DocLink[]) {
  const parts: string[] = [];
  if (intro.trim()) parts.push(intro.trim(), '');
  for (const link of links) {
    parts.push(`[${link.label}](${link.href})`, '');
  }
  return parts.join('\n').trim();
}

function mixedMarkdown(intro: string, links: DocLink[], wsiteBlock: string) {
  const head = docsMarkdown(intro, links);
  if (!wsiteBlock) return head;
  return head ? `${head}\n\n${wsiteBlock}` : wsiteBlock;
}

async function updatePage(slug: string, am: string, excerpt?: string) {
  const page = await prisma.page.findUnique({ where: { slug } });
  if (!page) {
    console.warn('skip missing', slug);
    return false;
  }
  const content = page.content as { am?: string; en?: string; ru?: string };
  if (content.am === am) {
    console.log('unchanged', slug);
    return false;
  }
  if (!DRY) {
    await prisma.page.update({
      where: { id: page.id },
      data: {
        content: { ...content, am },
        ...(excerpt
          ? {
              excerpt: {
                ...(page.excerpt as object),
                am: excerpt,
              },
            }
          : {}),
      },
    });
  }
  console.log(DRY ? 'would update' : 'updated', slug, 'len', am.length);
  return true;
}

async function convertDocsOnly(slug: (typeof DOCS_ONLY)[number]) {
  if (!shouldRun(slug)) return;
  const page = await prisma.page.findUnique({
    where: { slug },
    select: { content: true },
  });
  if (!page?.content?.am) return;
  const links = extractDocLinks(page.content.am);
  const am = docsMarkdown(INTROS[slug] || '', links);
  await updatePage(slug, am);
  console.log(' ', slug, 'docs', links.length);
}

async function convertMixed(slug: (typeof MIXED_GALLERY)[number]) {
  if (!shouldRun(slug)) return;
  const page = await prisma.page.findUnique({
    where: { slug },
    select: { content: true },
  });
  if (!page?.content?.am) return;
  const { inner } = stripWsiteBlock(page.content.am);
  const links = extractDocLinks(page.content.am);
  const am = mixedMarkdown(INTROS[slug] || '', links, inner);
  await updatePage(slug, am);
  console.log(' ', slug, 'docs', links.length, 'wsite', inner.length > 0);
}

async function seedTarakarg() {
  const slug = 'tarakarg';
  if (!shouldRun(slug)) return;
  const am = "Տարակարգը ուսուցչի մասնագիտական որակավորման աստիճանն է, որը շնորհվում է կամավոր ատեստավորման արդյունքներով և արձանագրվում է ուսուցչի անձնական գործում։\n\nՀ. 78 հիմնական դպրոցում տարակարգերի վերաբերյալ տեղեկատվությունը կապված է կամավոր ատեստավորման գործընթացի հետ։ Մանրամասների համար տե՛ս նաև «Կամավոր ատեստավորում» բաժինը։\n\nԱյս էջում կհրապարակվեն դպրոցի մանկավարժների տարակարգերի ցանկը և թարմացումները՝ ըստ ուսումնական տարվա։";
  await updatePage(
    slug,
    am,
    "Ուսուցչի մասնագիտական որակավորման տարակարգ՝ դպրոցի մանկավարժների որակավորման աստիճանները։",
  );
}

async function main() {
  for (const slug of DOCS_ONLY) await convertDocsOnly(slug);
  for (const slug of MIXED_GALLERY) await convertMixed(slug);
  await seedTarakarg();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
