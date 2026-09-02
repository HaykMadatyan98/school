/**
 * Clean import from old Weebly:
 * 1) Wipe CMS page content + Google Drive folder + local URL cache
 * 2) Pull every mapped page's `.wsite-section-content` as raw HTML
 * 3) Upload images → Drive /Картинки/<slug>/
 * 4) Upload documents → Drive /Документы/<slug>/
 * 5) Rewrite HTML media URLs to Drive; store as :::wsite-html (no TipTap)
 *
 * Run: npx tsx scripts/fresh-wsite-import.ts
 * Optional: ONLY=about,history DRY=1 SKIP_WIPE=1 CONCURRENCY=4
 */
import { PrismaClient, PostStatus } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

loadEnv();

const prisma = new PrismaClient();
const BASE = 'http://school78.safe.am';
const UA = 'School78FreshImport/1.0';
const CACHE_PATH = resolve(__dirname, '../.cache/fresh-wsite-map.json');
const OLD_CACHE = resolve(__dirname, '../.cache/media-drive-map.json');
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 4));
const DRY = process.env.DRY === '1';
const SKIP_WIPE = process.env.SKIP_WIPE === '1';
const ONLY = (process.env.ONLY || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const IMAGES_ROOT_NAME = 'Картинки';
const DOCS_ROOT_NAME = 'Документы';

type L = { en: string; ru: string; am: string };
const L = (am: string, en = '', ru = ''): L => ({ en, ru, am });

const SECTION_SOURCES: {
  slug: string;
  title: L;
  paths: string[];
  yearOf?: string;
}[] = [
  { slug: 'about', title: L('Մեր մասին'), paths: ['/134813811408-13961377140513871398.html'] },
  { slug: 'staff', title: L('Դպրոցի աշխատակազմ'), paths: ['/133214021408140014091387-1377139913891377140713771391137713821396.html'] },
  { slug: 'teachers', title: L('Մանկավարժներ'), paths: ['/134813771398139113771406137714081386139813811408.html'] },
  { slug: 'history', title: L('Դպրոցի պատմություն'), paths: ['/133214021408140014091387-14021377140713961400141013851397140014101398.html'] },
  { slug: 'management-board', title: L('Կառավարման խորհուրդ'), paths: ['/1343137714041377140613771408139613771398-13891400140813921400141014081380.html'] },
  { slug: 'parent-council', title: L('Ծնողական խորհուրդ'), paths: ['/13421398140013941377139113771398-13891400140813921400141014081380.html'] },
  { slug: 'student-council', title: L('Աշակերտական խորհուրդ'), paths: ['/13291399137713911381140814071377139113771398-13891400140813921400141014081380.html'] },
  { slug: 'board-of-trustees', title: L('Հոգաբարձուների խորհուրդ'), paths: ['/13441400137913771378137714081393140014101398138114081387-13891400140813921400141014081380.html'] },
  { slug: 'vacancies', title: L('Թափուր աշխատատեղեր'), paths: ['/133713771411140014101408-13771399138913771407137714071381139413811408.html'] },
  { slug: 'classrooms', title: L('Դասասենյակներ'), paths: ['/1332137714051377140513811398139713771391139813811408.html'] },

  { slug: 'school-life', title: L('Դպրոցական կյանք'), paths: [] },
  { slug: 'visits', title: L('Այցելություններ'), paths: ['/132913971409138113881400141013851397140014101398139813811408.html'] },
  { slug: 'visits-2025-2026', title: L('Այցելություններ 2025-2026'), paths: ['/1329139714091381138814001410138513971400141013981398138114082025-2026.html'], yearOf: 'visits' },
  { slug: 'visits-2024-2025', title: L('Այցելություններ 2024-2025'), paths: ['/2024-25-137713971409138113881400141013851397140014101398139813811408.html'], yearOf: 'visits' },
  { slug: 'meetings', title: L('Հանդիպումներ'), paths: ['/134413771398138013871402140014101396139813811408.html'] },
  { slug: 'meetings-2024-2025', title: L('Հանդիպումներ 2024-2025'), paths: ['/2024-2025-139213771398138013871402140014101396139813811408.html'], yearOf: 'meetings' },
  { slug: 'exemplary-lessons', title: L('Օրինակելի դասեր'), paths: ['/136514081387139813771391138113881387-13801377140513811408.html'] },
  { slug: 'exemplary-lessons-2025-2026', title: L('Օրինակելի դասեր 2025-2026'), paths: ['/136514081387139813771391138113881387-13801377140513811408-2025-2026.html'], yearOf: 'exemplary-lessons' },
  { slug: 'exemplary-lessons-2024-2025', title: L('Օրինակելի դասեր 2024-2025'), paths: ['/2024-2025-141314081387139813771391138113881387-13801377140513811408.html'], yearOf: 'exemplary-lessons' },
  { slug: 'project-based-learning', title: L('Նախագծային ուսուցում'), paths: ['/1350137713891377137913901377139713871398-140014101405140014101409140014101396.html'] },
  { slug: 'project-based-learning-2025-2026', title: L('Նախագծային ուսուցում 2025-2026'), paths: ['/1350137713891377137913901377139713871398-1400141014051400141014091400141013962025-2026.html'], yearOf: 'project-based-learning' },
  { slug: 'project-based-learning-2024-2025', title: L('Նախագծային ուսուցում 2024-2025'), paths: ['/1350137713891377137913901377139713871398-1400141014051400141014091400141013962024-25.html'], yearOf: 'project-based-learning' },
  { slug: 'lesson-led-by', title: L('Դասը վարում է…'), paths: ['/1332137714051384-140613771408140014101396-1383.html'] },
  { slug: 'events', title: L('Միջոցառումներ'), paths: ['/1348138714031400140913771404140014101396139813811408.html'] },
  { slug: 'events-2019-2020', title: L('Միջոցառումներ 2019-2020'), paths: ['/1348133913551352136113291356135213621348135013331360-2019-20.html'], yearOf: 'events' },

  { slug: 'assessment', title: L('Ներքին գնահատում'), paths: ['/135013811408141213871398-137913981377139213771407140014101396.html'] },
  { slug: 'assessment-2024-2025', title: L('Ներքին գնահատում 2024-2025'), paths: ['/135013331360136413391350-133113501329134413291359135213621348-2024-2025.html'], yearOf: 'assessment' },
  { slug: 'assessment-2025-2026', title: L('Ներքին գնահատում 2025-2026'), paths: [], yearOf: 'assessment' },
  { slug: 'assessment-2023-2024', title: L('Ներքին գնահատում 2023-2024'), paths: ['/135013331360136413391350-133113501329134413291359135213621348-2023-2024.html'], yearOf: 'assessment' },
  { slug: 'assessment-2021-2022', title: L('Ներքին գնահատում 2021-2022'), paths: ['/135013331360136413391350-133113501329134413291359135213621348-2021-22.html'], yearOf: 'assessment' },
  { slug: 'assessment-2020-2021', title: L('Ներքին գնահատում 2020-2021'), paths: ['/135013331360136413391350-133113501329134413291359135213621348-2020-21.html'], yearOf: 'assessment' },
  { slug: 'assessment-2019-2020', title: L('Ներքին գնահատում 2019-2020'), paths: ['/135013331360136413391350-1331135013291344132913591352136213482019-2020.html'], yearOf: 'assessment' },
  { slug: 'assessment-2018-2019', title: L('Ներքին գնահատում 2018-2019'), paths: ['/135013331360136413391350-133113501329134413291359135213621348-2018-2019.html'], yearOf: 'assessment' },
  { slug: 'assessment-2017-2018', title: L('Ներքին գնահատում 2017-2018'), paths: ['/135013811408141213871398-137913981377139213771407140014101396-2017-2018.html'], yearOf: 'assessment' },
  { slug: 'assessment-2016-2017', title: L('Ներքին գնահատում 2016-2017'), paths: ['/13501381141213871398-1379139813771392137714071400141013962016-2017.html'], yearOf: 'assessment' },
  { slug: 'assessment-2015-2016', title: L('Ներքին գնահատում 2015-2016'), paths: ['/13501381141213871398-1379139813771392137714071400141013962015-2016.html'], yearOf: 'assessment' },
  { slug: 'voluntary-attestation', title: L('Կամավոր ատեստավորում'), paths: ['/1343132913481329135813521360-132913591333135713591329135813521360135214101348.html'] },

  { slug: 'documents', title: L('Փաստաթղթեր'), paths: ['/1363137714051407137713851394138513811408.html'] },
  { slug: 'internal-rules', title: L('Ներքին կարգապահական կանոններ'), paths: ['/135013811408141213871398-139113771408137913771402137713921377139113771398-13911377139814001398139813811408.html'] },
  { slug: 'license', title: L('Լիցենզիա'), paths: ['/13401387140913811398138213871377.html'] },
  { slug: 'reports', title: L('Հաշվետվություններ'), paths: ['/13441377139914061381140714061400141013851397140014101398139813811408.html'] },
  { slug: 'finances', title: L('Ֆինանսներ'), paths: ['/136613871398137713981405139813811408.html'] },

  { slug: 'psychologist', title: L('Հոգեբանի անկյուն'), paths: ['/13441400137913811378137713981387-1377139813911397140014101398.html'] },
  { slug: 'special-educator', title: L('Հատուկ մանկավարժ'), paths: ['/134413771407140014101391-139613771398139113771406137714081386.html'] },
  { slug: 'social-educator', title: L('Սոցիալական մանկավարժ'), paths: ['/1357140014091387137713881377139113771398-139613771398139113771406137714081386.html'] },
  { slug: 'pedagogical-workshop', title: L('Մանկավարժական արհեստանոց'), paths: ['/1348137713981391137714061377140813861377139113771398-1377140813921381140514071377139814001409.html'] },
  { slug: 'educational-guides', title: L('Կրթական ուղեցույցներ'), paths: ['/1343140813851377139113771398-140014101394138114091400141013971409139813811408.html'] },
  { slug: 'educational-resources', title: L('Կրթական ռեսուրսներ'), paths: ['/1343140813851377139113771398-1404138114051400141014081405139813811408.html'] },

  { slug: 'clubs', title: L('Ակումբներ'), paths: ['/132913431352136213481330135013331360.html'] },
  { slug: 'eco', title: L('Էկո'), paths: ['/133513431352.html'] },
  { slug: 'sports', title: L('Սպորտային'), paths: ['/135713541352136013591329134913391350.html'] },
  { slug: 'english-club', title: L('Անգլերենի խմբակ'), paths: ['/132913981379138813811408138113981387-13891396137813771391.html'] },
  { slug: 'yerevan-studies', title: L('Երևանագիտություն'), paths: ['/1333140814151377139813771379138714071400141013851397140014101398.html'] },
  { slug: 'unesco', title: L('ՅՈՒՆԵՍԿՕ'), paths: ['/13491352136213501333135713431365.html'] },
  { slug: 'my-hero', title: L('Իմ հերոսը'), paths: ['/13391348-134413331360135213571336.html'] },
  { slug: 'awards', title: L('Մրցանակներ'), paths: ['/1348140814091377139813771391139813811408.html'] },
  { slug: 'family', title: L('Ընտանիք'), paths: ['/1336139814071377139813871412.html'] },
  { slug: 'summer-assignments', title: L('Ամառային հանձնարարություններ'), paths: ['/13291396137714041377139713871398-1392137713981393139813771408137714081400141013851397140014101398139813811408.html'] },
  { slug: 'tip-of-the-day', title: L('Օրվա խորհուրդը'), paths: ['/1365140814061377-138914001408139214001410140813801384.html'] },

  { slug: 'gallery', title: L('Պատկերասրահ'), paths: ['/13541377140713911381140813771405140813771392.html'] },
  { slug: 'photo-gallery', title: L('Ֆոտոսրահ'), paths: ['/13661400140714001405140813771392.html'] },
  { slug: 'video-gallery', title: L('Տեսասրահ'), paths: ['/13591381140513771405140813771392.html'] },

  { slug: 'archive', title: L('Արխիվ'), paths: ['/-13291408138913871406.html'] },
  { slug: 'news-2025-2026', title: L('Նորություններ 2025-2026'), paths: ['/'], yearOf: 'archive' },
  { slug: 'news-2024-2025', title: L('Նորություններ 2024-2025'), paths: ['/2024-2025-1350135213601352136213371349135213621350135013331360.html'], yearOf: 'archive' },
  { slug: 'news-2023-2024', title: L('Նորություններ 2023-2024'), paths: ['/2023-2024-1350135213601352136213371349135213621350135013331360.html'], yearOf: 'archive' },
  { slug: 'news-2022-2023', title: L('Նորություններ 2022-2023'), paths: ['/2022-2023-1350135213601352136213371349135213621350135013331360.html'], yearOf: 'archive' },
  { slug: 'news-2021-2022', title: L('Նորություններ 2021-2022'), paths: ['/2021-2022-1350135213601352136213371349135213621350135013331360.html'], yearOf: 'archive' },
  { slug: 'news-2020-2021', title: L('Նորություններ 2020-2021'), paths: ['/1350135213601352136213371349135213621350135013331360-2020-2021-2019-2020.html'], yearOf: 'archive' },
  { slug: 'news-2018-2019', title: L('Նորություններ 2018-2019'), paths: ['/1350140014081400141013851397140014101398139813811408-2018-19.html'], yearOf: 'archive' },
  { slug: 'news-2017-2018', title: L('Նորություններ 2017-2018'), paths: ['/1350140014081400141013851397140014101398139813811408-2017-18.html'], yearOf: 'archive' },
  { slug: 'news-2016-2017', title: L('Նորություններ 2016-2017'), paths: ['/1350140014081400141013851397140014101398139813811408-2016-2017.html'], yearOf: 'archive' },
  { slug: 'news-2015-2016', title: L('Նորություններ 2015-2016'), paths: ['/1350140014081400141013851397140014101398139813811408-2015-2016.html'], yearOf: 'archive' },
  { slug: 'news-2014-2015', title: L('Նորություններ 2014-2015'), paths: ['/1350140014081400141013851397140014101398139813811408-2014-2015.html'], yearOf: 'archive' },
  { slug: 'news-2013-2014', title: L('Նորություններ 2013-2014'), paths: ['/1350140014081400141013851397140014101398139813811408-2013-2014.html'], yearOf: 'archive' },
  { slug: 'news-2012-2013', title: L('Նորություններ 2012-2013'), paths: ['/1350140014081400141013851397140014101398139813811408-2012-20131400141014051407137714081387.html'], yearOf: 'archive' },
  { slug: 'news-2011-2012', title: L('Նորություններ 2011-2012'), paths: ['/2011-20121400141014051407137714081387.html'], yearOf: 'archive' },
];

type DriveClient = {
  drive: drive_v3.Drive;
  rootFolderId: string;
};

type ImportCache = {
  folders: {
    imagesRoot?: string;
    docsRoot?: string;
    bySlug: Record<string, { images?: string; docs?: string }>;
  };
  files: Record<string, string>;
};

function emptyCache(): ImportCache {
  return { folders: { bySlug: {} }, files: {} };
}

function loadCache(): ImportCache {
  try {
    if (existsSync(CACHE_PATH)) {
      const raw = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as ImportCache;
      if (!raw.folders) raw.folders = { bySlug: {} };
      if (!raw.folders.bySlug) raw.folders.bySlug = {};
      if (!raw.files) raw.files = {};
      return raw;
    }
  } catch {
    /* ignore */
  }
  return emptyCache();
}

function saveCache(cache: ImportCache) {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

function absUrl(u: string) {
  if (!u) return u;
  const cleaned = u.trim().replace(/^['"]|['"]$/g, '');
  if (cleaned.startsWith('http')) return cleaned;
  if (cleaned.startsWith('//')) return `http:${cleaned}`;
  if (cleaned.startsWith('/')) return `${BASE}${cleaned}`;
  return `${BASE}/${cleaned}`;
}

function extractSectionContents(html: string): string[] {
  const sections: string[] = [];
  const re =
    /<div([^>]*\bclass=["'][^"']*\bwsite-section-content\b[^"']*["'][^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const start = m.index + m[0].length;
    let i = start;
    let depth = 1;
    while (i < html.length && depth > 0) {
      const nextOpen = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);
      if (nextClose < 0) break;
      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth++;
        i = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) {
          sections.push(html.slice(start, nextClose));
          break;
        }
        i = nextClose + 6;
      }
    }
  }
  return sections;
}

function isJunkImage(url: string) {
  const u = url.toLowerCase();
  return (
    u.includes('background-images/') ||
    u.includes('footer-toast') ||
    u.includes('/published/78-1.jpg') ||
    u.includes('686098162') ||
    /\/(icon|logo|button|spacer|favicon)/i.test(u) ||
    u.startsWith('data:')
  );
}

function isDocUrl(url: string) {
  return /\.(pdf|docx?|xlsx?|pptx?)(\?|$)/i.test(url);
}

function isImageUrl(url: string) {
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)) return true;
  // Weebly uploads often omit extension in path quirks — still treat uploads as images if not doc
  if (/\/uploads\//i.test(url) && !isDocUrl(url)) return true;
  return false;
}

function sanitizeSectionHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\son\w+=["'][^"']*["']/gi, '')
    .replace(/\son\w+=[^\s>]+/gi, '');
}

