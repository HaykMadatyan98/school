/**
 * Migrate content + media from http://school78.safe.am into local uploads + Mongo pages.
 * Run from apps/api: npx tsx scripts/migrate-old-site.ts
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, extname, join } from 'path';
import { pipeline } from 'stream/promises';
import { PrismaClient, PostStatus } from '@prisma/client';
import { createHash } from 'crypto';

const BASE = 'http://school78.safe.am';
const UPLOAD_ROOT = join(process.cwd(), 'uploads', 'migrated');
const PDF_DIR = join(UPLOAD_ROOT, 'pdfs');
const IMG_DIR = join(UPLOAD_ROOT, 'images');
const MANIFEST = join(UPLOAD_ROOT, 'manifest.json');
const UA = 'School78Migrator/1.0';

/** Old Weebly paths → our CMS slugs */
const PAGE_MAP: Record<string, string> = {
  about: '/134813811408-13961377140513871398.html',
  visits:
    '/1329139714091381138814001410138513971400141013981398138114082.html',
  documents: '/1363137714051407137713851394138513811408.html',
  psychologist:
    '/13441400137913811378137713981387-1377139813911397140014101398.html',
  'tip-of-the-day':
    '/1365140814061377-138914001408139214001410140813801384.html',
  unesco: '/13491352136213501333135713431365.html',
  'my-hero': '/13391348-134413331360135213571336.html',
  awards: '/1348140814091377139813771391139813811408.html',
  'english-club':
    '/132913981379138813811408138113981387-13891396137813771391.html',
  'yerevan-studies':
    '/1333140814151377139813771379138714071400141013851397140014101398.html',
  'summer-assignments':
    '/13291396137714041377139713871398-1392137713981393139813771408137714081400141013851397140014101398139813811408.html',
  family: '/1336139814071377139813871412.html',
  archive: '/-13291408138913871406.html',
  assessment:
    '/135013811408141213871398-137913981377139213771407140014101396.html',
  gallery: '/',
  'photo-gallery':
    '/1329139714091381138814001410138513971400141013981398138114082.html',
  'internal-rules': '/1363137714051407137713851394138513811408.html',
  finances: '/1363137714051407137713851394138513811408.html',
  reports: '/1363137714051407137713851394138513811408.html',
  history: '/134813811408-13961377140513871398.html',
  staff: '/134813811408-13961377140513871398.html',
};

type Manifest = {
  pdfs: { source: string; local: string; name: string }[];
  images: { source: string; local: string; page?: string }[];
  pages: Record<
    string,
    { title: string; paragraphs: string[]; cover?: string; images: string[] }
  >;
};

const prisma = new PrismaClient();

function ensureDir(p: string) {
  mkdirSync(p, { recursive: true });
}

function absUrl(u: string) {
  if (u.startsWith('http')) return u;
  if (u.startsWith('//')) return `http:${u}`;
  return `${BASE}${u.startsWith('/') ? u : `/${u}`}`;
}

function safeName(url: string) {
  const raw = decodeURIComponent(url.split('/').pop() || 'file');
  const cleaned = raw
    .split('?')[0]
    .replace(/[^\w.\u0531-\u0587\-]+/g, '_')
    .slice(0, 120);
  const hash = createHash('md5').update(url).digest('hex').slice(0, 8);
  const ext = extname(cleaned) || '';
  const base = cleaned.replace(ext, '') || 'file';
  return `${base}-${hash}${ext || ''}`;
}

