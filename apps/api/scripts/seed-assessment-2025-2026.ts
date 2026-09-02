/**
 * Add Ներքին գնահատում 2025-2026 page + upload docx to Drive.
 * Run: npx tsx scripts/seed-assessment-2025-2026.ts
 * Optional: DOCX=/path/to/file.docx
 */
import { PrismaClient, PostStatus } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { createReadStream, existsSync, readFileSync } from 'fs';
import { basename, resolve } from 'path';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

loadEnv();

const prisma = new PrismaClient();
const SLUG = 'assessment-2025-2026';
const DOCX_PATH =
  process.env.DOCX ||
  '/home/user/Downloads/2025-26_ՆԳ_վերջնական.docx';
const DOC_NAME = basename(DOCX_PATH);
const DOCS_ROOT = 'Документы';
const MENU_PARENT_ID = '6a8d5101714dfa4521bc2485';

const TITLE = {
  am: 'Ներքին գնահատում 2025-2026',
  en: 'Internal assessment 2025-2026',
  ru: 'Внутренняя оценка 2025-2026',
};

async function getDrive() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const refresh = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!folderId || !refresh || !clientId || !clientSecret) {
    throw new Error('Google Drive not configured in .env');
  }
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refresh });
  return {
    drive: google.drive({ version: 'v3', auth: oauth2 }),
    rootFolderId: folderId,
  };
}

async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string,
) {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    supportsAllDrives: true,
  });
  const hit = res.data.files?.[0]?.id;
  if (hit) return hit;
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

async function uploadDocx(
  drive: drive_v3.Drive,
  localPath: string,
  parentFolderId: string,
) {
  const body = createReadStream(localPath);
  const created = await drive.files.create({
    requestBody: {
      name: DOC_NAME,
      parents: [parentFolderId],
      description: `assessment ${SLUG}`,
    },
    media: {
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      body,
    },
    fields: 'id,webViewLink',
    supportsAllDrives: true,
  });
  const fileId = created.data.id!;
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });
  return `https://drive.google.com/file/d/${fileId}/view`;
}

async function ensureMenuItem() {
  const href = `/p/${SLUG}`;
  const existing = await prisma.menuItem.findFirst({ where: { href } });
  if (existing) {
    await prisma.menuItem.update({
      where: { id: existing.id },
      data: {
        label: TITLE,
        visible: true,
        order: 0,
        parentId: MENU_PARENT_ID,
      },
    });
    return;
  }

  const siblings = await prisma.menuItem.findMany({
    where: { parentId: MENU_PARENT_ID },
    orderBy: { order: 'asc' },
  });
  for (const s of siblings) {
    await prisma.menuItem.update({
      where: { id: s.id },
      data: { order: s.order + 1 },
    });
  }

  await prisma.menuItem.create({
    data: {
      label: TITLE,
      href,
      order: 0,
      visible: true,
      parentId: MENU_PARENT_ID,
    },
  });
}

async function main() {
  if (!existsSync(DOCX_PATH)) {
    throw new Error(`DOCX not found: ${DOCX_PATH}`);
  }

  const { drive, rootFolderId } = await getDrive();
  const docsRoot = await findOrCreateFolder(drive, DOCS_ROOT, rootFolderId);
  const pageFolder = await findOrCreateFolder(drive, SLUG, docsRoot);
  const driveUrl = await uploadDocx(drive, DOCX_PATH, pageFolder);
  console.log('Drive:', driveUrl);

  const content = {
    am: `[${DOC_NAME}](${driveUrl})`,
    en: '',
    ru: '',
  };

  const existing = await prisma.page.findUnique({ where: { slug: SLUG } });
  const data = {
    title: TITLE,
    excerpt: {
      am: '2025-2026 ուստարվա ներքին գնահատման հաշվետվություն',
      en: 'Internal assessment report for 2025-2026',
      ru: 'Отчёт внутренней оценки за 2025-2026',
    },
    content,
    status: PostStatus.PUBLISHED,
    parentSlug: 'assessment',
    yearLabel: '2025-2026',
  };

  if (existing) {
    await prisma.page.update({ where: { id: existing.id }, data });
    console.log('Updated page', SLUG);
  } else {
    await prisma.page.create({ data: { slug: SLUG, ...data } });
    console.log('Created page', SLUG);
  }

  await ensureMenuItem();
  console.log('Menu item OK');
  console.log('URL: /p/' + SLUG);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
