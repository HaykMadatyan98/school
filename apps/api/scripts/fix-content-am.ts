/**
 * Fix Armenian texts + context-aware images for all CMS pages.
 * - Drops Weebly chrome (background cactus, toast, junk)
 * - Staff: only captioned portraits
 * - Ensures every page has Armenian intro text
 *
 * Run: npm run fix:content-am -w api
 */
import { PrismaClient, PostStatus } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv();

const prisma = new PrismaClient();
const BASE = 'http://school78.safe.am';
const UA = 'School78FixContent/1.0';

type L = { am: string; en: string; ru: string };
const L = (am: string, en = '', ru = ''): L => ({ am, en, ru });

type Source = { slug: string; title: L; paths: string[]; yearOf?: string };

function loadSources(): Source[] {
  const file = fs.readFileSync(
    path.join(__dirname, 'migrate-full-site.ts'),
    'utf8',
  );
  const marker = 'const SECTION_SOURCES';
  const start = file.indexOf(marker);
  const end = file.indexOf('\nfunction absUrl');
  if (start < 0 || end < 0) throw new Error('Cannot locate SECTION_SOURCES');
  const chunk = file.slice(start, end);
  const eq = chunk.indexOf('= [');
  if (eq < 0) throw new Error('Cannot locate SECTION_SOURCES array');
  const arrLit = chunk.slice(eq + 2).trim().replace(/;?\s*$/, '');
  const Llocal = (am: string, en = '', ru = '') => ({ am, en, ru });
  return new Function('L', `return ${arrLit}`)(Llocal) as Source[];
}

const STAFF_SLUGS = new Set(['staff', 'teachers', 'management-board']);
const DOCS_SLUGS = new Set([
  'documents',
  'internal-rules',
  'license',
  'reports',
  'finances',
  'assessment',
  'educational-guides',
  'educational-resources',
  'summer-assignments',
  'voluntary-attestation',
]);
const GALLERY_SLUGS = new Set([
  'classrooms',
  'school-life',
  'visits',
  'meetings',
  'exemplary-lessons',
  'project-based-learning',
  'lesson-led-by',
  'events',
  'eco',
  'sports',
  'family',
  'awards',
  'my-hero',
  'gallery',
  'photo-gallery',
  'clubs',
]);

