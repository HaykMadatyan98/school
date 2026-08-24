/**
 * Bind all old-site section images/PDFs as cloud URLs (not local files).
 *
 * Default: use Weebly CDN URLs from school78.safe.am (already in the cloud).
 * If Cloudinary is configured, optionally re-host there:
 *   CLOUDINARY_MIGRATE=1 npm run migrate:cloud-media -w api
 */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient, PostStatus } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

loadEnv();

const BASE = 'http://school78.safe.am';
const UA = 'School78Migrator/1.0';
const USE_CLOUDINARY = process.env.CLOUDINARY_MIGRATE === '1';

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
  history: '/134813811408-13961377140513871398.html',
  staff: '/134813811408-13961377140513871398.html',
};

const prisma = new PrismaClient();

function absUrl(u: string) {
  if (u.startsWith('http')) return u;
  if (u.startsWith('//')) return `http:${u}`;
  return `${BASE}${u.startsWith('/') ? u : `/${u}`}`;
}

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

function collectImages(html: string) {
  const set = new Set<string>();
  for (const m of html.matchAll(
    /\/uploads\/[^"'\\\s<>]+\.(?:jpg|jpeg|png|gif|webp)/gi,
  )) {
    const u = absUrl(decodeURIComponent(m[0].split('?')[0]));
    if (u.includes('_orig.')) continue;
    if (/icon|logo|button|spacer/i.test(u)) continue;
    set.add(u);
  }
  return [...set];
}

function collectPdfs(html: string) {
  const set = new Set<string>();
  for (const m of html.matchAll(/\/uploads\/[^"'\\\s<>]+\.pdf/gi)) {
    set.add(absUrl(decodeURIComponent(m[0].split('?')[0])));
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
    /<(?:p|h2|h3)[^>]*>([\s\S]*?)<\/(?:p|h2|h3)>/gi,
  )) {
    let text = decodeEntities(m[1].replace(/<[^>]+>/g, ' '));
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length < 50) continue;
    if (
      /ՆՈՐՈւԹՅՈւՆՆԵՐ|Ներքին գնահատում|Powered by|Create your own|Weebly|2024-2025 ՆՈՐ/i.test(
        text,
      )
    ) {
      continue;
    }
    const key = text.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    chunks.push(text);
    if (chunks.length >= 30) break;
  }
  return chunks;
}

function extractTitle(html: string, fallback: string) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m) return fallback;
  return decodeEntities(m[1]).replace(/\s+/g, ' ').trim() || fallback;
}

function L(am: string) {
  return { en: '', ru: '', am };
}

