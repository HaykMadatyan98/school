/**
 * Gradual page migration from school78.safe.am → CMS + Google Drive.
 * Does NOT change the menu.
 *
 * Usage:
 *   npm run migrate:pages -w api -- --batch=about
 *   npm run migrate:pages -w api -- --only=staff,teachers,parent-council
 *   npm run migrate:pages -w api -- --batch=about --dry
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import { Readable } from 'stream';
import { PrismaClient, PostStatus } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { google } from 'googleapis';

loadEnv({ path: resolve(process.cwd(), '.env') });

const BASE = 'http://school78.safe.am';
const UA = 'School78PageMigrate/1.0';
const MAX_IMAGES = 40;
const CACHE_DIR = resolve(process.cwd(), 'secrets/migrate-url-cache.json');

const prisma = new PrismaClient();

type Am = { am: string };
const Am = (am: string): Am => ({ am });

type Section = { slug: string; title: string; paths: string[] };

/** First batch: Մեր մասին — staff, teachers, parents, councils… */
const BATCH_ABOUT: Section[] = [
  {
    slug: 'about',
    title: 'Մեր մասին',
    paths: ['/134813811408-13961377140513871398.html'],
  },
  {
    slug: 'staff',
    title: 'Դպրոցի աշխատակազմ',
    paths: [
      '/133214021408140014091387-1377139913891377140713771391137713821396.html',
    ],
  },
  {
    slug: 'teachers',
    title: 'Մանկավարժներ',
    paths: ['/134813771398139113771406137714081386139813811408.html'],
  },
  {
    slug: 'history',
    title: 'Դպրոցի պատմություն',
    paths: [
      '/133214021408140014091387-14021377140713961400141013851397140014101398.html',
    ],
  },
  {
    slug: 'management-board',
    title: 'Կառավարման խորհուրդ',
    paths: [
      '/1343137714041377140613771408139613771398-13891400140813921400141014081380.html',
    ],
  },
  {
    slug: 'parent-council',
    title: 'Ծնողական խորհուրդ',
    paths: [
      '/13421398140013941377139113771398-13891400140813921400141014081380.html',
    ],
  },
  {
    slug: 'student-council',
    title: 'Աշակերտական խորհուրդ',
    paths: [
      '/13291399137713911381140814071377139113771398-13891400140813921400141014081380.html',
    ],
  },
  {
    slug: 'board-of-trustees',
    title: 'Հոգաբարձուների խորհուրդ',
    paths: [
      '/13441400137913771378137714081393140014101398138114081387-13891400140813921400141014081380.html',
    ],
  },
  {
    slug: 'vacancies',
    title: 'Թափուր աշխատատեղեր',
    paths: [
      '/133713771411140014101408-13771399138913771407137714071381139413811408.html',
    ],
  },
  {
    slug: 'classrooms',
    title: 'Դասասենյակներ',
    paths: [
      '/1332137714051377140513811398139713771391139813811408.html',
    ],
  },
];

const BATCHES: Record<string, Section[]> = {
  about: BATCH_ABOUT,
};

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (name: string) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  return {
    batch: get('batch') || 'about',
    only: get('only')
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    dry: argv.includes('--dry'),
  };
}

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

