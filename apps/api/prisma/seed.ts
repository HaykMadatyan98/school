import { PrismaClient, PostStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

type L = { en: string; ru: string; am: string };

function L(en: string, ru: string, am: string): L {
  return { en, ru, am };
}

function pageBody(title: L, lead: L): L {
  return {
    en: `## ${title.en}\n\n${lead.en}\n\nMock content for layout review. Edit this page in the admin panel.`,
    ru: `## ${title.ru}\n\n${lead.ru}\n\nМок-контент для проверки вёрстки. Редактируйте страницу в админ-панели.`,
    am: `## ${title.am}\n\n${lead.am}\n\nՄոկ բովանդակություն՝ դասավորությունը ստուգելու համար։ Խմբագրեք էջը ադմին վահանակում։`,
  };
}

type PageDef = { slug: string; title: L; excerpt: L };

const PAGES: PageDef[] = [
  {
    slug: 'about',
    title: L('About the school', 'О школе', 'Մեր մասին'),
    excerpt: L(
      'Yerevan Basic School No. 78 after Hayrapet Hayrapetyan',
      'Ереванская основная школа №78 имени Айрапета Айрапетяна',
      'Երևանի Հայրապետ Հայրապետյանի անվան հ. 78 հիմնական դպրոց',
    ),
  },
  {
    slug: 'staff',
    title: L('School staff', 'Работники школы', 'Դպրոցի աշխատակազմ'),
    excerpt: L('Administration and staff', 'Администрация и сотрудники', 'Վարչություն և աշխատակազմ'),
  },
  {
    slug: 'teachers',
    title: L('Teachers', 'Педагоги', 'Մանկավարժներ'),
    excerpt: L('Teaching staff', 'Педагогический состав', 'Մանկավարժական կազմ'),
  },
  {
    slug: 'history',
    title: L('School history', 'История школы', 'Դպրոցի պատմություն'),
    excerpt: L('Since 1957', 'С 1957 года', '1957 թվականից'),
  },
  {
    slug: 'management-board',
    title: L('Management board', 'Совет управления', 'Կառավարման խորհուրդ'),
    excerpt: L('School governance', 'Управление школой', 'Դպրոցի կառավարում'),
  },
  {
    slug: 'parent-council',
    title: L('Parent council', 'Родительский совет', 'Ծնողական խորհուրդ'),
    excerpt: L('Parents community', 'Сообщество родителей', 'Ծնողների համայնք'),
  },
  {
    slug: 'student-council',
    title: L('Student council', 'Ученический совет', 'Աշակերտական խորհուրդ'),
    excerpt: L('Student self-government', 'Ученическое самоуправление', 'Աշակերտական ինքնակառավարում'),
  },
  {
    slug: 'board-of-trustees',
    title: L('Board of trustees', 'Попечительский совет', 'Հոգաբարձուների խորհուրդ'),
    excerpt: L('Trustees', 'Попечители', 'Հոգաբարձուներ'),
  },
  {
    slug: 'vacancies',
    title: L('Vacancies', 'Вакансии', 'Թափուր աշխատատեղեր'),
    excerpt: L('Open positions', 'Открытые вакансии', 'Բաց աշխատատեղեր'),
  },
  {
    slug: 'classrooms',
    title: L('Classrooms', 'Кабинеты', 'Դասասենյակներ'),
    excerpt: L('School facilities', 'Помещения школы', 'Դպրոցի տարածքներ'),
  },
  {
    slug: 'school-life',
    title: L('School life', 'Школьная жизнь', 'Դպրոցական կյանք'),
    excerpt: L('Visits, lessons and events', 'Посещения, уроки и события', 'Այցելություններ, դասեր և միջոցառումներ'),
  },
  {
    slug: 'visits',
    title: L('Visits', 'Посещения', 'Այցելություններ'),
    excerpt: L('Excursions and visits', 'Экскурсии и визиты', 'Էքսկուրսիաներ և այցելություններ'),
  },
  {
    slug: 'meetings',
    title: L('Meetings', 'Встречи', 'Հանդիպումներ'),
    excerpt: L('School meetings', 'Школьные встречи', 'Դպրոցական հանդիպումներ'),
  },
  {
    slug: 'exemplary-lessons',
    title: L('Exemplary lessons', 'Образцовые уроки', 'Օրինակելի դասեր'),
    excerpt: L('Model lessons', 'Показательные уроки', 'Ցուցադրական դասեր'),
  },
  {
    slug: 'project-based-learning',
    title: L('Project-based learning', 'Проектное обучение', 'Նախագծային ուսուցում'),
    excerpt: L('Projects at school', 'Проекты в школе', 'Նախագծեր դպրոցում'),
  },
  {
    slug: 'lesson-led-by',
    title: L('The lesson is led by…', 'Урок ведёт…', 'Դասը վարում է…'),
    excerpt: L('Guest teachers', 'Гостевые уроки', 'Հյուր դասեր'),
  },
  {
    slug: 'events',
    title: L('Events', 'Мероприятия', 'Միջոցառումներ'),
    excerpt: L('School events', 'Школьные мероприятия', 'Դպրոցական միջոցառումներ'),
  },
  {
    slug: 'assessment',
    title: L('Internal assessment', 'Внутренняя оценка', 'Ներքին գնահատում'),
    excerpt: L('Assessment archive', 'Архив оценок', 'Գնահատման արխիվ'),
  },
  {
    slug: 'voluntary-attestation',
    title: L('Voluntary attestation', 'Добровольная аттестация', 'Կամավոր ատեստավորում'),
    excerpt: L('Teacher attestation', 'Аттестация педагогов', 'Մանկավարժների ատեստավորում'),
  },
  {
    slug: 'documents',
    title: L('Documents', 'Документы', 'Փաստաթղթեր'),
    excerpt: L('Official documents', 'Официальные документы', 'Պաշտոնական փաստաթղթեր'),
  },
  {
    slug: 'internal-rules',
    title: L('Internal rules', 'Внутренние правила', 'Ներքին կարգապահական կանոններ'),
    excerpt: L('Disciplinary rules', 'Правила поведения', 'Կարգապահական կանոններ'),
  },
  {
    slug: 'license',
    title: L('License', 'Лицензия', 'Լիցենզիա'),
    excerpt: L('School license', 'Лицензия школы', 'Դպրոցի լիցենզիա'),
  },
  {
    slug: 'reports',
    title: L('Reports', 'Отчёты', 'Հաշվետվություններ'),
    excerpt: L('Public reports', 'Публичные отчёты', 'Հրապարակային հաշվետվություններ'),
  },
  {
    slug: 'finances',
    title: L('Finances', 'Финансы', 'Ֆինանսներ'),
    excerpt: L('Financial information', 'Финансовая информация', 'Ֆինանսական տեղեկատվություն'),
  },
  {
    slug: 'psychologist',
    title: L("Psychologist's corner", 'Уголок психолога', 'Հոգեբանի անկյուն'),
    excerpt: L('Psychological support', 'Психологическая поддержка', 'Հոգեբանական աջակցություն'),
  },
  {
    slug: 'special-educator',
    title: L('Special educator', 'Специальный педагог', 'Հատուկ մանկավարժ'),
    excerpt: L('Inclusive support', 'Инклюзивная поддержка', 'Ներառական աջակցություն'),
  },
  {
    slug: 'social-educator',
    title: L('Social educator', 'Социальный педагог', 'Սոցիալական մանկավարժ'),
    excerpt: L('Social pedagogy', 'Социальная педагогика', 'Սոցիալական մանկավարժություն'),
  },
  {
    slug: 'pedagogical-workshop',
    title: L('Pedagogical workshop', 'Педагогическая мастерская', 'Մանկավարժական արհեստանոց'),
    excerpt: L('Teacher workshop', 'Мастерская педагогов', 'Մանկավարժների արհեստանոց'),
  },
  {
    slug: 'educational-guides',
    title: L('Educational guides', 'Образовательные гайды', 'Կրթական ուղեցույցներ'),
    excerpt: L('Learning guides', 'Учебные материалы', 'Ուսումնական նյութեր'),
  },
  {
    slug: 'educational-resources',
    title: L('Educational resources', 'Образовательные ресурсы', 'Կրթական ռեսուրսներ'),
    excerpt: L('Resources for learning', 'Ресурсы для учёбы', 'Ուսումնական ռեսուրսներ'),
  },
  {
    slug: 'clubs',
    title: L('Clubs', 'Клубы', 'Ակումբներ'),
    excerpt: L('Student clubs', 'Ученические клубы', 'Աշակերտական ակումբներ'),
  },
  {
    slug: 'eco',
    title: L('Eco', 'Эко', 'Էկո'),
    excerpt: L('Ecology projects', 'Экологические проекты', 'Էկոլոգիական նախագծեր'),
  },
  {
    slug: 'sports',
    title: L('Sports', 'Спорт', 'Սպորտային'),
    excerpt: L('Sport activities', 'Спортивная жизнь', 'Սպորտային կյանք'),
  },
  {
    slug: 'english-club',
    title: L('English club', 'Кружок английского', 'Անգլերենի խմբակ'),
    excerpt: L('English extracurricular', 'Английский внеурочно', 'Անգլերեն արտադասարանային'),
  },
  {
    slug: 'yerevan-studies',
    title: L('Yerevan studies', 'Еревановедение', 'Երևանագիտություն'),
    excerpt: L('About Yerevan', 'О Ереване', 'Երևանի մասին'),
  },
  {
    slug: 'unesco',
    title: L('UNESCO', 'ЮНЕСКО', 'ՅՈՒՆԵՍԿՕ'),
    excerpt: L('UNESCO activities', 'Деятельность ЮНЕСКО', 'ՅՈՒՆԵՍԿՕ գործունեություն'),
  },
  {
    slug: 'my-hero',
    title: L('My hero', 'Мой герой', 'Իմ հերոսը'),
    excerpt: L('Hero project', 'Проект о героях', 'Հերոսների նախագիծ'),
  },
  {
    slug: 'awards',
    title: L('Awards', 'Награды', 'Մրցանակներ'),
    excerpt: L('School awards', 'Награды школы', 'Դպրոցի մրցանակներ'),
  },
  {
    slug: 'family',
    title: L('Family', 'Семья', 'Ընտանիք'),
    excerpt: L('Family and school', 'Семья и школа', 'Ընտանիք և դպրոց'),
  },
  {
    slug: 'summer-assignments',
    title: L('Summer assignments', 'Летние задания', 'Ամառային հանձնարարություններ'),
    excerpt: L('Holiday homework', 'Задания на каникулы', 'Արձակուրդային առաջադրանքներ'),
  },
  {
    slug: 'tip-of-the-day',
    title: L('Tip of the day', 'Совет дня', 'Օրվա խորհուրդը'),
    excerpt: L('Daily advice', 'Ежедневный совет', 'Օրական խորհուրդ'),
  },
  {
    slug: 'gallery',
    title: L('Gallery', 'Галерея', 'Պատկերասրահ'),
    excerpt: L('Photo gallery', 'Фотогалерея', 'Լուսանկարների պատկերասրահ'),
  },
  {
    slug: 'photo-gallery',
    title: L('Photo gallery', 'Фотозал', 'Ֆոտոսրահ'),
    excerpt: L('Photos', 'Фотографии', 'Լուսանկարներ'),
  },
  {
    slug: 'video-gallery',
    title: L('Video gallery', 'Видеозал', 'Տեսասրահ'),
    excerpt: L('Videos', 'Видео', 'Տեսանյութեր'),
  },
  {
    slug: 'archive',
    title: L('Archive', 'Архив', 'Արխիվ'),
    excerpt: L('News archive by year', 'Архив новостей по годам', 'Նորությունների արխիվ ըստ տարիների'),
  },
];

type MenuNode = {
  label: L;
  href: string;
  children?: MenuNode[];
};

const MENU: MenuNode[] = [
  { label: L('Home', 'Главная', 'Գլխավոր'), href: '/' },
  { label: L('News', 'Новости', 'Նորություններ'), href: '/blog' },
  {
    label: L('School life', 'Школьная жизнь', 'Դպրոցական կյանք'),
    href: '/p/school-life',
    children: [
      { label: L('Visits', 'Посещения', 'Այցելություններ'), href: '/p/visits' },
      { label: L('Meetings', 'Встречи', 'Հանդիպումներ'), href: '/p/meetings' },
      {
        label: L('Exemplary lessons', 'Образцовые уроки', 'Օրինակելի դասեր'),
        href: '/p/exemplary-lessons',
      },
      {
        label: L('Project-based learning', 'Проектное обучение', 'Նախագծային ուսուցում'),
        href: '/p/project-based-learning',
      },
      {
        label: L('The lesson is led by…', 'Урок ведёт…', 'Դասը վարում է…'),
        href: '/p/lesson-led-by',
      },
      { label: L('Events', 'Мероприятия', 'Միջոցառումներ'), href: '/p/events' },
    ],
  },
  {
    label: L('Assessment', 'Оценка', 'Գնահատում'),
    href: '/p/assessment',
    children: [
      {
        label: L('Internal assessment', 'Внутренняя оценка', 'Ներքին գնահատում'),
        href: '/p/assessment',
      },
      {
        label: L('Voluntary attestation', 'Добровольная аттестация', 'Կամավոր ատեստավորում'),
        href: '/p/voluntary-attestation',
      },
    ],
  },
  {
    label: L('About', 'О школе', 'Մեր մասին'),
    href: '/p/about',
    children: [
      { label: L('School staff', 'Работники', 'Աշխատակազմ'), href: '/p/staff' },
      { label: L('Teachers', 'Педагоги', 'Մանկավարժներ'), href: '/p/teachers' },
      { label: L('History', 'История', 'Պատմություն'), href: '/p/history' },
      {
        label: L('Management board', 'Совет управления', 'Կառավարման խորհուրդ'),
        href: '/p/management-board',
      },
      {
        label: L('Parent council', 'Родительский совет', 'Ծնողական խորհուրդ'),
        href: '/p/parent-council',
      },
      {
        label: L('Student council', 'Ученический совет', 'Աշակերտական խորհուրդ'),
        href: '/p/student-council',
      },
      {
        label: L('Board of trustees', 'Попечительский совет', 'Հոգաբարձուների խորհուրդ'),
        href: '/p/board-of-trustees',
      },
      { label: L('Vacancies', 'Вакансии', 'Թափուր տեղեր'), href: '/p/vacancies' },
      { label: L('Classrooms', 'Кабинеты', 'Դասասենյակներ'), href: '/p/classrooms' },
    ],
  },
  {
    label: L('Documents', 'Документы', 'Փաստաթղթեր'),
    href: '/p/documents',
    children: [
      {
        label: L('Internal rules', 'Внутренние правила', 'Ներքին կանոններ'),
        href: '/p/internal-rules',
      },
      { label: L('License', 'Лицензия', 'Լիցենզիա'), href: '/p/license' },
      { label: L('Reports', 'Отчёты', 'Հաշվետվություններ'), href: '/p/reports' },
      { label: L('Finances', 'Финансы', 'Ֆինանսներ'), href: '/p/finances' },
    ],
  },
  {
    label: L('Specialists', 'Специалисты', 'Մասնագետներ'),
    href: '/p/psychologist',
    children: [
      {
        label: L("Psychologist's corner", 'Уголок психолога', 'Հոգեբանի անկյուն'),
        href: '/p/psychologist',
      },
      {
        label: L('Special educator', 'Спец. педагог', 'Հատուկ մանկավարժ'),
        href: '/p/special-educator',
      },
      {
        label: L('Social educator', 'Соц. педагог', 'Սոցիալական մանկավարժ'),
        href: '/p/social-educator',
      },
      {
        label: L('Pedagogical workshop', 'Пед. мастерская', 'Մանկավարժական արհեստանոց'),
        href: '/p/pedagogical-workshop',
      },
      {
        label: L('Educational guides', 'Гайды', 'Ուղեցույցներ'),
        href: '/p/educational-guides',
      },
      {
        label: L('Educational resources', 'Ресурсы', 'Ռեսուրսներ'),
        href: '/p/educational-resources',
      },
    ],
  },
  {
    label: L('Clubs & projects', 'Клубы и проекты', 'Ակումբներ և նախագծեր'),
    href: '/p/clubs',
    children: [
      { label: L('Clubs', 'Клубы', 'Ակումբներ'), href: '/p/clubs' },
      { label: L('Eco', 'Эко', 'Էկո'), href: '/p/eco' },
      { label: L('Sports', 'Спорт', 'Սպորտ'), href: '/p/sports' },
      {
        label: L('English club', 'Английский', 'Անգլերենի խմբակ'),
        href: '/p/english-club',
      },
      {
        label: L('Yerevan studies', 'Еревановедение', 'Երևանագիտություն'),
        href: '/p/yerevan-studies',
      },
      { label: L('UNESCO', 'ЮНЕСКО', 'ՅՈՒՆԵՍԿՕ'), href: '/p/unesco' },
      { label: L('My hero', 'Мой герой', 'Իմ հերոսը'), href: '/p/my-hero' },
      { label: L('Awards', 'Награды', 'Մրցանակներ'), href: '/p/awards' },
      { label: L('Family', 'Семья', 'Ընտանիք'), href: '/p/family' },
      {
        label: L('Summer assignments', 'Летние задания', 'Ամառային հանձնարարություններ'),
        href: '/p/summer-assignments',
      },
      {
        label: L('Tip of the day', 'Совет дня', 'Օրվա խորհուրդը'),
        href: '/p/tip-of-the-day',
      },
    ],
  },
  {
    label: L('Media', 'Медиа', 'Մեդիա'),
    href: '/p/gallery',
    children: [
      { label: L('Gallery', 'Галерея', 'Պատկերասրահ'), href: '/p/gallery' },
      { label: L('Photos', 'Фото', 'Ֆոտո'), href: '/p/photo-gallery' },
      { label: L('Videos', 'Видео', 'Տեսա'), href: '/p/video-gallery' },
    ],
  },
  { label: L('Archive', 'Архив', 'Արխիվ'), href: '/p/archive' },
];

async function seedMenu(nodes: MenuNode[], parentId: string | null = null) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const created = await prisma.menuItem.create({
      data: {
        label: node.label,
        href: node.href,
        order: i,
        visible: true,
        parentId,
      },
    });
    if (node.children?.length) {
      await seedMenu(node.children, created.id);
    }
  }
}

