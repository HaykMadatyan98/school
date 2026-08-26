/**
 * Rebuild Media section: aggregate all CMS images + scrape YouTube from old site
 * into gallery / photo-gallery / video-gallery.
 *
 * Run: npx tsx scripts/rebuild-media-section.ts
 */
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { basename } from 'path';

loadEnv();

const prisma = new PrismaClient();
const UA = 'School78MediaRebuild/1.0';
const BASE = 'http://school78.safe.am';
const CACHE_PATH = resolve(__dirname, '../.cache/media-drive-map.json');
const CONCURRENCY = 6;

type Cache = Record<string, string>;

function loadCache(): Cache {
  try {
    if (existsSync(CACHE_PATH)) {
      return JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as Cache;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function saveCache(cache: Cache) {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

function stripPersonBlocks(md: string) {
  return md.replace(/:::person[\s\S]*?:::/g, '');
}

function collectImagesFromMarkdown(md: string, into: Map<string, true>) {
  for (const m of stripPersonBlocks(md).matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    const u = m[1].trim().split('?')[0];
    if (!u || u === '#' || u.startsWith('about:')) continue;
    into.set(u, true);
  }
}

function youtubeUrlsFromText(text: string, into: Map<string, true>) {
  for (const m of text.matchAll(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/gi,
  )) {
    into.set(`https://www.youtube.com/watch?v=${m[1]}`, true);
  }
}

async function fetchHtml(path: string) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function collectOldSiteImages(html: string) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(
    /\/uploads\/[^"'\\\s<>]+\.(?:jpg|jpeg|png|gif|webp)/gi,
  )) {
    let u = m[0].split('?')[0];
    try {
      u = decodeURIComponent(u);
    } catch {
      /* keep */
    }
    const abs = u.startsWith('http') ? u : `${BASE}${u}`;
    if (/background-images|footer-toast|\/published\/78-1\.jpg|686098162/i.test(abs)) {
      continue;
    }
    if (seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }
  return out;
}

async function getDrive() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID missing');
  const refresh = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!refresh || !clientId || !clientSecret) {
    throw new Error('OAuth credentials missing');
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refresh });
  return { drive: google.drive({ version: 'v3', auth: oauth2 }), folderId };
}

async function uploadOne(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  remoteUrl: string,
  cache: Cache,
) {
  if (cache[remoteUrl]) return cache[remoteUrl];
  if (/googleusercontent\.com|drive\.google\.com/i.test(remoteUrl)) {
    cache[remoteUrl] = remoteUrl;
    return remoteUrl;
  }
  const res = await fetch(remoteUrl, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  let contentType =
    res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  if (/\.png$/i.test(remoteUrl)) contentType = 'image/png';
  else if (/\.gif$/i.test(remoteUrl)) contentType = 'image/gif';
  else if (/\.webp$/i.test(remoteUrl)) contentType = 'image/webp';
  else contentType = 'image/jpeg';

  let original = 'file.jpg';
  try {
    original = basename(decodeURIComponent(new URL(remoteUrl).pathname)) || original;
  } catch {
    /* ignore */
  }
  const name = `${Date.now()}-${original.replace(/[^\w.\-()+ ]+/gi, '_')}`.slice(
    0,
    180,
  );
  const created = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId],
      description: `Media gallery from ${remoteUrl}`,
    },
    media: { mimeType: contentType, body: Readable.from(buf) },
    fields: 'id',
    supportsAllDrives: true,
  });
  const fileId = created.data.id;
  if (!fileId) throw new Error('no id');
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });
  const view = `https://lh3.googleusercontent.com/d/${fileId}`;
  cache[remoteUrl] = view;
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
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
}

const NEWS_PATHS = [
  '/',
  '/2024-2025-1350135213601352136213371349135213621350135013331360.html',
  '/2024-2025-13501352136013521362133713491352136213501350133313601.html',
  '/2023-2024-1350135213601352136213371349135213621350135013331360.html',
  '/2022-2023-1350135213601352136213371349135213621350135013331360.html',
  '/2021-2022-1350135213601352136213371349135213621350135013331360.html',
  '/1350135213601352136213371349135213621350135013331360-2020-2021-2019-2020.html',
  '/1350140014081400141013851397140014101398139813811408-2018-19.html',
  '/1350140014081400141013851397140014101398139813811408-2017-18.html',
  '/1350140014081400141013851397140014101398139813811408-2016-2017.html',
  '/1350140014081400141013851397140014101398139813811408-2015-2016.html',
  '/1350140014081400141013851397140014101398139813811408-2014-2015.html',
  '/1350140014081400141013851397140014101398139813811408-2013-2014.html',
  '/1350140014081400141013851397140014101398139813811408-2012-20131400141014051407137714081387.html',
  '/2011-20121400141014051407137714081387.html',
  '/13591381140513771405140813771392.html',
  '/13661400140714001405140813771392.html',
  '/13541377140713911381140813771405140813771392.html',
];

function buildPhotoMarkdown(intro: string, urls: string[]) {
  const lines = [intro, '', '### Լուսանկարներ', ''];
  for (const u of urls) lines.push(`![ ](${u})`, '');
  return lines.join('\n').trim();
}

