/**
 * Seed: buffet rental tender announcement (blog post).
 * Run: npx tsx scripts/seed-buffet-tender-announcement.ts
 */
import { PrismaClient, PostStatus } from '@prisma/client';

const prisma = new PrismaClient();

const SLUG = 'bufet-mrtsuyti-hayt-ararutyun-2026';

const TITLE = {
  am: 'Մրցույթի հայտարարություն',
  en: 'Tender announcement',
  ru: 'Объявление о конкурсе',
};

const EXCERPT = {
  am: 'Դպրոցի բուֆետի տարածքի վարձակալության մրցույթ՝ աշակերտների սննդի կազմակերպման համար։',
  en: 'Tender for leasing the school buffet area to organize student meals.',
  ru: 'Конкурс на аренду буфетной площади школы для организации питания учащихся.',
};

const CONTENT = {
  am: `> Երևանի Հ. Հայրապետյանի անվան 78 հիմնական դպրոց ՊՈԱԿ-ը հայտարարում է մրցույթ՝ դպրոցի բուֆետի տարածքը վարձակալության հանձնելու նպատակով՝ աշակերտների սննդի կազմակերպումն իրականացնելու համար։

### Հիմնական պայմաններ

- **Գտնվելու վայրը.** Արաբկիր վարչ. շրջան, Մարշալ Բաղրամյան պող. 57/2 շենք
- **Տարածքի մակերեսը.** 32.1 քմ
- **Վարձակալության վերջնաժամկետը.** 31.12.2026
- **Վճարը.** 55 400 դրամ (համարվում է ամսական վճար)
- **Մրցույթի ամսաթիվը.** 07.09.2026 թ.
- **Ժամը.** 12:00
- **Վայրը.** թիվ 78 հիմնական դպրոց

Հայտերն ընդունվում են օգոստոսի 31-ից սեպտեմբերի 4-ը ներառյալ՝ ժամը 9:00-ից 14:00։

Հ. Հայրապետյանի անվան հ. 78 դպրոց

Մրցույթին կարող են մասնակցել համապատասխան պահանջներին բավարարող ֆիզիկական և իրավաբանական անձինք։

Մրցույթի հաղթող է ճանաչվում այն մասնակիցը, որը հանձնաժողովի եզրակացությամբ առաջարկում է լավագույն պայմանները։

### Մասնակցության համար անհրաժեշտ փաստաթղթեր

1. Անձնագրի կամ պետական գրանցման փաստաթղթի պատճենը։
2. Ներկայացնել վաճառվող ապրանքների ցանկն ու գնացուցակը։
3. Առնվազն 5 տարվա աշխատանքային փորձ կրթական հաստատությունների սննդի կազմակերպման ոլորտում։
4. Ներկայացնել սննդամթերքի ԵԱՏՄ որակի համապատասխանության վկայագիրը։
5. Ներկայացնել նախկինում իրականացված 3 ավարտուն պայմանագրի մասին տեղեկանք։

### Հայտերի ներկայացում

- **Հասցե.** _նշել_
- **Ժամ.** _նշել_
- **Հեռախոս.** _նշել_
- **Էլ. փոստ.** _նշել_
- **Պատասխանատու անձ.** _նշել_

> Տնօրեն՝ _________________ /ստորագրություն/
>
> Ամսաթիվ՝ «___» __________ 2026 թ.`,
  en: '',
  ru: '',
};

async function main() {
  const author = await prisma.user.findFirst();
  if (!author) throw new Error('No admin user — run prisma seed first');

  const category = await prisma.category.upsert({
    where: { slug: 'announcements' },
    create: {
      slug: 'announcements',
      name: {
        am: 'Հայտարարություններ',
        en: 'Announcements',
        ru: 'Объявления',
      },
      description: {
        am: 'Դպրոցի հայտարարություններ և մրցույթներ',
        en: 'School announcements and tenders',
        ru: 'Объявления и конкурсы школы',
      },
    },
    update: {},
  });

  const existing = await prisma.post.findUnique({ where: { slug: SLUG } });
  const data = {
    title: TITLE,
    excerpt: EXCERPT,
    content: CONTENT,
    status: PostStatus.PUBLISHED,
    publishedAt: new Date('2026-08-31T09:00:00+04:00'),
    authorId: author.id,
    categoryId: category.id,
  };

  if (existing) {
    await prisma.post.update({ where: { id: existing.id }, data });
    console.log('Updated post', SLUG);
  } else {
    await prisma.post.create({ data: { slug: SLUG, ...data } });
    console.log('Created post', SLUG);
  }

  console.log('URL: /blog/' + SLUG);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
