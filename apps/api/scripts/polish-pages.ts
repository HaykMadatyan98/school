import { readFileSync } from 'fs';
import { PrismaClient, PostStatus } from '@prisma/client';

const prisma = new PrismaClient();
const L = (am: string) => ({ en: '', ru: '', am });

const about = `## Մեր մասին

Երևանի Հայրապետ Հայրապետյանի անվան հ. 78 հիմնական դպրոցը պետական դպրոց է Արաբկիր վարչական շրջանում։ Հիմնադրվել է 1957 թվականին։

Դպրոցը տալիս է հիմնական կրթություն և վարում է ակտիվ դպրոցական կյանք՝ աշակերտների, ծնողների և մանկավարժների համագործակցությամբ։

### Կապ

- Հասցե՝ Մարշալ Բաղրամյան պող. 57/2, Արաբկիր, Երևան 0019
- Հեռախոս՝ +374 10 225836
- Էլ. փոստ՝ school78@schools.am

Նյութերի մի մասը տեղափոխված է հին կայքից՝ school78.safe.am։`;

const history = `## Դպրոցի պատմություն

Հայրապետ Հայրապետյանի անվան հ. 78 հիմնական դպրոցը գործում է 1957 թվականից։

Դպրոցը գտնվում է Երևանի Արաբկիր վարչական շրջանում՝ Մարշալ Բաղրամյան պողոտայում, և տարիներ շարունակ ծառայում է համայնքի երեխաների կրթությանը։`;

const staff = `## Դպրոցի աշխատակազմ

Այստեղ կներկայացվի դպրոցի վարչությունը և աշխատակազմը։

Լրացուցիչ տեղեկությունների համար տես նաև բաժինները՝ Մանկավարժներ, Կառավարման խորհուրդ, Ծնողական խորհուրդ։

Կապ՝ school78@schools.am · +374 10 225836`;

async function main() {
  for (const [slug, am, excerpt] of [
    ['about', about, 'Երևանի Հայրապետ Հայրապետյանի անվան հ. 78 հիմնական դպրոց'],
    ['history', history, '1957 թվականից'],
    ['staff', staff, 'Վարչություն և աշխատակազմ'],
  ] as const) {
    await prisma.page.update({
      where: { slug },
      data: {
        content: L(am),
        excerpt: L(excerpt),
        status: PostStatus.PUBLISHED,
        coverImage: '/uploads/migrated/images/school-building-78-1.jpg',
      },
    });
    console.log('ok', slug);
  }

  const improved = JSON.parse(
    readFileSync('/tmp/improved-pages.json', 'utf8'),
  ) as Record<string, { am: string; excerpt: string }>;

  for (const [slug, page] of Object.entries(improved)) {
    await prisma.page.update({
      where: { slug },
      data: {
        content: L(page.am),
        excerpt: L(page.excerpt),
        status: PostStatus.PUBLISHED,
      },
    });
    console.log('improved', slug);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
