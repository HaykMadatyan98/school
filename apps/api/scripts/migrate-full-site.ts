/**
 * Full migration: all old-site sections + year pages, cloud media URLs, menu rebuild.
 * npm run migrate:full -w api
 */
import { PrismaClient, PostStatus } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

loadEnv();

const BASE = 'http://school78.safe.am';
const UA = 'School78FullMigrate/1.0';
const prisma = new PrismaClient();

type L = { en: string; ru: string; am: string };
const L = (am: string, en = '', ru = ''): L => ({ en, ru, am });

/** Canonical mapping: slug → old path(s). First path wins for content. */
const SECTION_SOURCES: { slug: string; title: L; paths: string[]; yearOf?: string }[] = [
  // About cluster
  { slug: 'about', title: L('Մեր մասին', 'About', 'О школе'), paths: ['/134813811408-13961377140513871398.html'] },
  { slug: 'staff', title: L('Դպրոցի աշխատակազմ', 'Staff', 'Работники'), paths: ['/133214021408140014091387-1377139913891377140713771391137713821396.html'] },
  { slug: 'teachers', title: L('Մանկավարժներ', 'Teachers', 'Педагоги'), paths: ['/134813771398139113771406137714081386139813811408.html'] },
  { slug: 'history', title: L('Դպրոցի պատմություն', 'History', 'История'), paths: ['/133214021408140014091387-14021377140713961400141013851397140014101398.html'] },
  { slug: 'management-board', title: L('Կառավարման խորհուրդ', 'Management board', 'Совет управления'), paths: ['/1343137714041377140613771408139613771398-13891400140813921400141014081380.html'] },
  { slug: 'parent-council', title: L('Ծնողական խորհուրդ', 'Parent council', 'Родительский совет'), paths: ['/13421398140013941377139113771398-13891400140813921400141014081380.html'] },
  { slug: 'student-council', title: L('Աշակերտական խորհուրդ', 'Student council', 'Ученический совет'), paths: ['/13291399137713911381140814071377139113771398-13891400140813921400141014081380.html'] },
  { slug: 'board-of-trustees', title: L('Հոգաբարձուների խորհուրդ', 'Board of trustees', 'Попечители'), paths: ['/13441400137913771378137714081393140014101398138114081387-13891400140813921400141014081380.html'] },
  { slug: 'vacancies', title: L('Թափուր աշխատատեղեր', 'Vacancies', 'Вакансии'), paths: ['/133713771411140014101408-13771399138913771407137714071381139413811408.html'] },
  { slug: 'classrooms', title: L('Դասասենյակներ', 'Classrooms', 'Кабинеты'), paths: ['/1332137714051377140513811398139713771391139813811408.html'] },

  // School life + years
  { slug: 'school-life', title: L('Դպրոցական կյանք', 'School life', 'Школьная жизнь'), paths: ['/1329139714091381138814001410138513971400141013981398138114082.html'] },
  { slug: 'visits', title: L('Այցելություններ', 'Visits', 'Посещения'), paths: ['/1329139714091381138814001410138513971400141013981398138114082.html', '/132913971409138113881400141013851397140014101398139813811408.html'] },
  { slug: 'visits-2025-2026', title: L('Այցելություններ 2025-2026', 'Visits 2025-2026', 'Посещения 2025-2026'), paths: ['/1329139714091381138814001410138513971400141013981398138114082025-2026.html'], yearOf: 'visits' },
  { slug: 'visits-2024-2025', title: L('Այցելություններ 2024-2025', 'Visits 2024-2025', 'Посещения 2024-2025'), paths: ['/132913971409138113881400141013851397140014101398139813811408-2024-25.html', '/2024-25-137713971409138113881400141013851397140014101398139813811408.html'], yearOf: 'visits' },
  { slug: 'meetings', title: L('Հանդիպումներ', 'Meetings', 'Встречи'), paths: ['/134413771398138013871402140014101396139813811408.html', '/134413291350133213391354135213621348135013331360.html'] },
  { slug: 'meetings-2024-2025', title: L('Հանդիպումներ 2024-2025', 'Meetings 2024-2025', 'Встречи 2024-2025'), paths: ['/2024-2025-139213771398138013871402140014101396139813811408.html'], yearOf: 'meetings' },
  { slug: 'exemplary-lessons', title: L('Օրինակելի դասեր', 'Exemplary lessons', 'Образцовые уроки'), paths: ['/136514081387139813771391138113881387-13801377140513811408.html'] },
  { slug: 'exemplary-lessons-2025-2026', title: L('Օրինակելի դասեր 2025-2026', 'Exemplary lessons 2025-2026', 'Уроки 2025-2026'), paths: ['/136514081387139813771391138113881387-13801377140513811408-2025-2026.html', '/2024-2025-141314081387139813771391138113881387-13801377140513811408.html'], yearOf: 'exemplary-lessons' },
  { slug: 'exemplary-lessons-2024-2025', title: L('Օրինակելի դասեր 2024-2025', 'Exemplary lessons 2024-2025', 'Уроки 2024-2025'), paths: ['/2024-2025-141314081387139813771391138113881387-13801377140513811408.html'], yearOf: 'exemplary-lessons' },
  { slug: 'project-based-learning', title: L('Նախագծային ուսուցում', 'Project-based learning', 'Проектное обучение'), paths: ['/1350137713891377137913901377139713871398-140014101405140014101409140014101396.html'] },
  { slug: 'project-based-learning-2025-2026', title: L('Նախագծային ուսուցում 2025-2026', 'PBL 2025-2026', 'Проекты 2025-2026'), paths: ['/1350137713891377137913901377139713871398-1400141014051400141014091400141013962025-2026.html'], yearOf: 'project-based-learning' },
  { slug: 'project-based-learning-2024-2025', title: L('Նախագծային ուսուցում 2024-2025', 'PBL 2024-2025', 'Проекты 2024-2025'), paths: ['/1350137713891377137913901377139713871398-1400141014051400141014091400141013962024-25.html'], yearOf: 'project-based-learning' },
  { slug: 'lesson-led-by', title: L('Դասը վարում է…', 'The lesson is led by…', 'Урок ведёт…'), paths: ['/1332137714051384-140613771408140014101396-1383.html'] },
  { slug: 'events', title: L('Միջոցառումներ', 'Events', 'Мероприятия'), paths: ['/1348138714031400140913771404140014101396139813811408.html'] },
  { slug: 'events-2019-2020', title: L('Միջոցառումներ 2019-2020', 'Events 2019-2020', 'Мероприятия 2019-2020'), paths: ['/1348133913551352136113291356135213621348135013331360-2019-20.html'], yearOf: 'events' },

  // Assessment + years
  { slug: 'assessment', title: L('Ներքին գնահատում', 'Internal assessment', 'Внутренняя оценка'), paths: ['/135013811408141213871398-137913981377139213771407140014101396.html', '/135013331360136413391350.html'] },
  { slug: 'assessment-2024-2025', title: L('Ներքին գնահատում 2024-2025', 'Assessment 2024-2025', 'Оценка 2024-2025'), paths: ['/135013331360136413391350-133113501329134413291359135213621348-2024-2025.html'], yearOf: 'assessment' },
  { slug: 'assessment-2023-2024', title: L('Ներքին գնահատում 2023-2024', 'Assessment 2023-2024', 'Оценка 2023-2024'), paths: ['/135013331360136413391350-133113501329134413291359135213621348-2023-2024.html'], yearOf: 'assessment' },
  { slug: 'assessment-2021-2022', title: L('Ներքին գնահատում 2021-2022', 'Assessment 2021-2022', 'Оценка 2021-2022'), paths: ['/135013331360136413391350-133113501329134413291359135213621348-2021-22.html'], yearOf: 'assessment' },
  { slug: 'assessment-2020-2021', title: L('Ներքին գնահատում 2020-2021', 'Assessment 2020-2021', 'Оценка 2020-2021'), paths: ['/135013331360136413391350-133113501329134413291359135213621348-2020-21.html'], yearOf: 'assessment' },
  { slug: 'assessment-2019-2020', title: L('Ներքին գնահատում 2019-2020', 'Assessment 2019-2020', 'Оценка 2019-2020'), paths: ['/135013331360136413391350-1331135013291344132913591352136213482019-2020.html'], yearOf: 'assessment' },
  { slug: 'assessment-2018-2019', title: L('Ներքին գնահատում 2018-2019', 'Assessment 2018-2019', 'Оценка 2018-2019'), paths: ['/135013331360136413391350-133113501329134413291359135213621348-2018-2019.html'], yearOf: 'assessment' },
  { slug: 'assessment-2017-2018', title: L('Ներքին գնահատում 2017-2018', 'Assessment 2017-2018', 'Оценка 2017-2018'), paths: ['/135013811408141213871398-137913981377139213771407140014101396-2017-2018.html'], yearOf: 'assessment' },
  { slug: 'assessment-2015-2016', title: L('Ներքին գնահատում 2015-2016', 'Assessment 2015-2016', 'Оценка 2015-2016'), paths: ['/13501381141213871398-1379139813771392137714071400141013962015-2016.html'], yearOf: 'assessment' },
  { slug: 'voluntary-attestation', title: L('Կամավոր ատեստավորում', 'Voluntary attestation', 'Добровольная аттестация'), paths: ['/1343132913481329135813521360-132913591333135713591329135813521360135214101348.html'] },

  // Documents
  { slug: 'documents', title: L('Փաստաթղթեր', 'Documents', 'Документы'), paths: ['/1363137714051407137713851394138513811408.html'] },
  { slug: 'internal-rules', title: L('Ներքին կարգապահական կանոններ', 'Internal rules', 'Внутренние правила'), paths: ['/135013811408141213871398-139113771408137913771402137713921377139113771398-13911377139814001398139813811408.html'] },
  { slug: 'license', title: L('Լիցենզիա', 'License', 'Лицензия'), paths: ['/13401387140913811398138213871377.html'] },
  { slug: 'reports', title: L('Հաշվետվություններ', 'Reports', 'Отчёты'), paths: ['/13441377139914061381140714061400141013851397140014101398139813811408.html'] },
  { slug: 'finances', title: L('Ֆինանսներ', 'Finances', 'Финансы'), paths: ['/136613871398137713981405139813811408.html'] },

  // Specialists
  { slug: 'psychologist', title: L('Հոգեբանի անկյուն', "Psychologist's corner", 'Уголок психолога'), paths: ['/13441400137913811378137713981387-1377139813911397140014101398.html'] },
  { slug: 'special-educator', title: L('Հատուկ մանկավարժ', 'Special educator', 'Спец. педагог'), paths: ['/134413771407140014101391-139613771398139113771406137714081386.html'] },
  { slug: 'social-educator', title: L('Սոցիալական մանկավարժ', 'Social educator', 'Соц. педагог'), paths: ['/1357140014091387137713881377139113771398-139613771398139113771406137714081386.html'] },
  { slug: 'pedagogical-workshop', title: L('Մանկավարժական արհեստանոց', 'Pedagogical workshop', 'Пед. мастерская'), paths: ['/1348137713981391137714061377140813861377139113771398-1377140813921381140514071377139814001409.html'] },
  { slug: 'educational-guides', title: L('Կրթական ուղեցույցներ', 'Educational guides', 'Гайды'), paths: ['/1343140813851377139113771398-140014101394138114091400141013971409139813811408.html'] },
  { slug: 'educational-resources', title: L('Կրթական ռեսուրսներ', 'Educational resources', 'Ресурсы'), paths: ['/1343140813851377139113771398-1404138114051400141014081405139813811408.html'] },

  // Clubs
  { slug: 'clubs', title: L('Ակումբներ', 'Clubs', 'Клубы'), paths: ['/132913431352136213481330135013331360.html'] },
  { slug: 'eco', title: L('Էկո', 'Eco', 'Эко'), paths: ['/133513431352.html'] },
  { slug: 'sports', title: L('Սպորտային', 'Sports', 'Спорт'), paths: ['/135713541352136013591329134913391350.html'] },
  { slug: 'english-club', title: L('Անգլերենի խմբակ', 'English club', 'Английский'), paths: ['/132913981379138813811408138113981387-13891396137813771391.html'] },
  { slug: 'yerevan-studies', title: L('Երևանագիտություն', 'Yerevan studies', 'Еревановедение'), paths: ['/1333140814151377139813771379138714071400141013851397140014101398.html'] },
  { slug: 'unesco', title: L('ՅՈՒՆԵՍԿՕ', 'UNESCO', 'ЮНЕСКО'), paths: ['/13491352136213501333135713431365.html'] },
  { slug: 'my-hero', title: L('Իմ հերոսը', 'My hero', 'Мой герой'), paths: ['/13391348-134413331360135213571336.html'] },
  { slug: 'awards', title: L('Մրցանակներ', 'Awards', 'Награды'), paths: ['/1348140814091377139813771391139813811408.html'] },
  { slug: 'family', title: L('Ընտանիք', 'Family', 'Семья'), paths: ['/1336139814071377139813871412.html'] },
  { slug: 'summer-assignments', title: L('Ամառային հանձնարարություններ', 'Summer assignments', 'Летние задания'), paths: ['/13291396137714041377139713871398-1392137713981393139813771408137714081400141013851397140014101398139813811408.html'] },
  { slug: 'tip-of-the-day', title: L('Օրվա խորհուրդը', 'Tip of the day', 'Совет дня'), paths: ['/1365140814061377-138914001408139214001410140813801384.html'] },

  // Media
  { slug: 'gallery', title: L('Պատկերասրահ', 'Gallery', 'Галерея'), paths: ['/13541377140713911381140813771405140813771392.html', '/'] },
  { slug: 'photo-gallery', title: L('Ֆոտոսրահ', 'Photo gallery', 'Фото'), paths: ['/13661400140714001405140813771392.html'] },
  { slug: 'video-gallery', title: L('Տեսասրահ', 'Video gallery', 'Видео'), paths: ['/13591381140513771405140813771392.html'] },

  // Archive + news by year
  { slug: 'archive', title: L('Արխիվ', 'Archive', 'Архив'), paths: ['/-13291408138913871406.html'] },
  { slug: 'news-2025-2026', title: L('Նորություններ 2025-2026', 'News 2025-2026', 'Новости 2025-2026'), paths: ['/'], yearOf: 'archive' },
  { slug: 'news-2024-2025', title: L('Նորություններ 2024-2025', 'News 2024-2025', 'Новости 2024-2025'), paths: ['/2024-2025-1350135213601352136213371349135213621350135013331360.html', '/2024-2025-13501352136013521362133713491352136213501350133313601.html'], yearOf: 'archive' },
  { slug: 'news-2023-2024', title: L('Նորություններ 2023-2024', 'News 2023-2024', 'Новости 2023-2024'), paths: ['/2023-2024-1350135213601352136213371349135213621350135013331360.html'], yearOf: 'archive' },
  { slug: 'news-2022-2023', title: L('Նորություններ 2022-2023', 'News 2022-2023', 'Новости 2022-2023'), paths: ['/2022-2023-1350135213601352136213371349135213621350135013331360.html'], yearOf: 'archive' },
  { slug: 'news-2021-2022', title: L('Նորություններ 2021-2022', 'News 2021-2022', 'Новости 2021-2022'), paths: ['/2021-2022-1350135213601352136213371349135213621350135013331360.html'], yearOf: 'archive' },
  { slug: 'news-2020-2021', title: L('Նորություններ 2020-2021', 'News 2020-2021', 'Новости 2020-2021'), paths: ['/1350135213601352136213371349135213621350135013331360-2020-2021-2019-2020.html'], yearOf: 'archive' },
  { slug: 'news-2018-2019', title: L('Նորություններ 2018-2019', 'News 2018-2019', 'Новости 2018-2019'), paths: ['/1350140014081400141013851397140014101398139813811408-2018-19.html'], yearOf: 'archive' },
  { slug: 'news-2017-2018', title: L('Նորություններ 2017-2018', 'News 2017-2018', 'Новости 2017-2018'), paths: ['/1350140014081400141013851397140014101398139813811408-2017-18.html'], yearOf: 'archive' },
  { slug: 'news-2016-2017', title: L('Նորություններ 2016-2017', 'News 2016-2017', 'Новости 2016-2017'), paths: ['/1350140014081400141013851397140014101398139813811408-2016-2017.html'], yearOf: 'archive' },
  { slug: 'news-2015-2016', title: L('Նորություններ 2015-2016', 'News 2015-2016', 'Новости 2015-2016'), paths: ['/1350140014081400141013851397140014101398139813811408-2015-2016.html'], yearOf: 'archive' },
  { slug: 'news-2014-2015', title: L('Նորություններ 2014-2015', 'News 2014-2015', 'Новости 2014-2015'), paths: ['/1350140014081400141013851397140014101398139813811408-2014-2015.html'], yearOf: 'archive' },
  { slug: 'news-2013-2014', title: L('Նորություններ 2013-2014', 'News 2013-2014', 'Новости 2013-2014'), paths: ['/1350140014081400141013851397140014101398139813811408-2013-2014.html'], yearOf: 'archive' },
  { slug: 'news-2012-2013', title: L('Նորություններ 2012-2013', 'News 2012-2013', 'Новости 2012-2013'), paths: ['/1350140014081400141013851397140014101398139813811408-2012-20131400141014051407137714081387.html'], yearOf: 'archive' },
  { slug: 'news-2011-2012', title: L('2011-2012 ուստարի', '2011-2012 year', '2011-2012 год'), paths: ['/2011-20121400141014051407137714081387.html'], yearOf: 'archive' },
];