function collectMedia(html: string) {
  const images = new Set<string>();
  const docs = new Set<string>();

  for (const m of html.matchAll(
    /<(?:img|source)\b[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*>/gi,
  )) {
    const abs = absUrl(decodeURIComponent(m[1].split('?')[0]));
    if (!abs || isJunkImage(abs)) continue;
    if (isImageUrl(abs)) images.add(abs);
  }

  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const abs = absUrl(decodeURIComponent(m[1].split('?')[0]));
    if (!abs) continue;
    if (isDocUrl(abs)) docs.add(abs);
  }

  // Weebly sometimes puts files in onclick / data attributes lightly — skip for now
  return { images: [...images], docs: [...docs] };
}

function rewriteHtmlUrls(html: string, map: Record<string, string>) {
  let out = html;
  const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of entries) {
    if (!from || from === to) continue;
    // Replace absolute and path-only forms
    out = out.split(from).join(to);
    try {
      const pathOnly = new URL(from).pathname;
      if (pathOnly && pathOnly.length > 8) {
        out = out.split(pathOnly).join(to);
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

function wrapWsiteHtml(sections: string[]) {
  const body = sections
    .map((s) => `<div class="wsite-section-content">${s}</div>`)
    .join('\n');
  return `:::wsite-html\n${body}\n:::`;
}

function hubHtml(
  title: string,
  children: { slug: string; title: string }[],
) {
  const links = children
    .map((c) => `<li><a href="/p/${c.slug}">${c.title}</a></li>`)
    .join('\n');
  return wrapWsiteHtml([
    `<p>${title} բաժնի էջ։ Ընտրեք ենթաբաժինը.</p><ul>${links}</ul>`,
  ]);
}

async function fetchHtml(path: string) {
  const url = path.startsWith('http') ? path : absUrl(path);
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function getDrive(): Promise<DriveClient | null> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const refresh = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!folderId || !refresh || !clientId || !clientSecret) return null;
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refresh });
  return {
    drive: google.drive({ version: 'v3', auth: oauth2 }),
    rootFolderId: folderId,
  };
}

