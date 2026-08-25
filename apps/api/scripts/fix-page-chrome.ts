/**
 * Strip duplicate page-title H2 headings from CMS content (hero already shows title).
 * Run: npx tsx scripts/fix-page-chrome.ts
 */
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

loadEnv();

const prisma = new PrismaClient();

function stripDuplicateTitle(am: string, title: string) {
  if (!am || !title) return am;
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return am
    .replace(new RegExp(`^##\\s+${escaped}\\s*\\n+`, 'i'), '')
    .replace(new RegExp(`^#\\s+${escaped}\\s*\\n+`, 'i'), '')
    .trimStart();
}

function stripRedundantYearNav(content: string) {
  const lines = content.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const heading = line
      .trim()
      .match(
        /^###?\s+(Ըստ ուսումնական տարվա|By academic year|По учебным годам|Տարիներ|Years)$/i,
      );
    if (heading) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      let yearBullets = 0;
      let k = j;
      while (k < lines.length) {
        const t = lines[k].trim();
        if (!t) {
          k++;
          continue;
        }
        if (/^#{1,3}\s/.test(t) || t.startsWith(':::')) break;
        if (/^-?\s*\[[^\]]+\]\(\/p\/[^)]*20\d{2}[^)]*\)\s*$/i.test(t)) {
          yearBullets++;
          k++;
          continue;
        }
        break;
      }
      if (yearBullets >= 2) {
        i = k;
        continue;
      }
    }
    out.push(line);
    i++;
  }
  return out.join('\n');
}

const INTROS: Record<string, string> = {
  history:
    'Հ. 78 հիմնական դպրոցը գործում է 1957 թվականից՝ Երևանի Արաբկիր վարչական շրջանում։ Ստորև՝ պատմական լուսանկարներ։',
  classrooms:
    'Դասասենյակների և ուսումնական միջավայրի լուսանկարներ։',
  'school-life': 'Դպրոցական կյանքի միջոցառումների և առօրյայի լուսանկարներ։',
  'lesson-led-by':
    '«Դասը վարում է…» բաժնում ներկայացված են բաց և օրինակելի դասերի լուսանկարներ։',
  license: 'Դպրոցի լիցենզիայի և հավաստագրերի փաստաթղթեր / լուսանկարներ։',
  'educational-guides': 'Կրթական ուղեցույցներ և մեթոդական նյութեր։',
  clubs: 'Աշակերտական ակումբների և խմբակների գործունեության լուսանկարներ։',
  eco: 'Էկոլոգիական նախագծերի և միջոցառումների լուսանկարներ։',
  sports: 'Սպորտային միջոցառումների և մրցումների լուսանկարներ։',
  'yerevan-studies': 'Երևանագիտության նախագծերի և այցերի լուսանկարներ։',
  'my-hero': '«Իմ հերոսը» նախագծի աշխատանքների լուսանկարներ։',
  awards: 'Մրցանակների, մրցույթների և ձեռքբերումների լուսանկարներ։',
  family: 'Ընտանիքի և դպրոցի համագործակցության միջոցառումների լուսանկարներ։',
  'photo-gallery': 'Դպրոցական կյանքի ֆոտոսրահ։',
  'video-gallery':
    'Դպրոցական տեսանյութերի սրահ։ Տեսանյութերը կհավաքվեն այստեղ՝ միջոցառումների և դասերի արխիվից։',
  'board-of-trustees':
    'Հոգաբարձուների խորհրդի կազմը և նյութերը։ Թարմացումները կհրապարակվեն այս էջում։',
};

async function main() {
  const pages = await prisma.page.findMany();
  let updated = 0;
  for (const page of pages) {
    const title = (page.title as { am?: string })?.am || '';
    const content = page.content as { am?: string; en?: string; ru?: string };
    let am = content.am || '';
    const before = am;
    am = stripDuplicateTitle(am, title);
    am = stripRedundantYearNav(am);

    const intro = INTROS[page.slug];
    if (intro) {
      const textOnly = am
        .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^#+\s+.+$/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (textOnly.length < 40) {
        // Keep photos/docs; prepend short Armenian intro once
        am = `${intro}\n\n${am.replace(/^###\s+Լուսանկարներ\s*\n+/i, '### Լուսանկարներ\n')}`.trim();
      }
    }

    if (am !== before) {
      await prisma.page.update({
        where: { id: page.id },
        data: { content: { ...content, am } },
      });
      updated++;
      console.log('fixed', page.slug);
    }
  }
  console.log({ updated, total: pages.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