function pageMarkdown(opts: {
  title: string;
  paragraphs: string[];
  images: string[];
  pdfs?: { name: string; url: string }[];
}) {
  const lines: string[] = [`## ${opts.title}`, ''];
  for (const p of opts.paragraphs.slice(0, 25)) lines.push(p, '');
  if (opts.images.length) {
    lines.push('### Լուսանկարներ', '');
    for (const img of opts.images) lines.push(`![ ](${img})`, '');
  }
  if (opts.pdfs?.length) {
    lines.push('### Փաստաթղթեր', '');
    for (const pdf of opts.pdfs) lines.push(`- [${pdf.name}](${pdf.url})`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

function classifyPdf(
  name: string,
):
  | 'finances'
  | 'internal-rules'
  | 'reports'
  | 'summer-assignments'
  | 'english-club'
  | 'documents' {
  const n = name.toLowerCase();
  if (/կանոն|kargapahakan|կարգապահական/.test(n)) return 'internal-rules';
  if (
    /դրամական|եկամուտ|ծախս|նախահաշիվ|ֆինանս|dramakan|ekamut|caxs|naxahashiv/.test(
      n,
    )
  ) {
    return 'finances';
  }
  if (/հաշվետվություն|hashvetvutyun|report/.test(n)) return 'reports';
  if (/ամառային|summer|հանձնարար/.test(n)) return 'summer-assignments';
  if (/անգլ|english|big_ben|club|խմբակ/.test(n)) return 'english-club';
  return 'documents';
}

function setupCloudinary() {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config(true);
    return true;
  }
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    return true;
  }
  return false;
}

const urlCache = new Map<string, string>();

async function toCloudUrl(remote: string): Promise<string> {
  if (!USE_CLOUDINARY) return remote;
  if (urlCache.has(remote)) return urlCache.get(remote)!;
  const isPdf = /\.pdf(\?|$)/i.test(remote);
  const result = await cloudinary.uploader.upload(remote, {
    folder: 'school78/migrated',
    resource_type: isPdf ? 'raw' : 'image',
    unique_filename: true,
    overwrite: false,
  });
  urlCache.set(remote, result.secure_url);
  return result.secure_url;
}

async function fetchText(path: string) {
  const res = await fetch(absUrl(path), {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return res.text();
}

async function main() {
  if (USE_CLOUDINARY) {
    if (!setupCloudinary()) {
      throw new Error(
        'CLOUDINARY_MIGRATE=1 but Cloudinary credentials are missing',
      );
    }
    console.log('Re-hosting media on Cloudinary…');
  } else {
    console.log(
      'Using Weebly CDN URLs (school78.safe.am). Set CLOUDINARY_* + CLOUDINARY_MIGRATE=1 to copy into your cloud.',
    );
  }

  const homeHtml = await fetchText('/');
  const allPdfs = new Set(collectPdfs(homeHtml));
  const pageData: Record<
    string,
    { title: string; paragraphs: string[]; images: string[] }
  > = {};

  for (const [slug, path] of Object.entries(PAGE_MAP)) {
    const html = slug === 'gallery' ? homeHtml : await fetchText(path);
    for (const p of collectPdfs(html)) allPdfs.add(p);
    const images = collectImages(html);
    const cloudImages: string[] = [];
    for (const img of images) {
      cloudImages.push(await toCloudUrl(img));
      if (cloudImages.length % 25 === 0) {
        console.log(`  ${slug}: ${cloudImages.length}/${images.length} images`);
      }
    }
    pageData[slug] = {
      title: extractTitle(html, slug),
      paragraphs: extractParagraphs(html),
      images: cloudImages,
    };
    console.log(
      `section ${slug}: ${cloudImages.length} images (cloud URLs)`,
    );
  }

  // Extra PDFs from linked pages
  const linked = [
    ...homeHtml.matchAll(/href=["'](\/[^"'#?]+\.html)["']/gi),
  ].map((m) => m[1]);
  let scanned = 0;
  for (const path of [...new Set(linked)]) {
    if (scanned++ >= 90) break;
    try {
      const html = await fetchText(path);
      for (const p of collectPdfs(html)) allPdfs.add(p);
    } catch {
      /* ignore */
    }
  }

  const pdfEntries: { name: string; url: string; bucket: string }[] = [];
  for (const url of allPdfs) {
    const name = decodeURIComponent(url.split('/').pop() || 'file.pdf');
    const cloud = await toCloudUrl(url);
    pdfEntries.push({ name, url: cloud, bucket: classifyPdf(name) });
  }
  console.log(`PDFs: ${pdfEntries.length}`);

  const heroRemote = `${BASE}/uploads/7/0/5/5/7055022/published/78-1.jpg`;
  const hero = await toCloudUrl(heroRemote);

  const pdfByBucket: Record<string, { name: string; url: string }[]> = {};
  for (const pdf of pdfEntries) {
    (pdfByBucket[pdf.bucket] ??= []).push({ name: pdf.name, url: pdf.url });
  }

  // Keep curated about/history/staff text; only swap cover + gallery pages
  const curatedAbout = `## Մեր մասին

Երևանի Հայրապետ Հայրապետյանի անվան հ. 78 հիմնական դպրոցը պետական դպրոց է Արաբկիր վարչական շրջանում։ Հիմնադրվել է 1957 թվականին։

Դպրոցը տալիս է հիմնական կրթություն և վարում է ակտիվ դպրոցական կյանք՝ աշակերտների, ծնողների և մանկավարժների համագործակցությամբ։

### Կապ

- Հասցե՝ Մարշալ Բաղրամյան պող. 57/2, Արաբկիր, Երևան 0019
- Հեռախոս՝ +374 10 225836
- Էլ. փոստ՝ school78@schools.am`;

  for (const [slug, data] of Object.entries(pageData)) {
    const related =
      slug === 'documents'
        ? [
            ...(pdfByBucket.documents || []),
            ...(pdfByBucket['internal-rules'] || []).slice(0, 8),
            ...(pdfByBucket.finances || []).slice(0, 12),
          ]
        : pdfByBucket[slug] || [];

    let am: string;
    if (slug === 'about' || slug === 'history' || slug === 'staff') {
      am =
        slug === 'about'
          ? curatedAbout
          : pageMarkdown({
              title: data.title,
              paragraphs: data.paragraphs.length
                ? data.paragraphs
                : [data.title],
              images: [],
              pdfs: [],
            });
    } else {
      am = pageMarkdown({
        title: data.title,
        paragraphs: data.paragraphs,
        images: data.images,
        pdfs: related.map((p) => ({ name: p.name, url: p.url })),
      });
    }

    const existing = await prisma.page.findUnique({ where: { slug } });
    if (!existing) {
      console.log('missing page', slug);
      continue;
    }

    await prisma.page.update({
      where: { slug },
      data: {
        content: L(am),
        excerpt: L(
          (data.paragraphs[0] || data.title).slice(0, 180),
        ),
        coverImage: data.images[0] || hero,
        status: PostStatus.PUBLISHED,
        publishedAt: existing.publishedAt || new Date(),
      },
    });
    console.log(
      `updated /p/${slug} — ${data.images.length} cloud images`,
    );
  }

  for (const slug of [
    'finances',
    'internal-rules',
    'reports',
    'summer-assignments',
    'english-club',
  ] as const) {
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
      paragraphs: ['Փաստաթղթերը հասանելի են ամպային հղումներով։'],
      images: [],
      pdfs: list.map((p) => ({ name: p.name, url: p.url })),
    });
    await prisma.page.update({
      where: { slug },
      data: {
        content: L(am),
        coverImage: hero,
        status: PostStatus.PUBLISHED,
      },
    });
    console.log(`updated /p/${slug} — ${list.length} cloud PDFs`);
  }

  // Home hero pointer for the web app
  writeFileSync(
    join(process.cwd(), 'uploads', 'migrated', 'hero.json'),
    JSON.stringify({ cover: hero, storage: USE_CLOUDINARY ? 'cloudinary' : 'weebly-cdn' }, null, 2),
  );

  console.log('Done.', {
    mode: USE_CLOUDINARY ? 'cloudinary' : 'weebly-cdn',
    sections: Object.keys(pageData).length,
    pdfs: pdfEntries.length,
    hero,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