const INTROS: Record<string, string> = {
  about:
    'Երևանի Հայրապետ Հայրապետյանի անվան հ. 78 հիմնական դպրոցը պետական դպրոց է Արաբկիր վարչական շրջանում։ Հիմնադրվել է 1957 թվականին։\n\nԴպրոցը տալիս է հիմնական կրթություն և վարում է ակտիվ դպրոցական կյանք՝ աշակերտների, ծնողների և մանկավարժների համագործակցությամբ։\n\nՀասցե՝ Մարշալ Բաղրամյան պող. 57/2, Արաբկիր, Երևան 0019։ Հեռախոս՝ +374 10 225836։ Էլ. փոստ՝ school78@schools.am։',
  staff:
    'Հ. 78 հիմնական դպրոցի մանկավարժական և վարչական աշխատակազմը։ Ստորև ներկայացված են աշխատակիցների լուսանկարները և անունները։',
  teachers:
    'Դպրոցի մանկավարժների կազմը։ Լուսանկարները վերցված են դպրոցի պաշտոնական կայքից։',
  history:
    'Դպրոցը հիմնադրվել է 1957 թվականին և կրում է Հայրապետ Հայրապետյանի անունը։ Այստեղ ներկայացված են պատմական լուսանկարներ և նյութեր։',
  'management-board':
    'Դպրոցի կառավարման խորհրդի կազմը և գործունեության նյութերը։',
  'parent-council':
    'Ծնողական խորհրդի գործունեությունը և հանդիպումների նյութերը։',
  'student-council': 'Աշակերտական խորհրդի գործունեությունը։',
  'board-of-trustees': 'Հոգաբարձուների խորհրդի կազմը և փաստաթղթերը։',
  vacancies:
    'Թափուր աշխատատեղերի մասին տեղեկություններ։ Ակտուալ հայտարարությունների համար կարող եք կապ հաստատել դպրոցի հետ։',
  classrooms: 'Դպրոցի դասասենյակների և ուսումնական տարածքների լուսանկարներ։',
  'school-life':
    'Դպրոցական կյանքի միջոցառումներ, տոնակատարություններ և առօրյա պահեր։',
  visits: 'Այցելություններ և էքսկուրսիաներ ըստ ուսումնական տարիների։',
  meetings: 'Հանդիպումներ, հյուրեր և համագործակցային միջոցառումներ։',
  'exemplary-lessons':
    'Օրինակելի դասերի արխիվ ըստ ուսումնական տարիների։ Լուսանկարները բեռնվում են աստիճանաբար։',
  'project-based-learning': 'Նախագծային ուսուցման աշխատանքներ և արդյունքներ։',
  events: 'Դպրոցական միջոցառումների օրացույց և արխիվ։',
  assessment:
    'Ներքին գնահատման արդյունքներն ըստ ուսումնական տարիների։ Ընտրեք տարվա բաժինը մենյուից։',
  documents: 'Դպրոցի պաշտոնական փաստաթղթեր և կանոնակարգեր։',
  'internal-rules':
    'Դպրոցի ներքին կարգապահական կանոնները սահմանում են աշակերտների, ծնողների և աշխատակիցների իրավունքներն ու պարտականությունները։ Ստորև կարող եք ներբեռնել պաշտոնական փաստաթղթերը։',
  license: 'Դպրոցի լիցենզիայի և իրավական փաստաթղթերի բաժին։',
  reports: 'Դպրոցի տարեկան և թեմատիկ հաշվետվություններ։',
  finances: 'Ֆինանսական հաշվետվություններ և բյուջեին վերաբերող փաստաթղթեր։',
  clubs: 'Արտադասարանական ակումբներ և խմբակներ աշակերտների համար։',
  eco: 'Էկոլոգիական նախաձեռնություններ և բնապահպանական միջոցառումներ։',
  sports: 'Դպրոցական սպորտային միջոցառումներ և մրցումներ։',
  'english-club': 'Անգլերենի խմբակի գործունեությունը և նյութերը։',
  family: 'Ընտանիքի և դպրոցի համագործակցության միջոցառումներ։',
  awards: 'Աշակերտների և ուսուցիչների մրցանակներ ու նվաճումներ։',
  'my-hero': '«Իմ հերոսը» նախագծի աշխատանքներ և լուսանկարներ։',
  gallery: 'Դպրոցական կյանքի լուսանկարների ընդհանուր պատկերասրահ։',
  'photo-gallery': 'Դպրոցական միջոցառումների և առօրյայի լուսանկարներ։',
  'video-gallery':
    'Դպրոցական տեսանյութերի սրահ։ Այստեղ կհավաքվեն դպրոցի միջոցառումների և դասերի տեսագրությունները։',
  'lesson-led-by':
    '«Դասը վարում է…» բաժնում ներկայացված են բաց և օրինակելի դասերի լուսանկարներ՝ դպրոցի մանկավարժների աշխատանքից։',
  archive: 'Դպրոցական նորությունների և նյութերի արխիվ ըստ տարիների։',
  psychologist: 'Հոգեբանի անկյուն՝ խորհուրդներ և նյութեր աշակերտների ու ծնողների համար։',
  'special-educator': 'Հատուկ մանկավարժի ծառայության նյութեր։',
  'social-educator': 'Սոցիալական մանկավարժի ծառայության նյութեր։',
  'pedagogical-workshop': 'Մանկավարժական արհեստանոցի հանդիպումներ և նյութեր։',
  'educational-guides': 'Ուսումնական ուղեցույցներ և մեթոդական նյութեր։',
  'educational-resources': 'Կրթական ռեսուրսներ ուսուցիչների և աշակերտների համար։',
  'summer-assignments': 'Ամառային արձակուրդի հանձնարարություններ ըստ դասարանների։',
  'tip-of-the-day': 'Օրվա խորհուրդներ աշակերտների և ծնողների համար։',
  unesco: 'ՅՈՒՆԵՍԿՕ-ին առնչվող դպրոցական նախաձեռնություններ։',
  'yerevan-studies': 'Երևանագիտության խմբակի նյութեր և միջոցառումներ։',
  'voluntary-attestation': 'Կամավոր ատեստավորման նյութեր և փաստաթղթեր։',
};