async function listChildren(drive: drive_v3.Drive, parentId: string) {
  const items: { id: string; name: string; mimeType: string }[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files || []) {
      if (f.id && f.name) {
        items.push({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType || '',
        });
      }
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);
  return items;
}

async function deleteRecursive(drive: drive_v3.Drive, fileId: string) {
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

async function wipeDrive(client: DriveClient) {
  console.log('Wiping Drive folder children…');
  const children = await listChildren(client.drive, client.rootFolderId);
  console.log(`  found ${children.length} top-level items`);
  let deleted = 0;
  let failed = 0;
  await mapPool(children, 12, async (child) => {
    try {
      await deleteRecursive(client.drive, child.id);
      deleted++;
      if (deleted % 100 === 0) {
        console.log(`  deleted ${deleted}/${children.length}`);
      }
    } catch (e) {
      failed++;
      if (failed <= 20) {
        console.warn('  delete fail', child.name, String(e).slice(0, 80));
      }
    }
  });
  console.log({ driveDeleted: deleted, driveDeleteFail: failed, total: children.length });
}

async function wipeCms() {
  console.log('Clearing CMS page content…');
  const pages = await prisma.page.findMany({ select: { id: true, slug: true } });
  for (const p of pages) {
    await prisma.page.update({
      where: { id: p.id },
      data: {
        content: { am: '', en: '', ru: '' },
        coverImage: null,
        excerpt: { am: '', en: '', ru: '' },
      },
    });
  }
  console.log({ pagesCleared: pages.length });
}

async function wipeCaches() {
  for (const p of [CACHE_PATH, OLD_CACHE]) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
  console.log('Caches cleared');
}

async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string,
  cacheId?: string,
) {
  if (cacheId) {
    try {
      const meta = await drive.files.get({
        fileId: cacheId,
        fields: 'id,trashed',
        supportsAllDrives: true,
      });
      if (meta.data.id && !meta.data.trashed) return meta.data.id;
    } catch {
      /* recreate */
    }
  }
  const existing = await listChildren(drive, parentId);
  const hit = existing.find(
    (f) =>
      f.name === name &&
      f.mimeType === 'application/vnd.google-apps.folder',
  );
  if (hit) return hit.id;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  return created.data.id!;
}