async function main() {
  await prisma.post.deleteMany();
  await prisma.category.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.page.deleteMany();

  const email = 'admin@school.local';
  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: 'Administrator',
      role: Role.ADMIN,
    },
  });

  const news = await prisma.category.create({
    data: {
      slug: 'news',
      name: L('News', 'Новости', 'Նորություններ'),
      description: L(
        'Announcements from School 78',
        'Объявления школы №78',
        'Դպրոց №78 հայտարարություններ',
      ),
    },
  });

  const events = await prisma.category.create({
    data: {
      slug: 'events',
      name: L('Events', 'Мероприятия', 'Միջոցառումներ'),
      description: L(
        'Concerts, competitions and school celebrations',
        'Концерты, конкурсы и школьные праздники',
        'Համերգներ, մրցույթներ և դպրոցական տոներ',
      ),
    },
  });

  await prisma.post.create({
    data: {
      slug: 'welcome-to-school-78',
      title: L('Welcome to School 78', 'Добро пожаловать в школу №78', 'Բարի գալուստ դպրոց №78'),
      excerpt: L(
        'The portal of Yerevan Basic School No. 78 after Hayrapet Hayrapetyan is open for students and parents.',
        'Портал ереванской основной школы №78 имени Айрапета Айрапетяна открыт для учеников и родителей.',
        'Երևանի Հայրապետ Հայրապետյանի անվան հ. 78 հիմնական դպրոցի պորտալը բաց է աշակերտների և ծնողների համար։',
      ),
      content: L(
        '## School 78 online\n\nFollow news and events of Basic School No. 78 in Arabkir, Yerevan.',
        '## Школа №78 онлайн\n\nСледите за новостями и событиями основной школы №78 в районе Арабкир, Ереван.',
        '## Դպրոց №78 առցանց\n\nՀետևեք Երևանի Արաբկիրի հ. 78 հիմնական դպրոցի նորություններին և միջոցառումներին։',
      ),
      status: PostStatus.PUBLISHED,
      publishedAt: new Date(),
      authorId: admin.id,
      categoryId: news.id,
      coverImage:
        'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1600&q=80',
      images: [],
    },
  });

  await prisma.post.create({
    data: {
      slug: 'new-school-year',
      title: L(
        'Welcome to the new school year',
        'С началом нового учебного года',
        'Բարի գալուստ նոր ուսումնական տարի',
      ),
      excerpt: L(
        'We wish students and families of School 78 a peaceful and fruitful year.',
        'Желаем ученикам и семьям школы №78 мирного и плодотворного года.',
        'Մաղթում ենք դպրոց №78 աշակերտներին և ընտանիքներին խաղաղ ու բեղուն տարի։',
      ),
      content: L(
        '## A new year at School 78\n\nClasses resume on Marshal Baghramyan Avenue.',
        '## Новый год в школе №78\n\nУчёба продолжается на проспекте Маршала Баграмяна.',
        '## Նոր տարի դպրոց №78-ում\n\nՈւսումը շարունակվում է Մարշալ Բաղրամյան պողոտայում։',
      ),
      status: PostStatus.PUBLISHED,
      publishedAt: new Date(),
      authorId: admin.id,
      categoryId: events.id,
      coverImage:
        'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1600&q=80',
      images: [],
    },
  });

  for (const def of PAGES) {
    await prisma.page.create({
      data: {
        slug: def.slug,
        title: def.title,
        excerpt: def.excerpt,
        content: pageBody(def.title, def.excerpt),
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  await seedMenu(MENU);

  console.log(`Seed OK — ${PAGES.length} pages, nested menu, posts`);
  console.log('Admin login: admin@school.local / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
