/**
 * Upload every legacy school78/weebly media URL found in CMS pages to Google Drive,
 * then rewrite page content + coverImage to Drive URLs.
 *
 * Resumable via apps/api/.cache/media-drive-map.json
 * Run: npx tsx scripts/migrate-all-media-to-drive.ts
 * Optional: CONCURRENCY=4 DRY=1
 */
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { google } from 'googleapis';
import { Readable } from 'stream';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'fs';
import { basename, dirname, resolve } from 'path';

loadEnv();

const prisma = new PrismaClient();
const UA = 'School78MediaMigrate/1.0';
const CACHE_PATH = resolve(__dirname, '../.cache/media-drive-map.json');
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 4));
const DRY = process.env.DRY === '1';

type UrlCache = Record<string, string>;

function loadCache(): UrlCache {
  try {
    if (existsSync(CACHE_PATH)) {
      return JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as UrlCache;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function saveCache(cache: UrlCache) {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 0));
}

function needsMigrate(url: string) {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (/googleusercontent\.com|drive\.google\.com/i.test(url)) return false;
  return /school78\.safe\.am|weebly\.com|editmysite\.com|\/uploads\//i.test(
    url,
  );
}

const MEDIA_EXT =
  'jpg|jpeg|png|gif|webp|mp4|webm|mov|pdf|docx?|xlsx?|pptx?';

function isDocumentUrl(url: string, contentType = '') {
  if (/\.(pdf|docx?|xlsx?|pptx?)(\?|$)/i.test(url)) return true;
  if (/\.(jpg|jpeg|png|gif|webp|mp4|webm|mov)(\?|$)/i.test(url)) return false;
  return /application\/(pdf|msword|vnd\.(ms-|openxmlformats))/i.test(
    contentType,
  );
}

function collectUrls(text: string, into: Set<string>) {
  for (const m of text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    const u = m[1].trim().split('?')[0];
    if (needsMigrate(u)) into.add(u);
  }
  for (const m of text.matchAll(
    new RegExp(
      `\\]\\((https?:[^)]+\\.(?:${MEDIA_EXT})(?:\\?[^)]*)?)\\)`,
      'gi',
    ),
  )) {
    const u = m[1].trim().split('?')[0];
    if (needsMigrate(u)) into.add(u);
  }
  // Bare school78 upload links without a clear extension in rare cases
  for (const m of text.matchAll(
    /\]\((https?:\/\/school78\.safe\.am\/uploads\/[^)\s]+)\)/gi,
  )) {
    const u = m[1].trim().split('?')[0];
    if (needsMigrate(u)) into.add(u);
  }
}

async function getDrive() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID missing');

  const refresh = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const saPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  let auth;
  if (refresh && clientId && clientSecret) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refresh });
    auth = oauth2;
  } else if (saPath) {
    const keyPath = resolve(__dirname, '..', saPath);
    const key = JSON.parse(readFileSync(keyPath, 'utf8'));
    auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
  } else {
    throw new Error('No Google Drive credentials');
  }

  return { drive: google.drive({ version: 'v3', auth }), folderId };
}

async function uploadOne(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  remoteUrl: string,
  cache: UrlCache,
): Promise<string> {
  if (cache[remoteUrl]) return cache[remoteUrl];
  if (DRY) {
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
    res.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
  let original = 'file';
  try {
    original = basename(decodeURIComponent(new URL(remoteUrl).pathname)) || 'file';
  } catch {
    /* ignore */
  }
  // Fix generic/wrong content-types from Weebly for office docs
  if (/\.pdf(\?|$)/i.test(remoteUrl)) contentType = 'application/pdf';
  else if (/\.docx(\?|$)/i.test(remoteUrl)) {
    contentType =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (/\.doc(\?|$)/i.test(remoteUrl)) contentType = 'application/msword';
  else if (/\.xlsx(\?|$)/i.test(remoteUrl)) {
    contentType =
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else if (/\.pptx(\?|$)/i.test(remoteUrl)) {
    contentType =
      'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  } else if (
    !/\.(jpg|jpeg|png|gif|webp|mp4|webm|mov)(\?|$)/i.test(remoteUrl) &&
    contentType.startsWith('text/')
  ) {
    contentType = 'application/octet-stream';
  }

  const asDocument = isDocumentUrl(remoteUrl, contentType);
  const name = `${Date.now()}-${original.replace(/[^\w.\-()+ ]+/gi, '_')}`.slice(
    0,
    180,
  );

  const created = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId],
      description: `Migrated from ${remoteUrl}`,
    },
    media: { mimeType: contentType, body: Readable.from(buf) },
    fields: 'id',
    supportsAllDrives: true,
  });
  const fileId = created.data.id;
  if (!fileId) throw new Error('no file id');
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });

  const view = asDocument
    ? `https://drive.google.com/file/d/${fileId}/view`
    : `https://lh3.googleusercontent.com/d/${fileId}`;
  cache[remoteUrl] = view;
  return view;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function rewriteText(text: string, cache: UrlCache) {
  let next = text;
  for (const [from, to] of Object.entries(cache)) {
    if (!from || from === to) continue;
    if (next.includes(from)) next = next.split(from).join(to);
    // also rewrite query-string variants
    const re = new RegExp(
      from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\?[^)\\s]*)?',
      'g',
    );
    next = next.replace(re, to);
  }
  return next;
}

async function main() {
  const { drive, folderId } = await getDrive();
  const cache = loadCache();
  const pages = await prisma.page.findMany();
  const urls = new Set<string>();

  for (const page of pages) {
    const am = ((page.content as { am?: string })?.am || '') as string;
    collectUrls(am, urls);
    if (page.coverImage && needsMigrate(page.coverImage)) {
      urls.add(page.coverImage.split('?')[0]);
    }
  }

  const list = [...urls];
  const pending = list.filter((u) => !cache[u]);
  console.log(
    `Media URLs: ${list.length} unique, ${pending.length} to upload, concurrency=${CONCURRENCY}, dry=${DRY}`,
  );

  let ok = 0;
  let fail = 0;
  await mapPool(pending, CONCURRENCY, async (url, i) => {
    try {
      await uploadOne(drive, folderId, url, cache);
      ok++;
      if ((i + 1) % 25 === 0 || i === pending.length - 1) {
        saveCache(cache);
        console.log(`upload ${ok + fail}/${pending.length} (ok=${ok} fail=${fail})`);
      }
    } catch (e) {
      fail++;
      console.warn(`FAIL ${url.slice(0, 100)} :: ${String(e).slice(0, 120)}`);
    }
    return null;
  });
  saveCache(cache);

  let pagesUpdated = 0;
  for (const page of pages) {
    const content = page.content as { am?: string; en?: string; ru?: string };
    const am0 = content.am || '';
    const am1 = rewriteText(am0, cache);
    let cover = page.coverImage || null;
    if (cover) {
      const key = cover.split('?')[0];
      if (cache[key]) cover = cache[key];
      else cover = rewriteText(cover, cache);
    }
    if (am1 !== am0 || cover !== page.coverImage) {
      if (!DRY) {
        await prisma.page.update({
          where: { id: page.id },
          data: {
            content: { ...content, am: am1 },
            coverImage: cover,
          },
        });
      }
      pagesUpdated++;
    }
  }

  console.log({
    uploadedOk: ok,
    uploadedFail: fail,
    cachedTotal: Object.keys(cache).length,
    pagesUpdated,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