function absUrl(path: string) {
  if (path.startsWith('http')) return path.split('?')[0];
  if (path.startsWith('//')) return `http:${path}`.split('?')[0];
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`.split('?')[0];
}

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"');
}

function isJunkUrl(url: string) {
  const u = url.toLowerCase();
  return (
    u.includes('background-images/') ||
    u.includes('footer-toast') ||
    u.includes('/download.jpg') ||
    u.includes('_orig.') ||
    /icon|logo|button|spacer|facebook|twitter|weebly|toast/i.test(u)
  );
}

function isChromeBanner(url: string) {
  return /\/published\/78-1\.jpg$/i.test(url) || /\/686098162\.jpg$/i.test(url);
}

function hasArmenian(text: string) {
  return /[\u0531-\u0587]/.test(text);
}

async function fetchHtml(path: string) {
  const res = await fetch(absUrl(path), {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
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
    let text = decodeEntities(m[1].replace(/<[^>]+>/g, ' '));
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length < 45) continue;
    if (
      /ՆՈՐՈւԹՅՈւՆՆԵՐ|Ներքին գնահատում\s*20|Powered by|Create your own|Weebly|Այցելություններ20|օրինակելի դասեր\s*20|Featured Products|My Site/i.test(
        text,
      )
    ) {
      continue;
    }
    if ((text.match(/>/g) || []).length >= 2 && text.length < 120) continue;
    const key = text.slice(0, 70);
    if (seen.has(key)) continue;
    seen.add(key);
    chunks.push(text);
    if (chunks.length >= 40) break;
  }
  return chunks;
}

function collectPdfs(html: string) {
  const out: { name: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/\/uploads\/[^"'\\\s<>]+\.pdf/gi)) {
    const url = absUrl(decodeURIComponent(m[0]));
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({
      name: decodeURIComponent(url.split('/').pop() || 'file.pdf'),
      url,
    });
  }
  return out;
}

type Captioned = { url: string; alt: string };

function collectCaptionedPortraits(html: string): Captioned[] {
  const decoded = decodeEntities(html);
  const out: Captioned[] = [];
  const seen = new Set<string>();
  for (const m of decoded.matchAll(/<img([^>]+)>/gi)) {
    const srcM = m[1].match(/src=["']([^"']+)/i);
    if (!srcM) continue;
    const url = absUrl(decodeURIComponent(srcM[1].split('?')[0]));
    if (!url.includes('/uploads/')) continue;
    if (isJunkUrl(url) || isChromeBanner(url)) continue;
    const after = decoded
      .slice(m.index! + m[0].length, m.index! + m[0].length + 400)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const nameM = after.match(
      /([\u0531-\u0587][\u0531-\u0587\u055b\s.\-]{2,70})/,
    );
    if (!nameM) continue;
    const alt = nameM[1].trim().replace(/\s+/g, ' ');
    if (/ՆՈՐՈւԹՅՈւՆ|Գլխավոր|Մենյու/i.test(alt)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, alt });
  }
  return out;
}

function collectGalleryImages(html: string, allowBanner = false): string[] {
  const set = new Set<string>();
  for (const m of html.matchAll(
    /\/uploads\/[^"'\\\s<>]+\.(?:jpg|jpeg|png|gif|webp)/gi,
  )) {
    const u = absUrl(decodeURIComponent(m[0].split('?')[0]));
    if (isJunkUrl(u)) continue;
    if (!allowBanner && isChromeBanner(u)) continue;
    set.add(u);
  }
  return [...set];
}

function introFor(slug: string, titleAm: string): string {
  if (INTROS[slug]) return INTROS[slug];
  if (slug.startsWith('assessment-')) {
    return `${titleAm}՝ ներքին գնահատման նյութեր և փաստաթղթեր։`;
  }
  if (slug.startsWith('visits-')) {
    return `${titleAm}՝ այցելությունների և էքսկուրսիաների լուսանկարներ։`;
  }
  if (slug.startsWith('news-') || slug.startsWith('archive')) {
    return `${titleAm}՝ դպրոցական նորությունների արխիվ։`;
  }
  if (slug.startsWith('exemplary-lessons-')) {
    return `${titleAm}՝ օրինակելի դասերի լուսանկարներ։`;
  }
  if (slug.startsWith('project-based')) {
    return `${titleAm}։ Նախագծային ուսուցման աշխատանքներ։`;
  }
  if (slug.startsWith('meetings-') || slug.startsWith('events-')) {
    return `${titleAm}։ Միջոցառումների լուսանկարներ և նյութեր։`;
  }
  return `${titleAm}։ Բաժնի նյութերը և լուսանկարները ներկայացված են ստորև։`;
}

function pageMarkdown(opts: {
  title: string;
  intro: string;
  paragraphs: string[];
  images: Captioned[];
  pdfs: { name: string; url: string }[];
}) {
  const lines: string[] = [`## ${opts.title}`, ''];
  for (const p of opts.intro.split(/\n\n+/)) {
    if (p.trim()) lines.push(p.trim(), '');
  }
  const seen = new Set(
    opts.intro.split(/\n+/).map((x) => x.trim().slice(0, 50)),
  );
  for (const p of opts.paragraphs.slice(0, 40)) {
    if (seen.has(p.slice(0, 50))) continue;
    if (!hasArmenian(p) && p.length < 200) continue;
    lines.push(p, '');
  }
  if (opts.pdfs.length) {
    lines.push('### Փաստաթղթեր', '');
    for (const pdf of opts.pdfs) lines.push(`- [${pdf.name}](${pdf.url})`);
    lines.push('');
  }
  if (opts.images.length) {
    lines.push('### Լուսանկարներ', '');
    for (const img of opts.images) {
      const alt = img.alt.replace(/[[\]]/g, '');
      lines.push(`![${alt}](${img.url})`, '');
    }
  }
  return lines.join('\n').trim();
}

