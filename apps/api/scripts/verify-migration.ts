/**
 * Post-migration integrity checks.
 * Run: npx tsx scripts/verify-migration.ts
 */
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

loadEnv();

const prisma = new PrismaClient();

const REQUIRED_SLUGS = [
  'about',
  'staff',
  'teachers',
  'assessment',
  'assessment-2016-2017',
  'tarakarg',
  'voluntary-attestation',
  'visits',
  'meetings',
  'documents',
];

async function main() {
  const pages = await prisma.page.findMany();
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const problems: string[] = [];

  for (const slug of REQUIRED_SLUGS) {
    if (!bySlug.has(slug)) problems.push(`missing page: ${slug}`);
  }

  // Thin content (stubs) — allow media/doc-only pages
  for (const p of pages) {
    const am = ((p.content as { am?: string })?.am || '').replace(/\s+/g, ' ').trim();
    const hasMedia =
      /!\[[^\]]*\]\([^)]+\)/.test(am) ||
      /\[[^\]]+\]\(https?:\/\/[^)]+\.(?:pdf|docx?|xlsx?|pptx?)(?:\?[^)]*)?\)/i.test(
        am,
      ) ||
      /school78\.safe\.am\/uploads\//i.test(am);
    if (am.length < 80 && !hasMedia && !p.slug.startsWith('news-')) {
      problems.push(`thin content (${am.length} chars): ${p.slug}`);
    }
  }

  // Staff completeness
  for (const slug of ['staff', 'teachers']) {
    const am = ((bySlug.get(slug)?.content as { am?: string })?.am || '') as string;
    const people = (am.match(/:::person/g) || []).length;
    if (people < 40) problems.push(`${slug}: only ${people} person cards`);
    if (!/\*\*Տնօրեն\*\*/.test(am) && !/Համբարձումյան/.test(am)) {
      problems.push(`${slug}: director missing`);
    }
    const first = am.match(/:::person\s*[\s\S]*?\*\*([^*]+)\*\*/);
    if (first && !/Տնօրեն/i.test(first[1])) {
      problems.push(`${slug}: first card is not director (${first[1]})`);
    }
  }

  // Year pages must have parentSlug + yearLabel
  for (const p of pages) {
    if (/^(assessment|visits|meetings|events|exemplary-lessons|project-based-learning)-\d{4}-\d{4}$/.test(p.slug)) {
      if (!p.parentSlug || !p.yearLabel) {
        problems.push(`year meta missing: ${p.slug}`);
      }
    }
  }

  // Assessment years continuity
  const assessYears = pages
    .filter((p) => p.parentSlug === 'assessment')
    .map((p) => p.yearLabel)
    .filter(Boolean)
    .sort();
  for (const y of [
    '2015-2016',
    '2016-2017',
    '2017-2018',
    '2018-2019',
    '2019-2020',
    '2020-2021',
    '2021-2022',
    '2023-2024',
    '2024-2025',
  ]) {
    if (!assessYears.includes(y)) problems.push(`assessment year missing: ${y}`);
  }

  // Menu: Գնահատում » Տարակարգ
  const menu = await prisma.menuItem.findMany();
  const tarakarg = menu.find((m) => {
    const lab = (m.label as { am?: string })?.am || '';
    return lab.includes('Տարակարգ') || m.href === '/p/tarakarg';
  });
  if (!tarakarg) problems.push('menu missing Տարակարգ');
  else if (!tarakarg.parentId) problems.push('Տարակարգ is not nested under Գնահատում');

  const gnahatum = menu.find((m) => {
    const lab = (m.label as { am?: string })?.am || '';
    return lab === 'Գնահատում';
  });
  if (tarakarg && gnahatum && tarakarg.parentId !== gnahatum.id) {
    // might be nested under assessment child - check grandparent
    const parent = menu.find((m) => m.id === tarakarg.parentId);
    if (parent?.parentId !== gnahatum.id && tarakarg.parentId !== gnahatum.id) {
      problems.push('Տարակարգ not under Գնահատում branch');
    }
  }

  // Leftover legacy host links (should be 0 after Drive migrate)
  let school78 = 0;
  for (const p of pages) {
    const am = ((p.content as { am?: string })?.am || '') as string;
    const cover = p.coverImage || '';
    const hits = [
      ...(am.match(/https?:\/\/school78\.safe\.am[^\s)]*/gi) || []),
      ...(cover.match(/https?:\/\/school78\.safe\.am[^\s)]*/gi) || []),
    ];
    if (hits.length) {
      school78 += hits.length;
      problems.push(
        `school78 leftover (${hits.length}): ${p.slug} → ${hits[0].slice(0, 90)}`,
      );
    }
  }

  // Every page should have a title + published-ish content or staff cards
  for (const p of pages) {
    const title = ((p.title as { am?: string })?.am || '').trim();
    if (!title) problems.push(`empty title: ${p.slug}`);
  }

  console.log(
    JSON.stringify(
      {
        pages: pages.length,
        menuItems: menu.length,
        assessmentYears: assessYears,
        school78Leftovers: school78,
        staffPeople: (
          ((bySlug.get('staff')?.content as { am?: string })?.am || '').match(
            /:::person/g,
          ) || []
        ).length,
        problems: problems.length,
        problemList: problems,
      },
      null,
      2,
    ),
  );

  if (problems.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
