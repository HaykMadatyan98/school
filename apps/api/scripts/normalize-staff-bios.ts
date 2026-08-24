/**
 * Unify staff bio openings to «Ծնվել է՝ …» / «Կրթություն՝ …» on staff + teachers.
 * Run: npm run normalize:staff-bios -w api
 */
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

loadEnv();

const prisma = new PrismaClient();

/** Keep in sync with apps/web/src/lib/staff-content.ts → normalizeStaffBio */
function normalizeStaffBio(raw: string): string {
  let text = raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/[`´]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';

  text = text.replace(/^Ես\s*՝?\s*[^,.]{2,80}[,.]\s*/i, '');

  text = text.replace(/^Ծննդավայրը?\s*[՝:]?\s*/i, 'Ծնվել է՝ ');

  text = text
    .replace(/^Ծննդյան\s+տարեթիվ\s*[՝:]?\s*/i, 'Ծնվել է՝ ')
    .replace(/^Ծնված\s*[՝:]?\s*/i, 'Ծնվել է՝ ')
    .replace(/^Ծնվել\s+եմ\s*/i, 'Ծնվել է՝ ')
    .replace(/^ծնվել\s+եմ\s*/i, 'Ծնվել է՝ ')
    .replace(/^Ծնվել\s+է\s+է\s*/i, 'Ծնվել է՝ ')
    .replace(/^Ծնվել\s+է\s*[՝:]?\s*/i, 'Ծնվել է՝ ')
    .replace(/^ծնվել\s+է\s*[՝:]?\s*/i, 'Ծնվել է՝ ')
    .replace(/^Ծնվել\s+(?=\d)/i, 'Ծնվել է՝ ');

  text = text.replace(/\sծնվել եմ\s+/gi, ' Ծնվել է՝ ');

  if (
    !/^Ծնվել է՝/i.test(text) &&
    /^(?:\d{1,2}\.?\s*)?(?:հունվար|փետրվար|մարտ|ապրիլ|մայիս|հունիս|հուլիս|օգոստոս|սեպտեմբեր|հոկտեմբեր|նոյեմբեր|դեկտեմբեր)/i.test(
      text,
    )
  ) {
    text = `Ծնվել է՝ ${text}`;
  }

  if (
    text.startsWith('Ծնվել է՝ հոկտեմբերի 13-ին') ||
    text.startsWith('հոկտեմբերի 13-ին')
  ) {
    text = text.replace(
      /^(?:Ծնվել է՝\s*)?հոկտեմբերի 13-ին/,
      'Ծնվել է՝ 1992թ. հոկտեմբերի 13-ին',
    );
  }

  text = text.replace(/Ծնվել է՝\s*Ծնվել է՝\s*/gi, 'Ծնվել է՝ ');
  text = text.replace(/Ծնվել է՝\s*[՝:]+\s*/g, 'Ծնվել է՝ ');

  text = text
    .replace(/\s*Կրթությունը?\s*[՝:]?\s*/gi, ' Կրթություն՝ ')
    .replace(/\s*Աշխատանքային գործունեություն\s*[՝:]?\s*/gi, ' Աշխատանք՝ ')
    .replace(/\s*Աշխատանքային փորձ\s*[՝:]?\s*/gi, ' Աշխատանք՝ ')
    .replace(/\s*Աշխատանք\s*[՝:]\s*/gi, ' Աշխատանք՝ ');

  text = text.replace(/Կրթություն՝\s*Կրթություն՝/gi, ' Կրթություն՝ ');

  if (!/Կրթություն՝/i.test(text)) {
    const studyRe =
      /(?:\d{4}\s*[-–—]\s*(?:\d{2,4}|ներկա)(?:\s*թթ\.?)?|\d{4}\s*թ(?:վական(?:ին|ի)?)?\.?|\d{4}\s*[-–—]\s*\d{2}թ\.?)\s*(?:[․.]?\s*)?(?:–|-)?\s*(?:ընդունվել|սովորել|ավարտել)|(?:Ընդունվել և ավարտել է|ընդունվել և ավարտել է|ընդունվել եւ ավարտել է|սովորել է|սովորել և ավարտել է|սովորել եմ)/i;
    const m = studyRe.exec(text);
    if (m?.index != null && m.index > 0) {
      const before = text.slice(0, m.index);
      if (!/Աշխատանք՝/i.test(before)) {
        text = `${before.trimEnd()} Կրթություն՝ ${text.slice(m.index).trimStart()}`;
      }
    }
  }

  text = text
    .replace(/ընդունվել եւ ավարտել/gi, 'ընդունվել և ավարտել')
    .replace(/ընդունվել է և\s+(\d{4})/gi, 'ընդունվել է և $1');

  text = text
    .replace(/սովորել եմ/gi, 'սովորել է')
    .replace(/աշխատել եմ/gi, 'աշխատել է')
    .replace(/ավարտել եմ/gi, 'ավարտել է')
    .replace(/ընդունվել եմ/gi, 'ընդունվել է')
    .replace(/ամուսնացած եմ/gi, 'ամուսնացած է')
    .replace(/\sունեմ\s+/gi, ' ունի ');

  return text.replace(/\s+/g, ' ').trim();
}

function normalizePersonBlocks(markdown: string): {
  text: string;
  changed: number;
} {
  let changed = 0;
  const text = markdown.replace(/:::person\s*([\s\S]*?):::/g, (full, body) => {
    const lines = String(body)
      .split('\n')
      .map((l: string) => l.trimEnd());
    const out: string[] = [];
    let bioParts: string[] = [];

    const flushBio = () => {
      if (!bioParts.length) return;
      const raw = bioParts.join('\n').trim();
      const next = normalizeStaffBio(raw);
      if (next !== raw.replace(/\s+/g, ' ').trim()) changed += 1;
      if (next) out.push(next);
      bioParts = [];
    };

    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (/^!\[[^\]]*\]\([^)]*\)$/.test(t) || /^\*\*.+\*\*$/.test(t)) {
        flushBio();
        out.push(t);
        continue;
      }
      bioParts.push(t);
    }
    flushBio();

    return `:::person\n${out.join('\n')}\n:::`;
  });
  return { text, changed };
}

async function main() {
  const pages = await prisma.page.findMany({
    where: { slug: { in: ['staff', 'teachers'] } },
  });

  for (const page of pages) {
    const content = page.content as { am?: string; en?: string; ru?: string };
    const am = content.am || '';
    if (!am.includes(':::person')) {
      console.log(page.slug, 'skip (no person blocks)');
      continue;
    }
    const { text, changed } = normalizePersonBlocks(am);
    if (text === am) {
      console.log(page.slug, 'unchanged');
      continue;
    }
    await prisma.page.update({
      where: { id: page.id },
      data: { content: { ...content, am: text } },
    });
    console.log(page.slug, `updated (${changed} bios normalized)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
