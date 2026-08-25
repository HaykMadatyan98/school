/**
 * Clean mock CMS content for visual/UX iteration.
 * No old-site URLs, no scraped photos, no blog posts.
 *
 * npm run seed:mock -w api
 */
import { PrismaClient, PostStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { config as loadEnv } from 'dotenv';

loadEnv();

const prisma = new PrismaClient();

type L = { am: string; en: string; ru: string };
const L = (am: string, en = '', ru = ''): L => ({ am, en, ru });

type PageDef = {
  slug: string;
  title: L;
  excerpt: L;
  contentAm: string;
};

const MOCK_STAFF = [
  {
    name: 'Աննա Մարտիրոսյան',
    role: 'Տնօրեն',
    bio: 'Մոկ տվյալներ։ Կարճ կենսագրություն՝ կրթություն, աշխատանքային փորձ և պարտականություններ։',
  },
  {
    name: 'Արմեն Գրիգորյան',
    role: 'Ուսումնական աշխատանքի գծով տեղակալ',
    bio: 'Մոկ տվյալներ։ Պատասխանատու է ուսումնական գործընթացի կազմակերպման համար։',
  },
  {
    name: 'Լուսինե Հովհաննիսյան',
    role: 'Հայոց լեզվի ուսուցիչ',
    bio: 'Մոկ տվյալներ։ Դասավանդում է հայոց լեզու և գրականություն միջին դասարաններում։',
  },
  {
    name: 'Դավիթ Սարգսյան',
    role: 'Մաթեմատիկայի ուսուցիչ',
    bio: 'Մոկ տվյալներ։ Կազմակերպում է օլիմպիադաներ և լրացուցիչ պարապմունքներ։',
  },
  {
    name: 'Նարինե Պետրոսյան',
    role: 'Հոգեբան',
    bio: 'Մոկ տվյալներ։ Աշակերտների և ծնողների խորհրդատվություն։',
  },
  {
    name: 'Սոնա Ավետիսյան',
    role: 'Ուսուցչի օգնական',
    bio: 'Մոկ տվյալներ։ Աջակցում է տարրական դասարանների ուսումնական աշխատանքին։',
  },
];

function staffMarkdown(title: string, intro: string) {
  const lines = [`## ${title}`, '', intro, ''];
  for (const p of MOCK_STAFF) {
    lines.push(':::person');
    lines.push(`![${p.name}]()`);
    lines.push(`**${p.role}**`);
    lines.push(p.bio);
    lines.push(':::');
    lines.push('');
  }
  return lines.join('\n').trim();
}

function mockPage(title: string, paragraphs: string[], docs?: string[]) {
  const lines = [`## ${title}`, ''];
  for (const p of paragraphs) lines.push(p, '');
  if (docs?.length) {
    lines.push('### Փաստաթղթեր', '');
    for (const d of docs) lines.push(`- [${d}](#mock-document)`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

const PAGES: PageDef[] = [
  {
    slug: 'about',
    title: L('Մեր մասին', 'About', 'О школе'),
    excerpt: L('Դպրոցի կարճ նկարագիր՝ մոկ տվյալներով։'),
    contentAm: mockPage('Մեր մասին', [
      'Սա մոկ բովանդակություն է։ Երևանի հ. 78 հիմնական դպրոցի մասին էջը կլրացվի վերջնական տեքստով ավելի ուշ։',
      'Հասցե, հեռախոս և էլ. փոստը տես ներքևի կապի բլոկում։',
    ]),
  },
  {
    slug: 'staff',
    title: L('Աշխատակազմ', 'Staff', 'Работники'),
    excerpt: L('Աշխատակիցների մոկ քարտեր։'),
    contentAm: staffMarkdown(
      'Աշխատակազմ',
      'Մոկ տվյալներ։ Ստորև՝ օրինակելի քարտեր լուսանկարի տեղում՝ սկզբնատառերով։',
    ),
  },
  {
    slug: 'teachers',
    title: L('Մանկավարժներ', 'Teachers', 'Педагоги'),
    excerpt: L('Մանկավարժների մոկ ցանկ։'),
    contentAm: staffMarkdown(
      'Մանկավարժներ',
      'Մոկ տվյալներ։ Քարտերը նույն կառուցվածքով են, ինչ աշխատակազմի բաժնում։',
    ),
  },
  {
    slug: 'history',
    title: L('Պատմություն', 'History', 'История'),
    excerpt: L('Դպրոցի պատմության մոկ էջ։'),
    contentAm: mockPage('Պատմություն', [
      'Մոկ տեքստ։ Այստեղ կլինի դպրոցի պատմական ակնարկ՝ տարեթվերով և կարևոր իրադարձություններով։',
    ]),
  },
  {
    slug: 'management-board',
    title: L('Կառավարման խորհուրդ', 'Management', 'Управление'),
    excerpt: L('Կառավարման խորհրդի մոկ էջ։'),
    contentAm: mockPage('Կառավարման խորհուրդ', [
      'Մոկ տեքստ։ Կազմ, նիստեր և որոշումներ։',
    ], ['Խորհրդի կանոնակարգ (մոկ).pdf', 'Արձանագրություն օրինակ (մոկ).pdf']),
  },
  {
    slug: 'parent-council',
    title: L('Ծնողական խորհուրդ', 'Parents', 'Родители'),
    excerpt: L('Ծնողական խորհրդի մոկ էջ։'),
    contentAm: mockPage('Ծնողական խորհուրդ', [
      'Մոկ տեքստ։ Ծնողների ներգրավվածություն և հանդիպումներ։',
    ]),
  },
  {
    slug: 'student-council',
    title: L('Աշակերտական խորհուրդ', 'Students', 'Ученики'),
    excerpt: L('Աշակերտական խորհրդի մոկ էջ։'),
    contentAm: mockPage('Աշակերտական խորհուրդ', [
      'Մոկ տեքստ։ Աշակերտական ինքնակառավարում և նախաձեռնություններ։',
    ]),
  },
  {
    slug: 'board-of-trustees',
    title: L('Հոգաբարձուներ', 'Trustees', 'Попечители'),
    excerpt: L('Հոգաբարձուների խորհրդի մոկ էջ։'),
    contentAm: mockPage('Հոգաբարձուների խորհուրդ', [
      'Մոկ տեքստ։ Հոգաբարձուների կազմ և գործունեություն։',
    ]),
  },
  {
    slug: 'vacancies',
    title: L('Թափուր տեղեր', 'Vacancies', 'Вакансии'),
    excerpt: L('Թափուր աշխատատեղերի մոկ էջ։'),
    contentAm: mockPage('Թափուր աշխատատեղեր', [
      'Մոկ տեքստ։ Ակտուալ հայտարարություններ չկան։ Օրինակ փաստաթուղթը ստորև է։',
    ], ['Հայտարարություն օրինակ (մոկ).pdf']),
  },
  {
    slug: 'classrooms',
    title: L('Դասասենյակներ', 'Classrooms', 'Кабинеты'),
    excerpt: L('Դասասենյակների մոկ էջ։'),
    contentAm: mockPage('Դասասենյակներ', [
      'Մոկ տեքստ։ Այստեղ կլինեն դասասենյակների նկարագրություններ (առանց լուսանկարների այս փուլում)։',
    ]),
  },
  {
    slug: 'school-life',
    title: L('Դպրոցական կյանք', 'School life', 'Школьная жизнь'),
    excerpt: L('Դպրոցական կյանքի մոկ էջ։'),
    contentAm: mockPage('Դպրոցական կյանք', [
      'Մոկ տեքստ։ Այցելություններ, հանդիպումներ, դասեր և միջոցառումներ։',
      'Ենթաբաժինները բացվում են մենյուից։',
    ]),
  },
  {
    slug: 'visits',
    title: L('Այցելություններ', 'Visits', 'Посещения'),
    excerpt: L('Այցելությունների մոկ էջ։'),
    contentAm: mockPage('Այցելություններ', [
      'Մոկ տեքստ։ Էքսկուրսիաներ և այցելություններ ըստ ուսումնական տարիների կավելացվեն հետո։',
      '- [2024-2025 (մոկ)](/p/visits)',
      '- [2025-2026 (մոկ)](/p/visits)',
    ]),
  },
  {
    slug: 'meetings',
    title: L('Հանդիպումներ', 'Meetings', 'Встречи'),
    excerpt: L('Հանդիպումների մոկ էջ։'),
    contentAm: mockPage('Հանդիպումներ', [
      'Մոկ տեքստ։ Հյուրեր, հանդիպումներ և համագործակցություն։',
    ]),
  },
  {
    slug: 'exemplary-lessons',
    title: L('Օրինակելի դասեր', 'Exemplary lessons', 'Образцовые уроки'),
    excerpt: L('Օրինակելի դասերի մոկ էջ։'),
    contentAm: mockPage('Օրինակելի դասեր', [
      'Մոկ տեքստ։ Բաց և օրինակելի դասերի նյութեր։',
    ]),
  },
  {
    slug: 'project-based-learning',
    title: L('Նախագծային ուսուցում', 'PBL', 'Проекты'),
    excerpt: L('Նախագծային ուսուցման մոկ էջ։'),
    contentAm: mockPage('Նախագծային ուսուցում', [
      'Մոկ տեքստ։ Աշակերտական նախագծեր և արդյունքներ։',
    ]),
  },
  {
    slug: 'lesson-led-by',
    title: L('Դասը վարում է…', 'Lesson led by…', 'Урок ведёт…'),
    excerpt: L('Բաց դասերի մոկ էջ։'),
    contentAm: mockPage('Դասը վարում է…', [
      'Մոկ տեքստ։ Բաց դասերի նկարագրություններ։',
    ]),
  },
  {
    slug: 'events',
    title: L('Միջոցառումներ', 'Events', 'Мероприятия'),
    excerpt: L('Միջոցառումների մոկ էջ։'),
    contentAm: mockPage('Միջոցառումներ', [
      'Մոկ տեքստ։ Տոնակատարություններ և դպրոցական իրադարձություններ։',
    ]),
  },
  {
    slug: 'assessment',
    title: L('Ներքին գնահատում', 'Assessment', 'Оценка'),
    excerpt: L('Գնահատման մոկ էջ։'),
    contentAm: mockPage('Ներքին գնահատում', [
      'Մոկ տեքստ։ Ներքին գնահատման արդյունքներն ըստ տարիների կավելացվեն հետո։',
    ], ['Գնահատման հաշվետվություն (մոկ).pdf']),
  },
  {
    slug: 'voluntary-attestation',
    title: L('Կամավոր ատեստավորում', 'Attestation', 'Аттестация'),
    excerpt: L('Ատեստավորման մոկ էջ։'),
    contentAm: mockPage('Կամավոր ատեստավորում', [
      'Մոկ տեքստ։ Ատեստավորման նյութեր և ժամանակացույց։',
    ]),
  },
  {
    slug: 'documents',
    title: L('Փաստաթղթեր', 'Documents', 'Документы'),
    excerpt: L('Փաստաթղթերի մոկ էջ։'),
    contentAm: mockPage('Փաստաթղթեր', [
      'Մոկ տեքստ։ Պաշտոնական փաստաթղթերի ցանկ։',
    ], [
      'Կանոնադրություն (մոկ).pdf',
      'Կազմակերպչական կառուցվածք (մոկ).pdf',
    ]),
  },
  {
    slug: 'internal-rules',
    title: L('Ներքին կանոններ', 'Rules', 'Правила'),
    excerpt: L('Ներքին կանոնների մոկ էջ։'),
    contentAm: mockPage('Ներքին կարգապահական կանոններ', [
      'Մոկ տեքստ։ Աշակերտների և աշխատակիցների կանոններ։',
    ], ['Ներքին կանոններ (մոկ).pdf']),
  },
  {
    slug: 'license',
    title: L('Լիցենզիա', 'License', 'Лицензия'),
    excerpt: L('Լիցենզիայի մոկ էջ։'),
    contentAm: mockPage('Լիցենզիա', [
      'Մոկ տեքստ։ Լիցենզավորման փաստաթղթեր։',
    ], ['Լիցենզիա (մոկ).pdf']),
  },
  {
    slug: 'reports',
    title: L('Հաշվետվություններ', 'Reports', 'Отчёты'),
    excerpt: L('Հաշվետվությունների մոկ էջ։'),
    contentAm: mockPage('Հաշվետվություններ', [
      'Մոկ տեքստ։ Տարեկան և թեմատիկ հաշվետվություններ։',
    ], ['Տարեկան հաշվետվություն (մոկ).pdf']),
  },
  {
    slug: 'finances',
    title: L('Ֆինանսներ', 'Finances', 'Финансы'),
    excerpt: L('Ֆինանսների մոկ էջ։'),
    contentAm: mockPage('Ֆինանսներ', [
      'Մոկ տեքստ։ Բյուջե և ֆինանսական հաշվետվություններ։',
    ], ['Բյուջե (մոկ).pdf', 'Դրամական հոսքեր (մոկ).pdf']),
  },
  {
    slug: 'psychologist',
    title: L('Հոգեբանի անկյուն', 'Psychologist', 'Психолог'),
    excerpt: L('Հոգեբանի մոկ էջ։'),
    contentAm: mockPage('Հոգեբանի անկյուն', [
      'Մոկ տեքստ։ Խորհուրդներ աշակերտներին և ծնողներին։',
    ]),
  },
  {
    slug: 'special-educator',
    title: L('Հատուկ մանկավարժ', 'Special educator', 'Спецпедагог'),
    excerpt: L('Հատուկ մանկավարժի մոկ էջ։'),
    contentAm: mockPage('Հատուկ մանկավարժ', [
      'Մոկ տեքստ։ Աջակցող ծառայության նյութեր։',
    ]),
  },
  {
    slug: 'social-educator',
    title: L('Սոցիալական մանկավարժ', 'Social educator', 'Соцпедагог'),
    excerpt: L('Սոցիալական մանկավարժի մոկ էջ։'),
    contentAm: mockPage('Սոցիալական մանկավարժ', [
      'Մոկ տեքստ։ Սոցիալական աջակցության նյութեր։',
    ]),
  },
  {
    slug: 'pedagogical-workshop',
    title: L('Մանկավարժական արհեստանոց', 'Workshop', 'Мастерская'),
    excerpt: L('Արհեստանոցի մոկ էջ։'),
    contentAm: mockPage('Մանկավարժական արհեստանոց', [
      'Մոկ տեքստ։ Մեթոդական հանդիպումներ։',
    ]),
  },
  {
    slug: 'educational-guides',
    title: L('Ուղեցույցներ', 'Guides', 'Гайды'),
    excerpt: L('Ուղեցույցների մոկ էջ։'),
    contentAm: mockPage('Կրթական ուղեցույցներ', [
      'Մոկ տեքստ։ Մեթոդական ուղեցույցներ։',
    ], ['Ուղեցույց օրինակ (մոկ).pdf']),
  },
  {
    slug: 'educational-resources',
    title: L('Ռեսուրսներ', 'Resources', 'Ресурсы'),
    excerpt: L('Ռեսուրսների մոկ էջ։'),
    contentAm: mockPage('Կրթական ռեսուրսներ', [
      'Մոկ տեքստ։ Օգտակար հղումներ և նյութեր։',
    ]),
  },
  {
    slug: 'clubs',
    title: L('Ակումբներ', 'Clubs', 'Клубы'),
    excerpt: L('Ակումբների մոկ էջ։'),
    contentAm: mockPage('Ակումբներ և խմբակներ', [
      'Մոկ տեքստ։ Արտադասարանական ակումբներ։ Ենթաբաժինները՝ մենյուում։',
    ]),
  },
  {
    slug: 'eco',
    title: L('Էկո', 'Eco', 'Эко'),
    excerpt: L('Էկո նախագծի մոկ էջ։'),
    contentAm: mockPage('Էկո', [
      'Մոկ տեքստ։ Բնապահպանական նախաձեռնություններ։',
    ]),
  },
  {
    slug: 'sports',
    title: L('Սպորտ', 'Sports', 'Спорт'),
    excerpt: L('Սպորտի մոկ էջ։'),
    contentAm: mockPage('Սպորտ', [
      'Մոկ տեքստ։ Սպորտային միջոցառումներ և մրցումներ։',
    ]),
  },
  {
    slug: 'english-club',
    title: L('Անգլերենի խմբակ', 'English club', 'Английский'),
    excerpt: L('Անգլերենի խմբակի մոկ էջ։'),
    contentAm: mockPage('Անգլերենի խմբակ', [
      'Մոկ տեքստ։ Խմբակի ժամանակացույց և նյութեր։',
    ]),
  },
  {
    slug: 'yerevan-studies',
    title: L('Երևանագիտություն', 'Yerevan studies', 'Еревановедение'),
    excerpt: L('Երևանագիտության մոկ էջ։'),
    contentAm: mockPage('Երևանագիտություն', [
      'Մոկ տեքստ։ Երևանի պատմություն և մշակույթ։',
    ]),
  },
  {
    slug: 'unesco',
    title: L('ՅՈՒՆԵՍԿՕ', 'UNESCO', 'ЮНЕСКО'),
    excerpt: L('ՅՈՒՆԵՍԿՕ մոկ էջ։'),
    contentAm: mockPage('ՅՈՒՆԵՍԿՕ', [
      'Մոկ տեքստ։ ՅՈՒՆԵՍԿՕ-ին առնչվող նախաձեռնություններ։',
    ]),
  },
  {
    slug: 'my-hero',
    title: L('Իմ հերոսը', 'My hero', 'Мой герой'),
    excerpt: L('«Իմ հերոսը» մոկ էջ։'),
    contentAm: mockPage('Իմ հերոսը', [
      'Մոկ տեքստ։ Նախագծի աշխատանքներ։',
    ]),
  },
  {
    slug: 'awards',
    title: L('Մրցանակներ', 'Awards', 'Награды'),
    excerpt: L('Մրցանակների մոկ էջ։'),
    contentAm: mockPage('Մրցանակներ', [
      'Մոկ տեքստ։ Աշակերտների և ուսուցիչների նվաճումներ։',
    ]),
  },
  {
    slug: 'family',
    title: L('Ընտանիք', 'Family', 'Семья'),
    excerpt: L('Ընտանիք-դպրոց մոկ էջ։'),
    contentAm: mockPage('Ընտանիք', [
      'Մոկ տեքստ։ Ընտանիքի և դպրոցի համագործակցություն։',
    ]),
  },
  {
    slug: 'summer-assignments',
    title: L('Ամառային հանձնարարություններ', 'Summer', 'Лето'),
    excerpt: L('Ամառային առաջադրանքների մոկ էջ։'),
    contentAm: mockPage('Ամառային հանձնարարություններ', [
      'Մոկ տեքստ։ Առաջադրանքներ ըստ դասարանների։',
    ], ['1-ին դասարան (մոկ).pdf', '2-րդ դասարան (մոկ).pdf']),
  },
  {
    slug: 'tip-of-the-day',
    title: L('Օրվա խորհուրդը', 'Tip of the day', 'Совет дня'),
    excerpt: L('Օրվա խորհուրդ աշակերտներին և ծնողներին։'),
    contentAm: mockPage('Օրվա խորհուրդը', [
      'Մոկ տեքստ։ Կարճ խորհուրդների հավաքածու աշակերտների և ծնողների համար։',
    ]),
  },
  {
    slug: 'gallery',
    title: L('Պատկերասրահ', 'Gallery', 'Галерея'),
    excerpt: L('Պատկերասրահի մոկ էջ։'),
    contentAm: mockPage('Պատկերասրահ', [
      'Մոկ տեքստ։ Այս փուլում լուսանկարներ չեն ցուցադրվում՝ միայն լոգոն է օգտագործվում կայքում։',
    ]),
  },
  {
    slug: 'photo-gallery',
    title: L('Ֆոտո', 'Photos', 'Фото'),
    excerpt: L('Ֆոտոսրահի մոկ էջ։'),
    contentAm: mockPage('Ֆոտոսրահ', [
      'Մոկ տեքստ։ Ֆոտոարխիվը կավելացվի տեսողական հաստատումից հետո։',
    ]),
  },
  {
    slug: 'video-gallery',
    title: L('Տեսա', 'Video', 'Видео'),
    excerpt: L('Տեսասրահի մոկ էջ։'),
    contentAm: mockPage('Տեսասրահ', [
      'Մոկ տեքստ։ Տեսանյութերի ցանկը կավելացվի ավելի ուշ։',
      '- [Օրինակ տեսանյութ 1 (մոկ)](#mock-video)',
      '- [Օրինակ տեսանյութ 2 (մոկ)](#mock-video)',
    ]),
  },
  {
    slug: 'archive',
    title: L('Արխիվ', 'Archive', 'Архив'),
    excerpt: L('Արխիվի մոկ էջ՝ ըստ տարիների։'),
    contentAm: mockPage('Արխիվ', [
      'Մոկ տեքստ։ Նորությունների արխիվն ըստ ուսումնական տարիների։',
      '### Ըստ տարիների',
      '- 2025-2026 (մոկ)',
      '- 2024-2025 (մոկ)',
      '- 2023-2024 (մոկ)',
      '- 2022-2023 (մոկ)',
      '- Ավելի վաղ տարիներ (մոկ)',
    ]),
  },
];

type MenuNode = { label: L; href: string; children?: MenuNode[] };

async function clearMenu() {
  const all = await prisma.menuItem.findMany({
    select: { id: true, parentId: true },
  });
  // Delete deepest nodes first (grandchildren → children → roots)
  const byParent = new Map<string | null, string[]>();
  for (const item of all) {
    const key = item.parentId;
    const list = byParent.get(key) || [];
    list.push(item.id);
    byParent.set(key, list);
  }
  const roots = byParent.get(null) || [];
  const mid: string[] = [];
  const leaf: string[] = [];
  for (const rootId of roots) {
    for (const childId of byParent.get(rootId) || []) {
      const grands = byParent.get(childId) || [];
      if (grands.length) {
        leaf.push(...grands);
        mid.push(childId);
      } else {
        leaf.push(childId);
      }
    }
  }
  for (const id of [...leaf, ...mid, ...roots]) {
    await prisma.menuItem.delete({ where: { id } }).catch(() => undefined);
  }
  // Safety pass
  const left = await prisma.menuItem.findMany({ select: { id: true } });
  for (const item of left) {
    await prisma.menuItem.delete({ where: { id: item.id } }).catch(() => undefined);
  }
}

async function insertMenu(nodes: MenuNode[], parentId: string | null = null) {
  let order = 0;
  for (const node of nodes) {
    const created = await prisma.menuItem.create({
      data: {
        label: node.label,
        href: node.href,
        order: order++,
        visible: true,
        openInNewTab: false,
        parentId,
      },
    });
    if (node.children?.length) {
      await insertMenu(node.children, created.id);
    }
  }
}

async function main() {
  // Admin user (idempotent)
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@school.local' },
    update: {},
    create: {
      email: 'admin@school.local',
      name: 'Admin',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  // Clear content collections
  await prisma.post.deleteMany();
  await prisma.page.deleteMany();
  await clearMenu();

  for (const p of PAGES) {
    await prisma.page.create({
      data: {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        content: L(p.contentAm),
        coverImage: null,
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  const menu: MenuNode[] = [
    { label: L('Գլխավոր', 'Home', 'Главная'), href: '/' },
    { label: L('Նորություններ', 'News', 'Новости'), href: '/blog' },
    {
      label: L('Դպրոցական կյանք', 'School life', 'Школьная жизнь'),
      href: '/p/school-life',
      children: [
        { label: L('Այցելություններ', 'Visits', 'Посещения'), href: '/p/visits' },
        { label: L('Հանդիպումներ', 'Meetings', 'Встречи'), href: '/p/meetings' },
        { label: L('Օրինակելի դասեր', 'Lessons', 'Уроки'), href: '/p/exemplary-lessons' },
        { label: L('Նախագծային ուսուցում', 'PBL', 'Проекты'), href: '/p/project-based-learning' },
        { label: L('Դասը վարում է…', 'Lesson led by…', 'Урок ведёт…'), href: '/p/lesson-led-by' },
        { label: L('Միջոցառումներ', 'Events', 'Мероприятия'), href: '/p/events' },
      ],
    },
    {
      label: L('Գնահատում', 'Assessment', 'Оценка'),
      href: '/p/assessment',
      children: [
        { label: L('Ներքին գնահատում', 'Internal', 'Внутренняя'), href: '/p/assessment' },
        { label: L('Կամավոր ատեստավորում', 'Attestation', 'Аттестация'), href: '/p/voluntary-attestation' },
        { label: L('Տարակարգ', 'Qualification rank', 'Квалификационный разряд'), href: '/p/tarakarg' },
      ],
    },
    {
      label: L('Մեր մասին', 'About', 'О школе'),
      href: '/p/about',
      children: [
        { label: L('Աշխատակազմ', 'Staff', 'Работники'), href: '/p/staff' },
        { label: L('Մանկավարժներ', 'Teachers', 'Педагоги'), href: '/p/teachers' },
        { label: L('Պատմություն', 'History', 'История'), href: '/p/history' },
        { label: L('Կառավարման խորհուրդ', 'Management', 'Управление'), href: '/p/management-board' },
        { label: L('Ծնողական խորհուրդ', 'Parents', 'Родители'), href: '/p/parent-council' },
        { label: L('Աշակերտական խորհուրդ', 'Students', 'Ученики'), href: '/p/student-council' },
        { label: L('Հոգաբարձուներ', 'Trustees', 'Попечители'), href: '/p/board-of-trustees' },
        { label: L('Թափուր տեղեր', 'Vacancies', 'Вакансии'), href: '/p/vacancies' },
        { label: L('Դասասենյակներ', 'Classrooms', 'Кабинеты'), href: '/p/classrooms' },
      ],
    },
    {
      label: L('Փաստաթղթեր', 'Documents', 'Документы'),
      href: '/p/documents',
      children: [
        { label: L('Ներքին կանոններ', 'Rules', 'Правила'), href: '/p/internal-rules' },
        { label: L('Լիցենզիա', 'License', 'Лицензия'), href: '/p/license' },
        { label: L('Հաշվետվություններ', 'Reports', 'Отчёты'), href: '/p/reports' },
        { label: L('Ֆինանսներ', 'Finances', 'Финансы'), href: '/p/finances' },
      ],
    },
    {
      label: L('Մասնագետներ', 'Specialists', 'Специалисты'),
      href: '/p/psychologist',
      children: [
        { label: L('Հոգեբանի անկյուն', 'Psychologist', 'Психолог'), href: '/p/psychologist' },
        { label: L('Հատուկ մանկավարժ', 'Special', 'Спецпедагог'), href: '/p/special-educator' },
        { label: L('Սոցիալական մանկավարժ', 'Social', 'Соцпедагог'), href: '/p/social-educator' },
        { label: L('Մանկավարժական արհեստանոց', 'Workshop', 'Мастерская'), href: '/p/pedagogical-workshop' },
        { label: L('Ուղեցույցներ', 'Guides', 'Гайды'), href: '/p/educational-guides' },
        { label: L('Ռեսուրսներ', 'Resources', 'Ресурсы'), href: '/p/educational-resources' },
      ],
    },
    {
      label: L('Ակումբներ', 'Clubs', 'Клубы'),
      href: '/p/clubs',
      children: [
        { label: L('Ակումբներ', 'Clubs', 'Клубы'), href: '/p/clubs' },
        { label: L('Էկո', 'Eco', 'Эко'), href: '/p/eco' },
        { label: L('Սպորտ', 'Sports', 'Спорт'), href: '/p/sports' },
        { label: L('Անգլերենի խմբակ', 'English', 'Английский'), href: '/p/english-club' },
        { label: L('Երևանագիտություն', 'Yerevan', 'Ереван'), href: '/p/yerevan-studies' },
        { label: L('ՅՈՒՆԵՍԿՕ', 'UNESCO', 'ЮНЕСКО'), href: '/p/unesco' },
        { label: L('Իմ հերոսը', 'My hero', 'Мой герой'), href: '/p/my-hero' },
        { label: L('Մրցանակներ', 'Awards', 'Награды'), href: '/p/awards' },
        { label: L('Ընտանիք', 'Family', 'Семья'), href: '/p/family' },
        { label: L('Ամառային հանձնարարություններ', 'Summer', 'Лето'), href: '/p/summer-assignments' },
        { label: L('Օրվա խորհուրդը', 'Tip of the day', 'Совет дня'), href: '/p/tip-of-the-day' },
      ],
    },
    {
      label: L('Մեդիա', 'Media', 'Медиа'),
      href: '/p/gallery',
      children: [
        { label: L('Պատկերասրահ', 'Gallery', 'Галерея'), href: '/p/gallery' },
        { label: L('Ֆոտո', 'Photos', 'Фото'), href: '/p/photo-gallery' },
        { label: L('Տեսա', 'Video', 'Видео'), href: '/p/video-gallery' },
      ],
    },
    { label: L('Արխիվ', 'Archive', 'Архив'), href: '/p/archive' },
  ];

  await insertMenu(menu);

  console.log('Mock seed done.', {
    pages: PAGES.length,
    posts: 0,
    staffCards: MOCK_STAFF.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