function buildVideoMarkdown(intro: string, urls: string[]) {
  const lines = [intro, '', '### Տեսանյութեր', ''];
  for (const u of urls) {
    const id = u.match(/[?&]v=([\w-]{6,})/)?.[1] || u;
    lines.push(`[Տեսանյութ](${u})`, '');
  }
  return lines.join('\n').trim();
}

function buildGalleryMarkdown(photos: string[], videos: string[]) {
  const lines = [
    'Դպրոցական մեդիա՝ լուսանկարներ և տեսանյութեր։',
    '',
    `- [Ֆոտոսրահ](/p/photo-gallery) · ${photos.length} լուսանկար`,
    `- [Տեսասրահ](/p/video-gallery) · ${videos.length} տեսանյութ`,
    '',
  ];
  if (photos.length) {
    lines.push('### Լուսանկարներ', '');
    for (const u of photos) lines.push(`![ ](${u})`, '');
  }
  if (videos.length) {
    lines.push('### Տեսանյութեր', '');
    for (const u of videos) lines.push(`[Տեսանյութ](${u})`, '');
  }
  return lines.join('\n').trim();
}

async function main() {
  const cache = loadCache();
  const pages = await prisma.page.findMany();

  const images = new Map<string, true>();
  const videos = new Map<string, true>();

  for (const page of pages) {
    // Skip media targets themselves to avoid feedback loops of old stubs
    if (
      page.slug === 'gallery' ||
      page.slug === 'photo-gallery' ||
      page.slug === 'video-gallery'
    ) {
      continue;
    }
    const am = ((page.content as { am?: string })?.am || '') as string;
    collectImagesFromMarkdown(am, images);
    youtubeUrlsFromText(am, videos);
  }

  console.log('From CMS pages: images', images.size, 'videos', videos.size);

  // Scrape old photo gallery + news for more images/videos
  const pendingUpload: string[] = [];
  for (const path of NEWS_PATHS) {
    try {
      const html = await fetchHtml(path);
      youtubeUrlsFromText(html, videos);
      for (const u of collectOldSiteImages(html)) {
        if (/googleusercontent|drive\.google/.test(u)) {
          images.set(u, true);
        } else if (cache[u]) {
          images.set(cache[u], true);
        } else {
          pendingUpload.push(u);
        }
      }
      console.log('scraped', path, 'videos now', videos.size);
    } catch (e) {
      console.warn('skip', path, String(e).slice(0, 80));
    }
  }

  const uniqPending = [...new Set(pendingUpload)].filter((u) => !cache[u]);
  console.log('Need Drive upload:', uniqPending.length);

  if (uniqPending.length) {
    const { drive, folderId } = await getDrive();
    let ok = 0;
    let fail = 0;
    await mapPool(uniqPending, CONCURRENCY, async (url, i) => {
      try {
        const view = await uploadOne(drive, folderId, url, cache);
        images.set(view, true);
        ok++;
        if ((i + 1) % 25 === 0 || i === uniqPending.length - 1) {
          saveCache(cache);
          console.log(`upload ${ok + fail}/${uniqPending.length} ok=${ok}`);
        }
      } catch (e) {
        fail++;
        console.warn('FAIL', url.slice(0, 90), String(e).slice(0, 80));
      }
    });
    saveCache(cache);
    console.log({ uploadedOk: ok, uploadedFail: fail });
  }

  // Also resolve any leftover school78 URLs already in `images` via cache
  for (const u of [...images.keys()]) {
    if (cache[u]) {
      images.delete(u);
      images.set(cache[u], true);
    } else if (/school78\.safe\.am/i.test(u)) {
      images.delete(u); // don't keep dead hotlinks in gallery
    }
  }

  const photoList = [...images.keys()];
  const videoList = [...videos.keys()];
  console.log('Final photos', photoList.length, 'videos', videoList.length);

  const photoAm = buildPhotoMarkdown(
    'Դպրոցական կյանքի ֆոտոսրահ՝ բոլոր լուսանկարները մեկ տեղում։',
    photoList,
  );
  const videoAm = buildVideoMarkdown(
    videoList.length
      ? 'Դպրոցական տեսանյութերի սրահ։'
      : 'Դպրոցական տեսանյութերի սրահ։ Նոր տեսանյութերը կավելացվեն այստեղ։',
    videoList,
  );
  const galleryAm = buildGalleryMarkdown(photoList, videoList);

  for (const [slug, am, excerpt] of [
    [
      'photo-gallery',
      photoAm,
      `Ֆոտոսրահ · ${photoList.length} լուսանկար`,
    ],
    [
      'video-gallery',
      videoAm,
      `Տեսասրահ · ${videoList.length} տեսանյութ`,
    ],
    [
      'gallery',
      galleryAm,
      `Մեդիա · ${photoList.length} լուսանկար, ${videoList.length} տեսանյութ`,
    ],
  ] as const) {
    const page = await prisma.page.findUnique({ where: { slug } });
    if (!page) {
      console.warn('missing page', slug);
      continue;
    }
    const content = page.content as { am?: string; en?: string; ru?: string };
    await prisma.page.update({
      where: { id: page.id },
      data: {
        content: { ...content, am },
        excerpt: {
          am: excerpt,
          en: excerpt,
          ru: excerpt,
        },
      },
    });
    console.log('updated', slug, 'chars', am.length);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
