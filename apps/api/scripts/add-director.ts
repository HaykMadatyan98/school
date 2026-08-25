/**
 * Prepend missing school director to staff + teachers without wiping bios.
 * Run: npx tsx scripts/add-director.ts
 */
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { basename } from 'path';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

loadEnv();

const prisma = new PrismaClient();
const PHOTO_REMOTE =
  'http://school78.safe.am/uploads/7/0/5/5/7055022/dsc-3757_orig.jpg';

const DIRECTOR = {
  name: 'Համբարձումյան Մարինե Ժորայի',
  role: 'Տնօրեն',
  bio: [
    'Ծնվել է՝ 1969թ. Երևանում։',
    'Կրթություն՝ 1988-1993թթ. ընդունվել և ավարտել է Խ. Աբովյանի անվան հայկական պետական մանկավարժական ինստիտուտի դեֆեկտոլոգիա ֆակուլտետը՝ ստանալով հատուկ դպրոցի ուսուցչի, լոգոպետի և նախադպրոցական հիմնարկների օլիգոֆրենոմանկավարժի որակավորում։',
    'Աշխատանք՝ 1986-1987թթ. աշխատել է հ.163 մանկապարտեզում, որպես դաստիարակ։ 1987-1999թթ. աշխատել է Երևանի լեզվական արատ ունեցող երեխաների հ.8 գիշերօթիկ դպրոցում, որպես դաստիարակ, լոգոպեդ։ 1999-2016թթ. աշխատել է հ.78 դպրոցում՝ դասվար։ 2016-2021թթ. նշանակվել է հ.78 դպրոցի փոխտնօրեն։ 2021թ. ընտրվել է հ.78 դպրոցի տնօրեն։ Ամուսնացած է, ունի երկու երեխա։',
  ].join(' '),
};

async function uploadPhoto(): Promise<string> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
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
    if (!existsSync(keyPath)) throw new Error(`Missing SA json: ${keyPath}`);
    const key = JSON.parse(readFileSync(keyPath, 'utf8'));
    auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
  } else {
    console.warn('No Drive credentials — using remote Weebly URL');
    return PHOTO_REMOTE;
  }

  if (!folderId) {
    console.warn('No GOOGLE_DRIVE_FOLDER_ID — using remote Weebly URL');
    return PHOTO_REMOTE;
  }

  const drive = google.drive({ version: 'v3', auth });
  const res = await fetch(PHOTO_REMOTE, {
    headers: { 'User-Agent': 'School78AddDirector/1.0' },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`download photo ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const name = `${Date.now()}-${basename(new URL(PHOTO_REMOTE).pathname)}`;

  const created = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId],
      description: 'School director portrait',
    },
    media: { mimeType: 'image/jpeg', body: Readable.from(buf) },
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
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

function personBlock(photo: string) {
  return [
    ':::person',
    `![${DIRECTOR.name}](${photo})`,
    `**${DIRECTOR.role}**`,
    DIRECTOR.bio,
    ':::',
    '',
  ].join('\n');
}

function prependDirector(markdown: string, photo: string): string {
  if (/Համբարձումյան|Տնօրեն/i.test(markdown) && /:::person[\s\S]*?\*\*Տնօրեն\*\*/.test(markdown)) {
    // Already has a director card — move to top if needed
    const blocks = [...markdown.matchAll(/:::person\s*[\s\S]*?:::\s*/g)];
    const dir = blocks.find((b) => /\*\*Տնօրեն\*\*/.test(b[0]));
    if (dir) {
      const without = markdown.replace(dir[0], '');
      const introEnd = without.search(/:::person/);
      if (introEnd < 0) return `${without.trim()}\n\n${dir[0]}`.trim();
      return `${without.slice(0, introEnd).trim()}\n\n${dir[0]}\n${without.slice(introEnd).trim()}`.trim();
    }
  }
  const introEnd = markdown.search(/:::person/);
  if (introEnd < 0) {
    return `${markdown.trim()}\n\n${personBlock(photo)}`.trim();
  }
  return `${markdown.slice(0, introEnd).trim()}\n\n${personBlock(photo)}${markdown.slice(introEnd).trim()}`.trim();
}

async function main() {
  const photo = await uploadPhoto();
  console.log('Photo:', photo);

  for (const slug of ['staff', 'teachers']) {
    const page = await prisma.page.findUnique({ where: { slug } });
    if (!page) {
      console.log(slug, 'missing');
      continue;
    }
    const content = page.content as { am?: string; en?: string; ru?: string };
    const am = content.am || '';
    if (/Համբարձումյան\s*Մարինե/i.test(am)) {
      console.log(slug, 'already has director — ensuring first');
    }
    const next = prependDirector(am, photo);
    await prisma.page.update({
      where: { id: page.id },
      data: {
        content: { ...content, am: next },
        coverImage: photo,
      },
    });
    console.log(slug, 'updated, people≈', (next.match(/:::person/g) || []).length);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