async function fetchHtml(path: string) {
  const res = await fetch(absUrl(path), {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return res.text();
}

function isJunkImageUrl(url: string) {
  const u = url.toLowerCase();
  return (
    u.includes('background-images/') ||
    u.includes('footer-toast') ||
    u.includes('/download.jpg') ||
    u.includes('_orig.') ||
    /icon|logo|button|spacer|facebook|twitter|weebly|toast/i.test(u) ||
    /\/published\/78-1\.jpg$/i.test(u) ||
    /\/686098162\.jpg$/i.test(u)
  );
}

function collectImages(html: string) {
  const set = new Set<string>();
  for (const m of html.matchAll(
    /\/uploads\/[^"'\\\s<>]+\.(?:jpg|jpeg|png|gif|webp)/gi,
  )) {
    const u = absUrl(decodeURIComponent(m[0].split('?')[0]));
    if (!isJunkImageUrl(u)) set.add(u);
  }
  return [...set];
}

function collectPdfs(html: string) {
  const out: { name: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/\/uploads\/[^"'\\\s<>]+\.pdf/gi)) {
    const url = absUrl(decodeURIComponent(m[0].split('?')[0]));
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({
      name: decodeURIComponent(url.split('/').pop() || 'file.pdf'),
      url,
    });
  }
  return out;
}

function extractParagraphs(html: string): string[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const chunks: string[] = [];
  const seen = new Set<string>();
  for (const m of cleaned.matchAll(
    /<(?:p|h2|h3|blockquote|li)[^>]*>([\s\S]*?)<\/(?:p|h2|h3|blockquote|li)>/gi,
  )) {
    let text = decodeEntities(m[1].replace(/<[^>]+>/g, ' '));
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length < 35) continue;
    if (
      /ՆՈՐՈւԹՅՈւՆՆԵՐ|Powered by|Create your own|Weebly|Featured Products|My Site|Այցելություններ20/i.test(
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
    if (chunks.length >= 60) break;
  }
  return chunks;
}

/** Pull staff-like cards: image + nearby name/role if present in HTML. */
function extractStaffPersons(
  html: string,
): Array<{ name: string; role: string; photo: string; bio: string }> {
  const persons: Array<{
    name: string;
    role: string;
    photo: string;
    bio: string;
  }> = [];
  // Weebly often has figure/img with alt as name
  for (const m of html.matchAll(
    /<img[^>]+(?:alt=["']([^"']+)["'][^>]*src=["']([^"']+)["']|src=["']([^"']+)["'][^>]*alt=["']([^"']+)["'])[^>]*>/gi,
  )) {
    const alt = (m[1] || m[4] || '').trim();
    const src = absUrl(decodeURIComponent((m[2] || m[3] || '').split('?')[0]));
    if (!alt || alt.length < 3 || isJunkImageUrl(src)) continue;
    if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(src)) continue;
    // Skip if alt looks like a filename
    if (/\.(jpg|png|gif)$/i.test(alt)) continue;
    persons.push({ name: decodeEntities(alt), role: '', photo: src, bio: '' });
    if (persons.length >= 40) break;
  }
  return persons;
}

function pageMarkdown(opts: {
  title: string;
  paragraphs: string[];
  images: string[];
  pdfs: { name: string; url: string }[];
  persons?: Array<{ name: string; role: string; photo: string; bio: string }>;
}) {
  const lines: string[] = [`## ${opts.title}`, ''];

  if (opts.persons?.length) {
    for (const p of opts.persons) {
      lines.push(':::person', `![${p.name}](${p.photo})`);
      if (p.role) lines.push(`**${p.role}**`);
      if (p.bio) lines.push(p.bio);
      lines.push(':::', '');
    }
  }

  for (const p of opts.paragraphs.slice(0, 40)) lines.push(p, '');

  if (opts.pdfs.length) {
    lines.push('### Փաստաթղթեր', '');
    for (const pdf of opts.pdfs) {
      lines.push(`- [${pdf.name.replace(/\.pdf$/i, '')}](${pdf.url})`);
    }
    lines.push('');
  }

  // Photos not already used as person cards
  const used = new Set((opts.persons || []).map((p) => p.photo));
  const gallery = opts.images.filter((u) => !used.has(u));
  if (gallery.length) {
    lines.push('### Լուսանկարներ', '');
    for (const img of gallery) lines.push(`![ ](${img})`, '');
  }

  return lines.join('\n').trim();
}

type UrlCache = Record<string, string>;

function loadCache(): UrlCache {
  try {
    if (!existsSync(CACHE_DIR)) return {};
    return JSON.parse(readFileSync(CACHE_DIR, 'utf8')) as UrlCache;
  } catch {
    return {};
  }
}

function saveCache(cache: UrlCache) {
  const dir = join(CACHE_DIR, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CACHE_DIR, JSON.stringify(cache, null, 2));
}

function createDriveClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!clientId || !clientSecret || !folderId) {
    throw new Error('Missing GOOGLE_OAUTH_* or GOOGLE_DRIVE_FOLDER_ID');
  }

  let refresh =
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim() || '';
  const tokenPath = resolve(
    process.cwd(),
    process.env.GOOGLE_OAUTH_TOKEN_PATH ||
      './secrets/google-oauth-tokens.json',
  );
  if (!refresh && existsSync(tokenPath)) {
    refresh = (
      JSON.parse(readFileSync(tokenPath, 'utf8')) as { refresh_token?: string }
    ).refresh_token || '';
  }
  if (!refresh) throw new Error('No Google OAuth refresh token');

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refresh });
  return {
    drive: google.drive({ version: 'v3', auth: oauth2 }),
    folderId,
  };
}

