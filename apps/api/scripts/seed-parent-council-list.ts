/**
 * Convert parent-council photo into an editable member list (from 2022-2023 roster doc).
 * Run: npx tsx scripts/seed-parent-council-list.ts
 */
import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

loadEnv();

const prisma = new PrismaClient();

const members: { name: string; role: string }[] = [
  { name: 'Հայկ Ասլանյան', role: 'Նախագահ · VIԴ դասարան' },
  { name: 'Դալար Դավթյան', role: 'Քարտուղար · VԲ դասարան' },
  { name: 'Ավետիսյան Էլյա', role: 'IԱ դասարան' },
  { name: 'Վարդանյան Քրիստինե', role: 'IԲ դասարան' },
  { name: 'Արմենակյան Արևիկ', role: 'IԳ դասարան' },
  { name: 'Միքայելյան Հերմինե', role: 'IIԱ դասարան' },
  { name: 'Կալմուխյան Մարգարիտա', role: 'IIԲ դասարան' },
  { name: 'Պողոսյան Սաիդա', role: 'IIԳ դասարան' },
  { name: 'Պետրոսյան Անժելա', role: 'IIԴ դասարան' },
  { name: 'Հակոբյան Շուշան', role: 'IIIԱ դասարան' },
  { name: 'Իռեն Հարությունյան', role: 'IIIԲ դասարան' },
  { name: 'Նազարյան Նելլի', role: 'IIIԳ դասարան' },
  { name: 'Սարգսյան Ասյա', role: 'IIIԴ դասարան' },
  { name: 'Խաչատրյան Լիլիթ', role: 'IIIԵ դասարան' },
  { name: 'Մովսիսյան Անահիտ', role: 'IVԱ դասարան' },
  { name: 'Գրիգորյան Զարինե', role: 'IVԲ դասարան' },
  { name: 'Մանուկյան Մերի', role: 'IVԳ դասարան' },
  { name: 'Բաբայան Գայանե', role: 'IVԴ դասարան' },
  { name: 'Առաքելյան Հասմիկ', role: 'VԱ դասարան' },
  { name: 'Ներսիսյան Մարինա', role: 'VԳ դասարան' },
  { name: 'Հակոբյան Սինթիա', role: 'VIԱ դասարան' },
  { name: 'Շահինյան Ռուզաննա', role: 'VIԲ դասարան' },
  { name: 'Գրիգորյան Մարիաննա', role: 'VIԳ դասարան' },
  { name: 'Ռաֆայելյան Տիգրանուհի', role: 'VIIԱ դասարան' },
  { name: 'Հարությունյան Գայանե', role: 'VIIԲ դասարան' },
  { name: 'Դանիելյան Իրինա', role: 'VIIԳ դասարան' },
  { name: 'Հայրապետյան Ռուզաննա', role: 'VIIԴ դասարան' },
  { name: 'Ղազարյան Սիրանուշ', role: 'VIIIԱ դասարան' },
  { name: 'Համբարձումյան Իրինա', role: 'VIIIԲ դասարան' },
  { name: 'Պետրոսյան Լուսինե', role: 'VIIIԳ դասարան' },
  { name: 'Կալմուկյան Մարգարիտա', role: 'IXԱ դասարան' },
  { name: 'Բասեյան Հասմիկ', role: 'IXԲ դասարան' },
  { name: 'Բուռնազյան Սեդա', role: 'IXԳ դասարան' },
];

const intro =
  'Ծնողխորհրդի կազմը 2022-2023 ուստարվա համար։ Անդամների ցանկը կարող եք խմբագրել ադմին վահանակից։';

const docs = `### Փաստաթղթեր

- [Ծնողխորհրդի անդամներ 2022-2023](https://drive.google.com/file/d/1QDuE4aQOUpBKPGrwoKuesitdPA9QerUF/view)
- [Ծնողխորհրդի աշխատանքային պլան](https://drive.google.com/file/d/1bQt2j71ySkokA3gY0bId_HotWjEisak-/view)
- [արձանագրություն.docx](https://drive.google.com/file/d/16G8TUYKbuL797owIJUfLvhotIlvcP7zB/view)`;

function serialize() {
  const lines: string[] = [intro, ''];
  for (const m of members) {
    lines.push(':::person', `![${m.name}](#)`, `**${m.role}**`, ':::', '');
  }
  lines.push(docs);
  return lines.join('\n').trim();
}

async function main() {
  const am = serialize();
  const page = await prisma.page.findUnique({ where: { slug: 'parent-council' } });
  if (!page) throw new Error('parent-council missing');
  const content = page.content as { am?: string; en?: string; ru?: string };
  await prisma.page.update({
    where: { id: page.id },
    data: {
      content: { ...content, am },
      excerpt: {
        am: 'Ծնողխորհրդի կազմ և փաստաթղթեր',
        en: 'Parent council members and documents',
        ru: 'Состав родительского совета и документы',
      },
    },
  });
  console.log('updated parent-council, members=', members.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