function absUrl(u: string) {
  if (u.startsWith('http')) return u;
  if (u.startsWith('//')) return `http:${u}`;
  return `${BASE}${u.startsWith('/') ? u : `/${u}`}`;
}

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

async function fetchHtml(path: string) {
  const res = await fetch(absUrl(path), {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return res.text();
}

function isJunkImageUrl(url: string) {
  const u = url.toLowerCase();
  return (
    u.includes('background-images/') ||
    u.includes('footer-toast') ||
    u.includes('/download.jpg') ||
    u.includes('_orig.') ||
    /icon|logo|button|spacer|facebook|twitter|weebly|toast/i.test(u)
  );
}

function collectImages(html: string) {
  const set = new Set<string>();
  for (const m of html.matchAll(
    /\/uploads\/[^"'\\\s<>]+\.(?:jpg|jpeg|png|gif|webp)/gi,
  )) {
    const u = absUrl(decodeURIComponent(m[0].split('?')[0]));
    if (isJunkImageUrl(u)) continue;
    // Weebly page chrome / decorative stock (e.g. cactus background)
    if (/\/published\/78-1\.jpg$/i.test(u) || /\/686098162\.jpg$/i.test(u)) {
      continue;
    }
    set.add(u);
  }
  return [...set];
}

function collectPdfs(html: string) {
  const out: { name: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/\/uploads\/[^"'\\\s<>]+\.pdf/gi)) {
    const url = absUrl(decodeURIComponent(m[0].split('?')[0]));
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({
      name: decodeURIComponent(url.split('/').pop() || 'file.pdf'),
      url,
    });
  }
  return out;
}

function extractParagraphs(html: string): string[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const chunks: string[] = [];
  const seen = new Set<string>();
  for (const m of cleaned.matchAll(
    /<(?:p|h2|h3|blockquote)[^>]*>([\s\S]*?)<\/(?:p|h2|h3|blockquote)>/gi,
  )) {
    let text = decodeEntities(m[1].replace(/<[^>]+>/g, ' '));
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length < 45) continue;
    if (
      /ՆՈՐՈւԹՅՈւՆՆԵՐ|Ներքին գնահատում\s*20|Powered by|Create your own|Weebly|Այցելություններ20|օրինակելի դասեր\s*20|Featured Products|My Site/i.test(
        text,
      )
    ) {
      continue;
    }
    // Skip pure nav crumb trails
    if ((text.match(/>/g) || []).length >= 2 && text.length < 120) continue;
    const key = text.slice(0, 70);
    if (seen.has(key)) continue;
    seen.add(key);
    chunks.push(text);
    if (chunks.length >= 50) break;
  }
  return chunks;
}

function yearIndexLinks(
  parentSlug: string,
  years: { slug: string; title: string }[],
) {
  if (!years.length) return '';
  const lines = ['### Ըստ ուսումնական տարվա', ''];
  for (const y of years) {
    lines.push(`- [${y.title}](/p/${y.slug})`);
  }
  lines.push('');
  return lines.join('\n');
}

function pageMarkdown(opts: {
  title: string;
  paragraphs: string[];
  images: string[];
  pdfs: { name: string; url: string }[];
  yearLinks?: string;
}) {
  const lines: string[] = [`## ${opts.title}`, ''];
  if (opts.yearLinks) lines.push(opts.yearLinks);
  for (const p of opts.paragraphs.slice(0, 40)) lines.push(p, '');
  if (opts.pdfs.length) {
    lines.push('### Փաստաթղթեր', '');
    for (const pdf of opts.pdfs) lines.push(`- [${pdf.name}](${pdf.url})`);
    lines.push('');
  }
  if (opts.images.length) {
    lines.push('### Լուսանկարներ', '');
    for (const img of opts.images) lines.push(`![ ](${img})`, '');
  }
  return lines.join('\n').trim();
}

type MenuNode = {
  label: L;
  href: string;
  children?: MenuNode[];
};

async function rebuildMenu() {
  // Delete children first to avoid relation errors
  const all = await prisma.menuItem.findMany({ select: { id: true, parentId: true } });
  const children = all.filter((x) => x.parentId);
  const roots = all.filter((x) => !x.parentId);
  for (const c of children) {
    await prisma.menuItem.delete({ where: { id: c.id } });
  }
  for (const r of roots) {
    await prisma.menuItem.delete({ where: { id: r.id } });
  }

  const yearChildren = (parent: string) =>
    SECTION_SOURCES.filter((s) => s.yearOf === parent).map((s) => ({
      label: s.title,
      href: `/p/${s.slug}`,
    }));

  const tree: MenuNode[] = [
    { label: L('Գլխավոր', 'Home', 'Главная'), href: '/' },
    { label: L('Նորություններ', 'News', 'Новости'), href: '/blog' },
    {
      label: L('Դպրոցական կյանք', 'School life', 'Школьная жизнь'),
      href: '/p/school-life',
      children: [
        {
          label: L('Այցելություններ', 'Visits', 'Посещения'),
          href: '/p/visits',
          children: yearChildren('visits'),
        },
        {
          label: L('Հանդիպումներ', 'Meetings', 'Встречи'),
          href: '/p/meetings',
          children: yearChildren('meetings'),
        },
        {
          label: L('Օրինակելի դասեր', 'Exemplary lessons', 'Образцовые уроки'),
          href: '/p/exemplary-lessons',
          children: yearChildren('exemplary-lessons'),
        },
        {
          label: L('Նախագծային ուսուցում', 'Project-based learning', 'Проекты'),
          href: '/p/project-based-learning',
          children: yearChildren('project-based-learning'),
        },
        { label: L('Դասը վարում է…', 'Lesson led by…', 'Урок ведёт…'), href: '/p/lesson-led-by' },
        {
          label: L('Միջոցառումներ', 'Events', 'Мероприятия'),
          href: '/p/events',
          children: yearChildren('events'),
        },
      ],
    },
    {
      label: L('Գնահատում', 'Assessment', 'Оценка'),
      href: '/p/assessment',
      children: [
        {
          label: L('Ներքին գնահատում', 'Internal assessment', 'Внутренняя оценка'),
          href: '/p/assessment',
          children: yearChildren('assessment'),
        },
        {
          label: L('Կամավոր ատեստավորում', 'Voluntary attestation', 'Аттестация'),
          href: '/p/voluntary-attestation',
        },
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
        { label: L('Հատուկ մանկավարժ', 'Special educator', 'Спецпедагог'), href: '/p/special-educator' },
        { label: L('Սոցիալական մանկավարժ', 'Social educator', 'Соцпедагог'), href: '/p/social-educator' },
        { label: L('Մանկավարժական արհեստանոց', 'Workshop', 'Мастерская'), href: '/p/pedagogical-workshop' },
        { label: L('Ուղեցույցներ', 'Guides', 'Гайды'), href: '/p/educational-guides' },
        { label: L('Ռեսուրսներ', 'Resources', 'Ресурсы'), href: '/p/educational-resources' },
      ],
    },
    {
      label: L('Ակումբներ և նախագծեր', 'Clubs & projects', 'Клубы'),
      href: '/p/clubs',
      children: [
        { label: L('Ակումբներ', 'Clubs', 'Клубы'), href: '/p/clubs' },
        { label: L('Էկո', 'Eco', 'Эко'), href: '/p/eco' },
        { label: L('Սպորտ', 'Sports', 'Спорт'), href: '/p/sports' },
        { label: L('Անգլերենի խմբակ', 'English', 'Английский'), href: '/p/english-club' },
        { label: L('Երևանագիտություն', 'Yerevan studies', 'Еревановедение'), href: '/p/yerevan-studies' },
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
        { label: L('Տեսա', 'Videos', 'Видео'), href: '/p/video-gallery' },
      ],
    },
    {
      label: L('Արխիվ', 'Archive', 'Архив'),
      href: '/p/archive',
      children: yearChildren('archive'),
    },
  ];

  async function insert(nodes: MenuNode[], parentId: string | null) {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const created = await prisma.menuItem.create({
        data: {
          label: n.label,
          href: n.href,
          order: i,
          visible: true,
          parentId,
        },
      });
      if (n.children?.length) await insert(n.children, created.id);
    }
  }

  await insert(tree, null);
  console.log('Menu rebuilt with year children');
}

async function upsertPage(
  slug: string,
  title: L,
  contentAm: string,
  excerptAm: string,
  cover?: string,
) {
  const data = {
    title,
    excerpt: L(excerptAm),
    content: L(contentAm),
    coverImage: cover || null,
    status: PostStatus.PUBLISHED,
    publishedAt: new Date(),
  };
  const existing = await prisma.page.findUnique({ where: { slug } });
  if (existing) {
    await prisma.page.update({ where: { slug }, data });
  } else {
    await prisma.page.create({ data: { slug, ...data } });
  }
}

async function main() {
  const hero = `${BASE}/uploads/7/0/5/5/7055022/published/78-1.jpg`;
  const byYearOf = new Map<string, { slug: string; title: string }[]>();
  for (const s of SECTION_SOURCES) {
    if (!s.yearOf) continue;
    const list = byYearOf.get(s.yearOf) || [];
    list.push({ slug: s.slug, title: s.title.am });
    byYearOf.set(s.yearOf, list);
  }

  let ok = 0;
  let fail = 0;

  for (const section of SECTION_SOURCES) {
    let html = '';
    let usedPath = '';
    for (const path of section.paths) {
      try {
        html = await fetchHtml(path);
        usedPath = path;
        break;
      } catch (e) {
        console.warn(`  skip path ${path}`, String(e).slice(0, 80));
      }
    }
    if (!html) {
      console.warn(`FAIL ${section.slug}: no path worked`);
      fail++;
      // Still create a stub so menu links work
      await upsertPage(
        section.slug,
        section.title,
        `## ${section.title.am}\n\nԲովանդակությունը շուտով կլրացվի։`,
        section.title.am,
        hero,
      );
      continue;
    }

    const paragraphs = extractParagraphs(html);
    const images = collectImages(html);
    const pdfs = collectPdfs(html);
    const years = byYearOf.get(section.slug) || [];
    const yearLinks =
      years.length && !section.yearOf
        ? yearIndexLinks(section.slug, years)
        : '';

    // Curated about text if scrape is weak
    let paras = paragraphs;
    if (section.slug === 'about' && paragraphs.length < 2) {
      paras = [
        'Երևանի Հայրապետ Հայրապետյանի անվան հ. 78 հիմնական դպրոցը պետական դպրոց է Արաբկիր վարչական շրջանում։ Հիմնադրվել է 1957 թվականին։',
        'Դպրոցը տալիս է հիմնական կրթություն և վարում է ակտիվ դպրոցական կյանք՝ աշակերտների, ծնողների և մանկավարժների համագործակցությամբ։',
        'Հասցե՝ Մարշալ Բաղրամյան պող. 57/2, Արաբկիր, Երևան 0019։ Հեռախոս՝ +374 10 225836։ Էլ. փոստ՝ school78@schools.am։',
      ];
    }

    const am = pageMarkdown({
      title: section.title.am,
      paragraphs: paras,
      images,
      pdfs,
      yearLinks,
    });

    await upsertPage(
      section.slug,
      section.title,
      am,
      (paras[0] || section.title.am).slice(0, 180),
      images[0] || hero,
    );

    ok++;
    console.log(
      `OK ${section.slug} ← ${usedPath} | text=${paras.length} img=${images.length} pdf=${pdfs.length}`,
    );
  }

  await rebuildMenu();

  const count = await prisma.page.count();
  console.log('Done.', { ok, fail, totalPages: count, mapped: SECTION_SOURCES.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