async function ensurePageFolders(
  client: DriveClient,
  cache: ImportCache,
  slug: string,
) {
  if (!cache.folders.imagesRoot) {
    cache.folders.imagesRoot = await findOrCreateFolder(
      client.drive,
      IMAGES_ROOT_NAME,
      client.rootFolderId,
      cache.folders.imagesRoot,
    );
  }
  if (!cache.folders.docsRoot) {
    cache.folders.docsRoot = await findOrCreateFolder(
      client.drive,
      DOCS_ROOT_NAME,
      client.rootFolderId,
      cache.folders.docsRoot,
    );
  }
  const by = cache.folders.bySlug[slug] || {};
  if (!by.images) {
    by.images = await findOrCreateFolder(
      client.drive,
      slug,
      cache.folders.imagesRoot!,
      by.images,
    );
  }
  if (!by.docs) {
    by.docs = await findOrCreateFolder(
      client.drive,
      slug,
      cache.folders.docsRoot!,
      by.docs,
    );
  }
  cache.folders.bySlug[slug] = by;
  return by as { images: string; docs: string };
}

async function uploadFile(
  client: DriveClient,
  remoteUrl: string,
  parentFolderId: string,
  cache: ImportCache,
  kind: 'image' | 'doc',
) {
  if (cache.files[remoteUrl]) return cache.files[remoteUrl];
  if (/googleusercontent\.com|drive\.google\.com/i.test(remoteUrl)) {
    cache.files[remoteUrl] = remoteUrl;
    return remoteUrl;
  }

  const res = await fetch(remoteUrl, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  let contentType =
    res.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
  if (/\.pdf$/i.test(remoteUrl)) contentType = 'application/pdf';
  else if (/\.docx$/i.test(remoteUrl)) {
    contentType =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (/\.doc$/i.test(remoteUrl)) contentType = 'application/msword';
  else if (/\.png$/i.test(remoteUrl)) contentType = 'image/png';
  else if (/\.(jpe?g)$/i.test(remoteUrl)) contentType = 'image/jpeg';
  else if (/\.gif$/i.test(remoteUrl)) contentType = 'image/gif';
  else if (/\.webp$/i.test(remoteUrl)) contentType = 'image/webp';

  let original = 'file';
  try {
    original = basename(decodeURIComponent(new URL(remoteUrl).pathname));
  } catch {
    /* ignore */
  }
  const name = `${Date.now()}-${original.replace(/[^\w.\-()+ \u0400-\u04FF\u0530-\u058F]+/gi, '_')}`.slice(
    0,
    180,
  );

  const created = await client.drive.files.create({
    requestBody: {
      name,
      parents: [parentFolderId],
      description: `fresh wsite ${kind} ${remoteUrl}`,
    },
    media: { mimeType: contentType, body: Readable.from(buf) },
    fields: 'id',
    supportsAllDrives: true,
  });
  const fileId = created.data.id!;
  await client.drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });

  const view =
    kind === 'doc'
      ? `https://drive.google.com/file/d/${fileId}/view`
      : `https://lh3.googleusercontent.com/d/${fileId}`;
  cache.files[remoteUrl] = view;
  return view;
}