async function uploadToDrive(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  remoteUrl: string,
  cache: UrlCache,
  dry: boolean,
): Promise<string> {
  if (cache[remoteUrl]) return cache[remoteUrl];
  if (dry) return remoteUrl;

  const res = await fetch(remoteUrl, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`download ${res.status} ${remoteUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType =
    res.headers.get('content-type')?.split(';')[0] ||
    'application/octet-stream';
  const isPdf =
    contentType === 'application/pdf' || /\.pdf(\?|$)/i.test(remoteUrl);
  const original = basename(new URL(remoteUrl).pathname) || `file-${Date.now()}`;
  const name = `${Date.now()}-${original.replace(/[^\w.\-()+ ]+/gi, '_')}`;

  const created = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId],
      description: `Migrated from ${remoteUrl}`,
    },
    media: {
      mimeType: contentType,
      body: Readable.from(buf),
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  const fileId = created.data.id;
  if (!fileId) throw new Error('Drive upload: no id');

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });

  const view = isPdf
    ? `https://drive.google.com/file/d/${fileId}/view`
    : `https://lh3.googleusercontent.com/d/${fileId}`;
  cache[remoteUrl] = view;
  return view;
}

async function upsertPage(
  slug: string,
  title: string,
  contentAm: string,
  excerptAm: string,
  cover?: string | null,
) {
  const data = {
    title: Am(title),
    excerpt: Am(excerptAm),
    content: Am(contentAm),
    coverImage: cover || null,
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

async function migrateSection(
  section: Section,
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  cache: UrlCache,
  dry: boolean,
) {
  let html = '';
  let usedPath = '';
  for (const path of section.paths) {
    try {
      html = await fetchHtml(path);
      usedPath = path;
      break;
    } catch (e) {
      console.warn(`  path fail ${path}: ${String(e).slice(0, 100)}`);
    }
  }
  if (!html) throw new Error('no path worked');

  let paragraphs = extractParagraphs(html);
  if (section.slug === 'about' && paragraphs.length < 2) {
    paragraphs = [
      'Երևանի Հայրապետ Հայրապետյանի անվան հ. 78 հիմնական դպրոցը պետական դպրոց է Արաբկիր վարչական շրջանում։ Հիմնադրվել է 1957 թվականին։',
      'Դպրոցը տալիս է հիմնական կրթություն և վարում է ակտիվ դպրոցական կյանք՝ աշակերտների, ծնողների և մանկավարժների համագործակցությամբ։',
      'Հասցե՝ Մարշալ Բաղրամյան պող. 57/2, Արաբկիր, Երևան 0019։ Հեռախոս՝ +374 10 225836։ Էլ. փոստ՝ school78@schools.am։',
    ];
  }

  const rawImages = collectImages(html).slice(0, MAX_IMAGES);
  const rawPdfs = collectPdfs(html);
  const usePersons =
    section.slug === 'staff' || section.slug === 'teachers';
  const rawPersons = usePersons ? extractStaffPersons(html) : [];

  console.log(
    `  scrape ${usedPath}: paras=${paragraphs.length} imgs=${rawImages.length} pdfs=${rawPdfs.length} persons=${rawPersons.length}`,
  );

  const images: string[] = [];
  for (const u of rawImages) {
    try {
      images.push(await uploadToDrive(drive, folderId, u, cache, dry));
      process.stdout.write('.');
    } catch (e) {
      console.warn(`\n  img skip ${u.slice(-40)}: ${String(e).slice(0, 80)}`);
    }
  }
  if (rawImages.length) process.stdout.write('\n');

  const pdfs: { name: string; url: string }[] = [];
  for (const p of rawPdfs) {
    try {
      const url = await uploadToDrive(drive, folderId, p.url, cache, dry);
      pdfs.push({ name: p.name, url });
      process.stdout.write('p');
    } catch (e) {
      console.warn(`\n  pdf skip: ${String(e).slice(0, 80)}`);
    }
  }
  if (rawPdfs.length) process.stdout.write('\n');

  const persons = [];
  for (const p of rawPersons) {
    try {
      const photo = await uploadToDrive(
        drive,
        folderId,
        p.photo,
        cache,
        dry,
      );
      persons.push({ ...p, photo });
    } catch {
      /* skip broken photo */
    }
  }

  const content = pageMarkdown({
    title: section.title,
    paragraphs,
    images,
    pdfs,
    persons: persons.length ? persons : undefined,
  });

  const cover = persons[0]?.photo || images[0] || null;
  if (!dry) {
    await upsertPage(
      section.slug,
      section.title,
      content,
      (paragraphs[0] || section.title).slice(0, 180),
      cover,
    );
  }

  return {
    chars: content.length,
    images: images.length,
    pdfs: pdfs.length,
    persons: persons.length,
  };
}

async function rehostWeeblyInPages(slugs: string[], dry: boolean) {
  const { drive, folderId } = createDriveClient();
  const cache = loadCache();
  for (const slug of slugs) {
    const page = await prisma.page.findUnique({ where: { slug } });
    if (!page) {
      console.warn(`rehost skip missing ${slug}`);
      continue;
    }
    const content =
      typeof page.content === 'object' && page.content && 'am' in page.content
        ? String((page.content as { am?: string }).am || '')
        : '';
    const urls = [
      ...new Set(
        [...content.matchAll(/https?:\/\/[^\s)\]]+/g)].map((m) =>
          m[0].replace(/[.,;]+$/, ''),
        ),
      ),
    ].filter(
      (u) =>
        /school78\.safe\.am|weebly/i.test(u) &&
        /\.(jpg|jpeg|png|gif|webp|pdf)(\?|$)/i.test(u),
    );
    console.log(`rehost ${slug}: ${urls.length} media urls`);
    let next = content;
    for (const u of urls) {
      try {
        const driveUrl = await uploadToDrive(drive, folderId, u, cache, dry);
        next = next.split(u).join(driveUrl);
        process.stdout.write('.');
      } catch (e) {
        console.warn(`\n  fail ${u.slice(-50)}: ${String(e).slice(0, 80)}`);
      }
    }
    if (urls.length) process.stdout.write('\n');
    let cover = page.coverImage;
    if (cover && /school78\.safe\.am|weebly/i.test(cover)) {
      try {
        cover = await uploadToDrive(drive, folderId, cover, cache, dry);
      } catch {
        /* keep */
      }
    }
    if (!dry) {
      await prisma.page.update({
        where: { slug },
        data: {
          content: Am(next),
          coverImage: cover,
        },
      });
    }
    saveCache(cache);
    console.log(`  OK ${slug}`);
  }
}

async function main() {
  const { batch, only, dry } = parseArgs();
  const rehost = process.argv
    .find((a) => a.startsWith('--rehost='))
    ?.slice('--rehost='.length)
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (rehost?.length) {
    console.log(`Rehosting Weebly media → Drive for: ${rehost.join(', ')}`);
    await rehostWeeblyInPages(rehost, dry);
    await prisma.$disconnect();
    return;
  }

  let sections = BATCHES[batch];
  if (!sections) {
    console.error(`Unknown batch "${batch}". Known: ${Object.keys(BATCHES)}`);
    process.exit(1);
  }
  if (only?.length) {
    sections = sections.filter((s) => only.includes(s.slug));
  }
  if (!sections.length) {
    console.error('No sections to migrate');
    process.exit(1);
  }

  console.log(
    `Migrating batch="${batch}" pages=${sections.map((s) => s.slug).join(', ')}${dry ? ' [DRY]' : ''}`,
  );
  console.log('Menu will NOT be changed.');

  const { drive, folderId } = createDriveClient();
  const cache = loadCache();

  let ok = 0;
  let fail = 0;
  for (const section of sections) {
    console.log(`\n→ ${section.slug}`);
    try {
      const stats = await migrateSection(
        section,
        drive,
        folderId,
        cache,
        dry,
      );
      saveCache(cache);
      console.log(
        `  OK chars=${stats.chars} imgs=${stats.images} pdfs=${stats.pdfs} persons=${stats.persons}`,
      );
      ok++;
    } catch (e) {
      fail++;
      console.error(`  FAIL ${section.slug}:`, e);
    }
  }

  console.log(`\nDone. ok=${ok} fail=${fail} cache=${Object.keys(cache).length}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
