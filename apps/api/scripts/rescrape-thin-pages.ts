/**
 * Re-scrape pages whose content is only a title (e.g. assessment docx years).
 * Uses the same extractors as migrate-full-site.ts.
 * Run: npx tsx scripts/rescrape-thin-pages.ts
 */
import { PrismaClient, PostStatus } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

loadEnv();
const BASE = 'http://school78.safe.am';
const UA = 'School78Rescrape/1.0';
const prisma = new PrismaClient();

type L = { en: string; ru: string; am: string };
const L = (am: string, en = '', ru = ''): L => ({ en, ru, am });

function absUrl(u: string) {
  if (u.startsWith('http')) return u;
  if (u.startsWith('//')) return `http:${u}`;
  return `${BASE}${u.startsWith('/') ? u : `/${u}`}`;
}

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fetchHtml(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return decodeEntities(await res.text());
}

function collectFiles(html: string) {
  const out: { name: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(
    /\/uploads\/[^"'\\\s<>]+\.(?:pdf|docx?|xlsx?|pptx?)/gi,
  )) {
    const url = absUrl(decodeURIComponent(m[0].split('?')[0]));
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({
      name: decodeURIComponent(url.split('/').pop() || 'file'),
      url,
    });
  }
  return out;
}

function collectImages(html: string) {
  const set = new Set<string>();
  for (const m of html.matchAll(
    /\/uploads\/[^"'\\\s<>]+\.(?:jpg|jpeg|png|gif|webp)/gi,
  )) {
    const u = absUrl(decodeURIComponent(m[0].split('?')[0]));
    if (/background-images|footer-toast|icon|logo|button|spacer|weebly|toast/i.test(u))
      continue;
    if (/\/published\/78-1\.jpg$/i.test(u)) continue;
    set.add(u);
  }
  return [...set];
}

function extractParagraphs(html: string): string[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const chunks: string[] = [];
  const seen = new Set<string>();
  for (const m of cleaned.matchAll(
    /<(?:p|h2|h3|blockquote)[^>]*>([\s\S]*?)<\/(?:p|h2|h3|blockquote)>/gi,
  )) {
    let text = decodeEntities(m[1].replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length < 45) continue;
    if (/Powered by|Create your own|Weebly/i.test(text)) continue;
    const key = text.slice(0, 70);
    if (seen.has(key)) continue;
    seen.add(key);
    chunks.push(text);
  }
  return chunks;
}

/** Paths from migrate-full for assessment family + other often-empty doc pages */
const TARGETS: { slug: string; title: string; paths: string[]; parent?: string; year?: string }[] = [
  { slug: 'assessment', title: 'Ներքին գնահատում', paths: ['/135013811408141213871398-137913981377139213771407140014101396.html', '/135013331360136413391350.html'] },
  { slug: 'assessment-2024-2025', title: 'Ներքին գնահատում 2024-2025', paths: ['/135013331360136413391350-133113501329134413291359135213621348-2024-2025.html'], parent: 'assessment', year: '2024-2025' },
  { slug: 'assessment-2023-2024', title: 'Ներքին գնահատում 2023-2024', paths: ['/135013331360136413391350-133113501329134413291359135213621348-2023-2024.html'], parent: 'assessment', year: '2023-2024' },
  { slug: 'assessment-2021-2022', title: 'Ներքին գնահատում 2021-2022', paths: ['/135013331360136413391350-133113501329134413291359135213621348-2021-22.html'], parent: 'assessment', year: '2021-2022' },
  { slug: 'assessment-2020-2021', title: 'Ներքին գնահատում 2020-2021', paths: ['/135013331360136413391350-133113501329134413291359135213621348-2020-21.html'], parent: 'assessment', year: '2020-2021' },
  { slug: 'assessment-2019-2020', title: 'Ներքին գնահատում 2019-2020', paths: ['/135013331360136413391350-1331135013291344132913591352136213482019-2020.html'], parent: 'assessment', year: '2019-2020' },
  { slug: 'assessment-2018-2019', title: 'Ներքին գնահատում 2018-2019', paths: ['/135013331360136413391350-133113501329134413291359135213621348-2018-2019.html'], parent: 'assessment', year: '2018-2019' },
  { slug: 'assessment-2017-2018', title: 'Ներքին գնահատում 2017-2018', paths: ['/135013811408141213871398-137913981377139213771407140014101396-2017-2018.html'], parent: 'assessment', year: '2017-2018' },
  { slug: 'assessment-2016-2017', title: 'Ներքին գնահատում 2016-2017', paths: ['/13501381141213871398-1379139813771392137714071400141013962016-2017.html'], parent: 'assessment', year: '2016-2017' },
  { slug: 'assessment-2015-2016', title: 'Ներքին գնահատում 2015-2016', paths: ['/13501381141213871398-1379139813771392137714071400141013962015-2016.html'], parent: 'assessment', year: '2015-2016' },
  { slug: 'events', title: 'Միջոցառումներ', paths: ['/1348138714031400140913771404140014101396139813811408.html'] },
  { slug: 'gallery', title: 'Պատկերասրահ', paths: ['/13541377140713911381140813771405140813771392.html'] },
  { slug: 'video-gallery', title: 'Տեսասրահ', paths: ['/13591381140513771405140813771392.html'] },
  { slug: 'documents', title: 'Փաստաթղթեր', paths: ['/1363137714051407137713851394138513811408.html'] },
  { slug: 'parent-council', title: 'Ծնողական խորհուրդ', paths: ['/13421398140013941377139113771398-13891400140813921400141014081380.html'] },
  { slug: 'board-of-trustees', title: 'Հոգաբարձուների խորհուրդ', paths: ['/13441400137913771378137714081393140014101398138114081387-13891400140813921400141014081380.html'] },
  { slug: 'vacancies', title: 'Թափուր աշխատատեղեր', paths: ['/133713771411140014101408-13771399138913771407137714071381139413811408.html'] },
  { slug: 'pedagogical-workshop', title: 'Մանկավարժական արհեստանոց', paths: ['/1348137713981391137714061377140813861377139113771398-1377140813921381140514071377139814001409.html'] },
];

async function main() {
  for (const t of TARGETS) {
    let html = '';
    for (const path of t.paths) {
      try {
        html = await fetchHtml(path);
        break;
      } catch {
        /* next */
      }
    }
    if (!html) {
      console.log('FAIL', t.slug);
      continue;
    }
    const paragraphs = extractParagraphs(html);
    const images = collectImages(html);
    const files = collectFiles(html);
    const lines = [`## ${t.title}`, ''];
    if (t.slug === 'assessment') {
      lines.push('### Ըստ ուսումնական տարվա', '');
      for (const y of TARGETS.filter((x) => x.parent === 'assessment')) {
        lines.push(`- [${y.title}](/p/${y.slug})`);
      }
      lines.push('');
    }
    for (const p of paragraphs.slice(0, 40)) lines.push(p, '');
    if (files.length) {
      lines.push('### Փաստաթղթեր', '');
      for (const f of files) lines.push(`- [${f.name}](${f.url})`);
      lines.push('');
    }
    if (images.length) {
      lines.push('### Լուսանկարներ', '');
      for (const img of images.slice(0, 60)) lines.push(`![ ](${img})`, '');
    }
    if (paragraphs.length + files.length + images.length === 0) {
      lines.push('Բովանդակությունը շուտով կլրացվի։', '');
    }
    const am = lines.join('\n').trim();
    await prisma.page.update({
      where: { slug: t.slug },
      data: {
        content: L(am),
        excerpt: L((paragraphs[0] || files[0]?.name || t.title).slice(0, 180)),
        coverImage: images[0] || undefined,
        status: PostStatus.PUBLISHED,
        ...(t.parent && t.year
          ? { parentSlug: t.parent, yearLabel: t.year }
          : {}),
      },
    });
    console.log(
      `OK ${t.slug} text=${paragraphs.length} files=${files.length} img=${images.length}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