async function upsertPage(
  slug: string,
  title: L,
  contentAm: string,
  excerptAm: string,
  cover: string | null,
) {
  const data = {
    title,
    excerpt: L(excerptAm),
    content: L(contentAm),
    coverImage: cover,
    status: PostStatus.PUBLISHED,
    publishedAt: new Date(),
  };
  const existing = await prisma.page.findUnique({ where: { slug } });
  if (existing) {
    await prisma.page.update({ where: { slug }, data });
  } else {
    await prisma.page.create({ data: { slug, ...data } });
  }
}

function kindOf(slug: string): 'staff' | 'docs' | 'gallery' | 'general' {
  if (STAFF_SLUGS.has(slug)) return 'staff';
  if (DOCS_SLUGS.has(slug) || slug.startsWith('assessment-')) return 'docs';
  if (
    GALLERY_SLUGS.has(slug) ||
    slug.startsWith('visits-') ||
    slug.startsWith('meetings-') ||
    slug.startsWith('exemplary-') ||
    slug.startsWith('project-based') ||
    slug.startsWith('events-') ||
    slug.startsWith('news-')
  ) {
    return 'gallery';
  }
  return 'general';
}

async function fixSource(section: Source) {
  let html = '';
  let used = '';
  for (const path of section.paths) {
    try {
      html = await fetchHtml(path);
      used = path;
      break;
    } catch {
      /* next */
    }
  }
  if (!html) {
    console.warn('NO HTML', section.slug);
    return;
  }

  const paragraphs = extractParagraphs(html);
  const pdfs = collectPdfs(html);
  const kind = kindOf(section.slug);
  let images: Captioned[] = [];

  if (kind === 'staff') {
    images = collectCaptionedPortraits(html);
    if (images.length < 3) {
      images = collectGalleryImages(html)
        .filter((u) => u.includes('/published/'))
        .map((url) => ({ url, alt: '' }));
    }
  } else if (kind === 'docs') {
    images = collectGalleryImages(html)
      .filter((u) => u.includes('/published/'))
      .slice(0, 8)
      .map((url) => ({ url, alt: '' }));
  } else if (kind === 'gallery') {
    images = collectGalleryImages(html).map((url) => ({ url, alt: '' }));
  } else {
    images = collectGalleryImages(html, section.slug === 'about')
      .slice(0, section.slug === 'about' ? 12 : 100)
      .map((url) => ({ url, alt: '' }));
  }

  const intro = introFor(section.slug, section.title.am);
  const am = pageMarkdown({
    title: section.title.am,
    intro,
    paragraphs,
    images,
    pdfs,
  });
  const excerpt = intro.split('\n')[0].slice(0, 180);
  await upsertPage(
    section.slug,
    section.title,
    am,
    excerpt,
    images[0]?.url || null,
  );
  console.log(
    `OK ${section.slug} ← ${used} | img=${images.length} text=${paragraphs.length} pdf=${pdfs.length}`,
  );
}