async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<void>,
) {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, () =>
      worker(),
    ),
  );
}

function yearLabelFromSlug(slug: string) {
  const m = slug.match(/(20\d{2})-(20\d{2})$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

function firstImageUrl(html: string) {
  const m = html.match(/https:\/\/lh3\.googleusercontent\.com\/d\/[a-zA-Z0-9_-]+/);
  return m?.[0] || null;
}

async function main() {
  const client = DRY ? null : await getDrive();
  if (!DRY && !client) {
    throw new Error('Google Drive OAuth / GOOGLE_DRIVE_FOLDER_ID not configured');
  }

  if (!SKIP_WIPE && !DRY) {
    await wipeDrive(client!);
    await wipeCms();
    await wipeCaches();
  } else if (!SKIP_WIPE && DRY) {
    console.log('DRY: would wipe Drive + CMS + caches');
  }

  const cache = SKIP_WIPE ? loadCache() : emptyCache();
  console.log(
    'Cache files',
    Object.keys(cache.files).length,
    'page folders',
    Object.keys(cache.folders.bySlug).length,
  );
  const sources = SECTION_SOURCES.filter(
    (s) => !ONLY.length || ONLY.includes(s.slug),
  );

  type Prepared = {
    slug: string;
    title: string;
    yearOf?: string;
    html: string;
    images: string[];
    docs: string[];
  };
  const prepared: Prepared[] = [];

  for (const src of sources) {
    const title = src.title.am;

    if (!src.paths.length) {
      const hubKids =
        src.slug === 'school-life'
          ? [
              { slug: 'visits', title: 'Այցելություններ' },
              { slug: 'meetings', title: 'Հանդիպումներ' },
              { slug: 'exemplary-lessons', title: 'Օրինակելի դասեր' },
              { slug: 'project-based-learning', title: 'Նախագծային ուսուցում' },
              { slug: 'lesson-led-by', title: 'Դասը վարում է…' },
              { slug: 'events', title: 'Միջոցառումներ' },
            ]
          : SECTION_SOURCES.filter((s) => s.yearOf === src.slug).map((s) => ({
              slug: s.slug,
              title: s.title.am,
            }));
      prepared.push({
        slug: src.slug,
        title,
        yearOf: src.yearOf,
        html: hubHtml(title, hubKids),
        images: [],
        docs: [],
      });
      console.log('HUB', src.slug);
      continue;
    }

    const sections: string[] = [];
    for (const path of src.paths) {
      try {
        const pageHtml = await fetchHtml(path);
        let found = extractSectionContents(pageHtml).map(sanitizeSectionHtml);
        found = found.filter((s) => s.replace(/\s+/g, '').length > 40);
        if (!found.length) {
          const m = pageHtml.match(
            /id=["']wsite-content["'][^>]*>([\s\S]*?)(?:<div[^>]*wsite-footer|<\/body>)/i,
          );
          if (m) found = [sanitizeSectionHtml(m[1])];
        }
        // Prefer largest sections; keep up to 4
        found.sort((a, b) => b.length - a.length);
        sections.push(...found.slice(0, 4));
        console.log(
          'SCRAPE',
          src.slug,
          path.slice(0, 48),
          'sections',
          found.length,
        );
      } catch (e) {
        console.warn('FAIL fetch', src.slug, path, String(e).slice(0, 100));
      }
    }

    // Deduplicate near-identical sections
    const uniq: string[] = [];
    const seen = new Set<string>();
    for (const s of sections) {
      const key = s.replace(/\s+/g, ' ').slice(0, 200);
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(s);
    }

    const rawJoined = uniq.join('\n');
    const media = collectMedia(rawJoined);
    prepared.push({
      slug: src.slug,
      title,
      yearOf: src.yearOf,
      html: wrapWsiteHtml(uniq),
      images: media.images,
      docs: media.docs,
    });
    console.log(
      'READY',
      src.slug,
      'html',
      rawJoined.length,
      'img',
      media.images.length,
      'docs',
      media.docs.length,
    );
  }

  // Upload media per page into folder tree
  let uploadOk = 0;
  let uploadFail = 0;
  if (client && !DRY) {
    for (const item of prepared) {
      if (!item.images.length && !item.docs.length) continue;
      const folders = await ensurePageFolders(client, cache, item.slug);
      saveCache(cache);

      const jobs: { url: string; kind: 'image' | 'doc'; folder: string }[] = [
        ...item.images.map((url) => ({
          url,
          kind: 'image' as const,
          folder: folders.images,
        })),
        ...item.docs.map((url) => ({
          url,
          kind: 'doc' as const,
          folder: folders.docs,
        })),
      ];

      console.log(
        `UPLOAD ${item.slug} images=${item.images.length} docs=${item.docs.length}`,
      );

      await mapPool(jobs, CONCURRENCY, async (job, i) => {
        try {
          await uploadFile(client, job.url, job.folder, cache, job.kind);
          uploadOk++;
          if ((i + 1) % 25 === 0 || i === jobs.length - 1) {
            saveCache(cache);
            console.log(
              `  ${item.slug} ${uploadOk + uploadFail} ok=${uploadOk} fail=${uploadFail}`,
            );
          }
        } catch (e) {
          uploadFail++;
          console.warn(
            '  fail',
            job.url.slice(0, 90),
            String(e).slice(0, 80),
          );
        }
      });
      saveCache(cache);
    }
  }

  // Save pages with rewritten HTML
  let saved = 0;
  let empty = 0;
  for (const item of prepared) {
    let html = item.html;
    html = rewriteHtmlUrls(html, cache.files);

    // Strip empty wrap
    const inner = html
      .replace(/^:::wsite-html\n?/, '')
      .replace(/\n?:::\s*$/, '')
      .trim();
    if (!inner || inner.length < 20) {
      empty++;
      console.warn('empty', item.slug);
      continue;
    }

    const cover = firstImageUrl(html);
    const yearLabel = yearLabelFromSlug(item.slug);
    const parentSlug = item.yearOf || null;

    if (DRY) {
      console.log('DRY save', item.slug, 'chars', html.length, 'cover', !!cover);
      saved++;
      continue;
    }

    const existing = await prisma.page.findUnique({ where: { slug: item.slug } });
    const content = { am: html, en: '', ru: '' };

    if (existing) {
      await prisma.page.update({
        where: { id: existing.id },
        data: {
          content,
          coverImage: cover,
          status: PostStatus.PUBLISHED,
          parentSlug: parentSlug || existing.parentSlug,
          yearLabel: yearLabel || existing.yearLabel,
          title: {
            am: item.title,
            en: (existing.title as { en?: string })?.en || '',
            ru: (existing.title as { ru?: string })?.ru || '',
          },
        },
      });
    } else {
      await prisma.page.create({
        data: {
          slug: item.slug,
          title: L(item.title),
          content,
          coverImage: cover,
          status: PostStatus.PUBLISHED,
          parentSlug,
          yearLabel,
        },
      });
    }
    saved++;
    console.log('saved', item.slug, 'chars', html.length);
  }

  // Report leftover school78 URLs in saved content
  if (!DRY) {
    const leftovers = await prisma.page.findMany({
      select: { slug: true, content: true },
    });
    let pagesWithLegacy = 0;
    let legacyHits = 0;
    for (const p of leftovers) {
      const am = ((p.content as { am?: string })?.am || '') as string;
      const n = (am.match(/school78\.safe\.am/gi) || []).length;
      if (n) {
        pagesWithLegacy++;
        legacyHits += n;
        console.warn('legacy urls', p.slug, n);
      }
    }
    console.log({
      saved,
      empty,
      uploadOk,
      uploadFail,
      pagesWithLegacy,
      legacyHits,
      driveFiles: Object.keys(cache.files).length,
    });
  } else {
    console.log({ dry: true, saved, empty });
  }

  saveCache(cache);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