async function fetchText(path: string) {
  const res = await fetch(absUrl(path), {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.text();
}

async function downloadFile(url: string, dest: string) {
  if (existsSync(dest)) return false;
  ensureDir(dirname(dest));
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status} ${url}`);
  await pipeline(res.body as unknown as NodeJS.ReadableStream, createWriteStream(dest));
  return true;
}

function collectPdfs(html: string) {
  const set = new Set<string>();
  for (const m of html.matchAll(/\/uploads\/[^"'\\\s<>]+\.pdf/gi)) {
    set.add(absUrl(decodeURIComponent(m[0].split('?')[0])));
  }
  return [...set];
}

function collectImages(html: string) {
  const set = new Set<string>();
  for (const m of html.matchAll(
    /\/uploads\/[^"'\\\s<>]+\.(?:jpg|jpeg|png|gif|webp)/gi,
  )) {
    const u = absUrl(decodeURIComponent(m[0].split('?')[0]));
    // Prefer display sizes over _orig duplicates when both exist
    if (u.includes('_orig.')) continue;
    // Skip tiny Weebly chrome
    if (/icon|logo|button|spacer/i.test(u)) continue;
    set.add(u);
  }
  return [...set];
}

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function extractParagraphs(html: string): string[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const chunks: string[] = [];
  for (const m of cleaned.matchAll(
    /<(?:p|div|h1|h2|h3|li)[^>]*>([\s\S]*?)<\/(?:p|div|h1|h2|h3|li)>/gi,
  )) {
    let text = decodeEntities(m[1].replace(/<[^>]+>/g, ' '));
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length < 40) continue;
    // Drop nav / chrome noise
    if (/ՆՈՐՈւԹՅՈւՆՆԵՐ|Ներքին գնահատում|2024-2025 ՆՈՐ|EN\s*RU|Weebly/i.test(text))
      continue;
    if (/^https?:\/\//i.test(text)) continue;
    chunks.push(text);
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of chunks) {
    const key = c.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= 40) break;
  }
  return out;
}

function extractTitle(html: string, fallback: string) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m) return fallback;
  return decodeEntities(m[1]).replace(/\s+/g, ' ').trim() || fallback;
}

function L(am: string, en = '', ru = '') {
  return { en, ru, am };
}

function pageMarkdown(opts: {
  title: string;
  paragraphs: string[];
  images: string[];
  pdfs?: { name: string; local: string }[];
}) {
  const lines: string[] = [`## ${opts.title}`, ''];
  for (const p of opts.paragraphs.slice(0, 25)) {
    lines.push(p, '');
  }
  if (opts.images.length) {
    lines.push('### Լուսանկարներ', '');
    for (const img of opts.images.slice(0, 24)) {
      lines.push(`![ ](${img})`, '');
    }
  }
  if (opts.pdfs?.length) {
    lines.push('### Փաստաթղթեր', '');
    for (const pdf of opts.pdfs) {
      lines.push(`- [${pdf.name}](${pdf.local})`);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

function classifyPdf(name: string): 'finances' | 'internal-rules' | 'reports' | 'summer-assignments' | 'english-club' | 'documents' {
  const n = name.toLowerCase();
  if (/կանոն|kargapahakan|կարգապահական/.test(n)) return 'internal-rules';
  if (/դրամական|եկամուտ|ծախս|նախահաշիվ|ֆինանս|dramakan|ekamut|caxs|naxahashiv/.test(n))
    return 'finances';
  if (/հաշվետվություն|hashvetvutyun|report/.test(n)) return 'reports';
  if (/ամառային|summer|հանձնարար/.test(n)) return 'summer-assignments';
  if (/անգլ|english|big_ben|club|խմբակ/.test(n)) return 'english-club';
  return 'documents';
}

async function main() {
  ensureDir(PDF_DIR);
  ensureDir(IMG_DIR);

  const manifest: Manifest = existsSync(MANIFEST)
    ? (JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest)
    : { pdfs: [], images: [], pages: {} };

  console.log('Fetching home + section pages…');
  const homeHtml = await fetchText('/');
  const pdfSet = new Set(collectPdfs(homeHtml));
  const pageHtml: Record<string, string> = { gallery: homeHtml };

  for (const [slug, path] of Object.entries(PAGE_MAP)) {
    if (slug === 'gallery') continue;
    try {
      const html = await fetchText(path);
      pageHtml[slug] = html;
      for (const p of collectPdfs(html)) pdfSet.add(p);
      console.log(`  ok ${slug}`);
    } catch (err) {
      console.warn(`  skip ${slug}:`, err);
    }
  }

  // Extra crawl: html pages linked from home for remaining PDFs
  const linked = [
    ...homeHtml.matchAll(/href=["'](\/[^"'#?]+\.html)["']/gi),
  ].map((m) => m[1]);
  let scanned = 0;
  for (const path of [...new Set(linked)]) {
    if (scanned >= 90) break;
    scanned++;
    try {
      const html = await fetchText(path);
      for (const p of collectPdfs(html)) pdfSet.add(p);
    } catch {
      /* ignore */
    }
  }
  console.log(`PDFs found: ${pdfSet.size}`);

  // Download PDFs
  const pdfEntries: Manifest['pdfs'] = [];
  let i = 0;
  for (const url of [...pdfSet]) {
    i++;
    const name = safeName(url);
    const dest = join(PDF_DIR, name);
    const local = `/uploads/migrated/pdfs/${name}`;
    try {
      const fresh = await downloadFile(url, dest);
      pdfEntries.push({
        source: url,
        local,
        name: decodeURIComponent(url.split('/').pop() || name),
      });
      if (fresh) console.log(`  pdf ${i}/${pdfSet.size} ${name}`);
    } catch (err) {
      console.warn(`  pdf fail ${url}`, err);
    }
  }
  manifest.pdfs = pdfEntries;

  // Download images per key page (capped)
  const imageEntries: Manifest['images'] = [];
  const MAX_PER_PAGE = 36;
  for (const [slug, html] of Object.entries(pageHtml)) {
    const imgs = collectImages(html).slice(0, MAX_PER_PAGE);
    for (const url of imgs) {
      const name = safeName(url);
      const dest = join(IMG_DIR, name);
      const local = `/uploads/migrated/images/${name}`;
      try {
        const fresh = await downloadFile(url, dest);
        imageEntries.push({ source: url, local, page: slug });
        if (fresh) console.log(`  img ${slug}: ${name}`);
      } catch (err) {
        console.warn(`  img fail ${url}`, err);
      }
    }
  }

  // Hero / school building
  const heroUrl = `${BASE}/uploads/7/0/5/5/7055022/published/78-1.jpg?1642571509`;
  const heroName = 'school-building-78-1.jpg';
  const heroDest = join(IMG_DIR, heroName);
  try {
    await downloadFile(heroUrl.split('?')[0], heroDest).catch(() =>
      downloadFile(heroUrl, heroDest),
    );
    imageEntries.push({
      source: heroUrl,
      local: `/uploads/migrated/images/${heroName}`,
      page: 'hero',
    });
  } catch {
    console.warn('hero image failed');
  }

  manifest.images = imageEntries;

  // Build page content
  for (const slug of Object.keys(PAGE_MAP)) {
    const html = pageHtml[slug] || pageHtml.about || '';
    if (!html) continue;
    const title = extractTitle(html, slug);
    const paragraphs = extractParagraphs(html);
    const pageImgs = imageEntries
      .filter((x) => x.page === slug)
      .map((x) => x.local);
    const cover =
      pageImgs[0] ||
      imageEntries.find((x) => x.page === 'hero')?.local ||
      undefined;
    manifest.pages[slug] = { title, paragraphs, cover, images: pageImgs };
  }

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log('Manifest written', MANIFEST);

  // Update Mongo pages
  const pdfByBucket: Record<string, { name: string; local: string }[]> = {};
  for (const pdf of manifest.pdfs) {
    const bucket = classifyPdf(pdf.name);
    (pdfByBucket[bucket] ??= []).push({ name: pdf.name, local: pdf.local });
  }

  const hero = imageEntries.find((x) => x.page === 'hero')?.local;

  for (const [slug, data] of Object.entries(manifest.pages)) {
    const relatedPdfs =
      slug === 'documents'
        ? [
            ...(pdfByBucket.documents || []),
            ...(pdfByBucket['internal-rules'] || []).slice(0, 5),
            ...(pdfByBucket.finances || []).slice(0, 8),
            ...(pdfByBucket.reports || []).slice(0, 5),
          ]
        : pdfByBucket[slug] || [];

    const am = pageMarkdown({
      title: data.title,
      paragraphs: data.paragraphs,
      images: data.images,
      pdfs: relatedPdfs.slice(0, 40),
    });

    const existing = await prisma.page.findUnique({ where: { slug } });
    if (!existing) {
      console.log(`  page missing in DB: ${slug}`);
      continue;
    }

    await prisma.page.update({
      where: { slug },
      data: {
        content: L(am) as object,
        excerpt: L(
          (data.paragraphs[0] || data.title).slice(0, 180),
        ) as object,
        coverImage: data.cover || hero || existing.coverImage,
        status: PostStatus.PUBLISHED,
        publishedAt: existing.publishedAt || new Date(),
      },
    });
    console.log(`  updated page /p/${slug}`);
  }

  // Dedicated PDF-heavy pages
  for (const slug of ['finances', 'internal-rules', 'reports', 'summer-assignments', 'english-club'] as const) {
    const list = pdfByBucket[slug] || [];
    if (!list.length) continue;
    const titles: Record<string, string> = {
      finances: 'Ֆինանսներ',
      'internal-rules': 'Ներքին կանոններ',
      reports: 'Հաշվետվություններ',
      'summer-assignments': 'Ամառային հանձնարարություններ',
      'english-club': 'Անգլերենի խմբակ',
    };
    const am = pageMarkdown({
      title: titles[slug],
      paragraphs: [
        'Նյութերը տեղափոխված են հին կայքից (school78.safe.am)։',
      ],
      images: [],
      pdfs: list,
    });
    const existing = await prisma.page.findUnique({ where: { slug } });
    if (!existing) continue;
    await prisma.page.update({
      where: { slug },
      data: {
        content: L(am) as object,
        coverImage: hero || existing.coverImage,
        status: PostStatus.PUBLISHED,
        publishedAt: existing.publishedAt || new Date(),
      },
    });
    console.log(`  updated pdf page /p/${slug} (${list.length} files)`);
  }

  // Home hero note file for web
  writeFileSync(
    join(UPLOAD_ROOT, 'hero.json'),
    JSON.stringify({ cover: hero || null }, null, 2),
  );

  console.log('Done.', {
    pdfs: manifest.pdfs.length,
    images: manifest.images.length,
    pages: Object.keys(manifest.pages).length,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