async function scrubLeftovers() {
  const pages = await prisma.page.findMany();
  let n = 0;
  for (const page of pages) {
    const content = page.content as L;
    let am = content.am || '';
    if (!am.trim()) continue;
    const before = am;
    const lines = am.split('\n');
    const kept: string[] = [];
    for (const line of lines) {
      const m = line.match(/!\[[^\]]*\]\(([^)]+)\)/);
      if (m && (isJunkUrl(m[1]) || isChromeBanner(m[1]))) continue;
      kept.push(line);
    }
    am = kept.join('\n');

    const title = page.title as L;
    const textBits = am
      .split('\n')
      .map((l) => l.trim())
      .filter(
        (l) =>
          l &&
          !l.startsWith('#') &&
          !l.startsWith('![') &&
          !l.startsWith('- ['),
      );
    const hasReal = textBits.some((t) => t.length > 40 && hasArmenian(t));
    if (!hasReal) {
      const intro = introFor(page.slug, title.am);
      if (/^## /.test(am)) {
        am = am.replace(/^(## .+\n\n)/, `$1${intro}\n\n`);
      } else {
        am = `## ${title.am}\n\n${intro}\n\n${am}`;
      }
    }

    let cover = page.coverImage;
    if (cover && (isJunkUrl(cover) || isChromeBanner(cover))) {
      cover = am.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1] || null;
    }

    if (am !== before || cover !== page.coverImage) {
      await prisma.page.update({
        where: { slug: page.slug },
        data: {
          content: { ...content, am },
          coverImage: cover,
          excerpt: L((textBits[0] || title.am).slice(0, 180)),
        },
      });
      n++;
      console.log('SCRUB', page.slug);
    }
  }
  return n;
}

async function main() {
  const sources = loadSources();
  console.log('Sources:', sources.length);
  for (const s of sources) {
    await fixSource(s);
  }
  const scrubbed = await scrubLeftovers();
  console.log('Done.', { sources: sources.length, scrubbed });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
