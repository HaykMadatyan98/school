/**
 * Re-scrape every mapped page from old Weebly `wsite-section-content`
 * and replace CMS content. Media rewritten via Drive URL cache.
 *
 * Preserves curated pages: staff, teachers, parent-council, tarakarg.
 *
 * Run: npx tsx scripts/resync-wsite-sections.ts
 * Optional: ONLY=about,history DRY=1
 */
import { PrismaClient, PostStatus } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { google } from 'googleapis';
import { Readable } from 'stream';

loadEnv();

const prisma = new PrismaClient();
const BASE = 'http://school78.safe.am';
const UA = 'School78WsiteResync/1.0';
const CACHE_PATH = resolve(__dirname, '../.cache/media-drive-map.json');
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 5));
const DRY = process.env.DRY === '1';
const ONLY = (process.env.ONLY || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

type L = { en: string; ru: string; am: string };
const L = (am: string, en = '', ru = ''): L => ({ en, ru, am });

const PRESERVE = new Set([
  'staff',
  'teachers',
  'parent-council',
  'tarakarg',
]);

/** Corrected mapping — first path is primary content source. */
const SECTION_SOURCES: {
  slug: string;
  title: L;
  paths: string[];
  yearOf?: string;
}[] = [
  { slug: 'about', title: L('Մեր մասին'), paths: ['/134813811408-13961377140513871398.html'] },
  { slug: 'staff', title: L('Դպրոցի աշխատակազմ'), paths: ['/133214021408140014091387-1377139913891377140713771391137713821396.html'] },
  { slug: 'teachers', title: L('Մանկավարժներ'), paths: ['/134813771398139113771406137714081386139813811408.html'] },
  { slug: 'history', title: L('Դպրոցի պատմություն'), paths: ['/133214021408140014091387-14021377140713961400141013851397140014101398.html'] },
  { slug: 'management-board', title: L('Կառավարման խորհուրդ'), paths: ['/1343137714041377140613771408139613771398-13891400140813921400141014081380.html'] },
  { slug: 'parent-council', title: L('Ծնողական խորհուրդ'), paths: ['/13421398140013941377139113771398-13891400140813921400141014081380.html'] },
  { slug: 'student-council', title: L('Աշակերտական խորհուրդ'), paths: ['/13291399137713911381140814071377139113771398-13891400140813921400141014081380.html'] },
  { slug: 'board-of-trustees', title: L('Հոգաբարձուների խորհուրդ'), paths: ['/13441400137913771378137714081393140014101398138114081387-13891400140813921400141014081380.html'] },
  { slug: 'vacancies', title: L('Թափուր աշխատատեղեր'), paths: ['/133713771411140014101408-13771399138913771407137714071381139413811408.html'] },
  { slug: 'classrooms', title: L('Դասասենյակներ'), paths: ['/1332137714051377140513811398139713771391139813811408.html'] },

  // school-life is a menu hub on old site — keep as hub (no wrong visits scrape)
  { slug: 'school-life', title: L('Դպրոցական կյանք'), paths: [] },
  { slug: 'visits', title: L('Այցելություններ'), paths: ['/132913971409138113881400141013851397140014101398139813811408.html', '/1329139714091381138814001410138513971400141013981398138114081.html'] },
  { slug: 'visits-2025-2026', title: L('Այցելություններ 2025-2026'), paths: ['/1329139714091381138814001410138513971400141013981398138114082025-2026.html'], yearOf: 'visits' },
  { slug: 'visits-2024-2025', title: L('Այցելություններ 2024-2025'), paths: ['/2024-25-137713971409138113881400141013851397140014101398139813811408.html', '/132913971409138113881400141013851397140014101398139813811408-2024-25.html'], yearOf: 'visits' },
  { slug: 'meetings', title: L('Հանդիպումներ'), paths: ['/134413771398138013871402140014101396139813811408.html'] },
  { slug: 'meetings-2024-2025', title: L('Հանդիպումներ 2024-2025'), paths: ['/2024-2025-139213771398138013871402140014101396139813811408.html'], yearOf: 'meetings' },
  { slug: 'exemplary-lessons', title: L('Օրինակելի դասեր'), paths: ['/136514081387139813771391138113881387-13801377140513811408.html'] },
  { slug: 'exemplary-lessons-2025-2026', title: L('Օրինակելի դասեր 2025-2026'), paths: ['/136514081387139813771391138113881387-13801377140513811408-2025-2026.html'], yearOf: 'exemplary-lessons' },
  { slug: 'exemplary-lessons-2024-2025', title: L('Օրինակելի դասեր 2024-2025'), paths: ['/2024-2025-141314081387139813771391138113881387-13801377140513811408.html'], yearOf: 'exemplary-lessons' },
  { slug: 'project-based-learning', title: L('Նախագծային ուսուցում'), paths: ['/1350137713891377137913901377139713871398-140014101405140014101409140014101396.html'] },
  { slug: 'project-based-learning-2025-2026', title: L('Նախագծային ուսուցում 2025-2026'), paths: ['/1350137713891377137913901377139713871398-1400141014051400141014091400141013962025-2026.html'], yearOf: 'project-based-learning' },
  { slug: 'project-based-learning-2024-2025', title: L('Նախագծային ուսուցում 2024-2025'), paths: ['/1350137713891377137913901377139713871398-1400141014051400141014091400141013962024-25.html'], yearOf: 'project-based-learning' },
  { slug: 'lesson-led-by', title: L('Դասը վարում է…'), paths: ['/1332137714051384-140613771408140014101396-1383.html'] },
  { slug: 'events', title: L('Միջոցառումներ'), paths: ['/1348138714031400140913771404140014101396139813811408.html'] },
  { slug: 'events-2019-2020', title: L('Միջոցառումներ 2019-2020'), paths: ['/1348133913551352136113291356135213621348135013331360-2019-20.html'], yearOf: 'events' },

  { slug: 'assessment', title: L('Ներքին գնահատում'), paths: ['/135013811408141213871398-137913981377139213771407140014101396.html'] },
  { slug: 'assessment-2024-2025', title: L('Ներքին գնահատում 2024-2025'), paths: ['/135013331360136413391350-133113501329134413291359135213621348-2024-2025.html'], yearOf: 'assessment' },
  { slug: 'assessment-2023-2024', title: L('Ներքին գնահատում 2023-2024'), paths: ['/135013331360136413391350-133113501329134413291359135213621348-2023-2024.html'], yearOf: 'assessment' },
  { slug: 'assessment-2021-2022', title: L('Ներքին գնահատում 2021-2022'), paths: ['/135013331360136413391350-133113501329134413291359135213621348-2021-22.html'], yearOf: 'assessment' },
  { slug: 'assessment-2020-2021', title: L('Ներքին գնահատում 2020-2021'), paths: ['/135013331360136413391350-133113501329134413291359135213621348-2020-21.html'], yearOf: 'assessment' },
  { slug: 'assessment-2019-2020', title: L('Ներքին գնահատում 2019-2020'), paths: ['/135013331360136413391350-1331135013291344132913591352136213482019-2020.html'], yearOf: 'assessment' },
  { slug: 'assessment-2018-2019', title: L('Ներքին գնահատում 2018-2019'), paths: ['/135013331360136413391350-133113501329134413291359135213621348-2018-2019.html'], yearOf: 'assessment' },
  { slug: 'assessment-2017-2018', title: L('Ներքին գնահատում 2017-2018'), paths: ['/135013811408141213871398-137913981377139213771407140014101396-2017-2018.html'], yearOf: 'assessment' },
  { slug: 'assessment-2016-2017', title: L('Ներքին գնահատում 2016-2017'), paths: ['/13501381141213871398-1379139813771392137714071400141013962016-2017.html'], yearOf: 'assessment' },
  { slug: 'assessment-2015-2016', title: L('Ներքին գնահատում 2015-2016'), paths: ['/13501381141213871398-1379139813771392137714071400141013962015-2016.html'], yearOf: 'assessment' },
  { slug: 'voluntary-attestation', title: L('Կամավոր ատեստավորում'), paths: ['/1343132913481329135813521360-132913591333135713591329135813521360135214101348.html'] },

  { slug: 'documents', title: L('Փաստաթղթեր'), paths: ['/1363137714051407137713851394138513811408.html'] },
  { slug: 'internal-rules', title: L('Ներքին կարգապահական կանոններ'), paths: ['/135013811408141213871398-139113771408137913771402137713921377139113771398-13911377139814001398139813811408.html'] },
  { slug: 'license', title: L('Լիցենզիա'), paths: ['/13401387140913811398138213871377.html'] },
  { slug: 'reports', title: L('Հաշվետվություններ'), paths: ['/13441377139914061381140714061400141013851397140014101398139813811408.html'] },
  { slug: 'finances', title: L('Ֆինանսներ'), paths: ['/136613871398137713981405139813811408.html'] },

  { slug: 'psychologist', title: L('Հոգեբանի անկյուն'), paths: ['/13441400137913811378137713981387-1377139813911397140014101398.html'] },
  { slug: 'special-educator', title: L('Հատուկ մանկավարժ'), paths: ['/134413771407140014101391-139613771398139113771406137714081386.html'] },
  { slug: 'social-educator', title: L('Սոցիալական մանկավարժ'), paths: ['/1357140014091387137713881377139113771398-139613771398139113771406137714081386.html'] },
  { slug: 'pedagogical-workshop', title: L('Մանկավարժական արհեստանոց'), paths: ['/1348137713981391137714061377140813861377139113771398-1377140813921381140514071377139814001409.html'] },
  { slug: 'educational-guides', title: L('Կրթական ուղեցույցներ'), paths: ['/1343140813851377139113771398-140014101394138114091400141013971409139813811408.html'] },
  { slug: 'educational-resources', title: L('Կրթական ռեսուրսներ'), paths: ['/1343140813851377139113771398-1404138114051400141014081405139813811408.html'] },

  { slug: 'clubs', title: L('Ակումբներ'), paths: ['/132913431352136213481330135013331360.html'] },
  { slug: 'eco', title: L('Էկո'), paths: ['/133513431352.html'] },
  { slug: 'sports', title: L('Սպորտային'), paths: ['/135713541352136013591329134913391350.html'] },
  { slug: 'english-club', title: L('Անգլերենի խմբակ'), paths: ['/132913981379138813811408138113981387-13891396137813771391.html'] },
  { slug: 'yerevan-studies', title: L('Երևանագիտություն'), paths: ['/1333140814151377139813771379138714071400141013851397140014101398.html'] },
  { slug: 'unesco', title: L('ՅՈՒՆԵՍԿՕ'), paths: ['/13491352136213501333135713431365.html'] },
  { slug: 'my-hero', title: L('Իմ հերոսը'), paths: ['/13391348-134413331360135213571336.html'] },
  { slug: 'awards', title: L('Մրցանակներ'), paths: ['/1348140814091377139813771391139813811408.html'] },
  { slug: 'family', title: L('Ընտանիք'), paths: ['/1336139814071377139813871412.html'] },
  { slug: 'summer-assignments', title: L('Ամառային հանձնարարություններ'), paths: ['/13291396137714041377139713871398-1392137713981393139813771408137714081400141013851397140014101398139813811408.html'] },
  { slug: 'tip-of-the-day', title: L('Օրվա խորհուրդը'), paths: ['/1365140814061377-138914001408139214001410140813801384.html'] },

  { slug: 'gallery', title: L('Պատկերասրահ'), paths: ['/13541377140713911381140813771405140813771392.html'] },
  { slug: 'photo-gallery', title: L('Ֆոտոսրահ'), paths: ['/13661400140714001405140813771392.html'] },
  { slug: 'video-gallery', title: L('Տեսասրահ'), paths: ['/13591381140513771405140813771392.html'] },

  { slug: 'archive', title: L('Արխիվ'), paths: ['/-13291408138913871406.html'] },
  { slug: 'news-2025-2026', title: L('Նորություններ 2025-2026'), paths: ['/'], yearOf: 'archive' },
  { slug: 'news-2024-2025', title: L('Նորություններ 2024-2025'), paths: ['/2024-2025-1350135213601352136213371349135213621350135013331360.html'], yearOf: 'archive' },
  { slug: 'news-2023-2024', title: L('Նորություններ 2023-2024'), paths: ['/2023-2024-1350135213601352136213371349135213621350135013331360.html'], yearOf: 'archive' },
  { slug: 'news-2022-2023', title: L('Նորություններ 2022-2023'), paths: ['/2022-2023-1350135213601352136213371349135213621350135013331360.html'], yearOf: 'archive' },
  { slug: 'news-2021-2022', title: L('Նորություններ 2021-2022'), paths: ['/2021-2022-1350135213601352136213371349135213621350135013331360.html'], yearOf: 'archive' },
  { slug: 'news-2020-2021', title: L('Նորություններ 2020-2021'), paths: ['/1350135213601352136213371349135213621350135013331360-2020-2021-2019-2020.html'], yearOf: 'archive' },
  { slug: 'news-2018-2019', title: L('Նորություններ 2018-2019'), paths: ['/1350140014081400141013851397140014101398139813811408-2018-19.html'], yearOf: 'archive' },
  { slug: 'news-2017-2018', title: L('Նորություններ 2017-2018'), paths: ['/1350140014081400141013851397140014101398139813811408-2017-18.html'], yearOf: 'archive' },
  { slug: 'news-2016-2017', title: L('Նորություններ 2016-2017'), paths: ['/1350140014081400141013851397140014101398139813811408-2016-2017.html'], yearOf: 'archive' },
  { slug: 'news-2015-2016', title: L('Նորություններ 2015-2016'), paths: ['/1350140014081400141013851397140014101398139813811408-2015-2016.html'], yearOf: 'archive' },
  { slug: 'news-2014-2015', title: L('Նորություններ 2014-2015'), paths: ['/1350140014081400141013851397140014101398139813811408-2014-2015.html'], yearOf: 'archive' },
  { slug: 'news-2013-2014', title: L('Նորություններ 2013-2014'), paths: ['/1350140014081400141013851397140014101398139813811408-2013-2014.html'], yearOf: 'archive' },
  { slug: 'news-2012-2013', title: L('Նորություններ 2012-2013'), paths: ['/1350140014081400141013851397140014101398139813811408-2012-20131400141014051407137714081387.html'], yearOf: 'archive' },
  { slug: 'news-2011-2012', title: L('Նորություններ 2011-2012'), paths: ['/2011-20121400141014051407137714081387.html'], yearOf: 'archive' },
];

type UrlCache = Record<string, string>;

function loadCache(): UrlCache {
  try {
    if (existsSync(CACHE_PATH)) {
      return JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as UrlCache;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function saveCache(cache: UrlCache) {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

function absUrl(u: string) {
  if (!u) return u;
  if (u.startsWith('http')) return u;
  if (u.startsWith('//')) return `http:${u}`;
  if (u.startsWith('/')) return `${BASE}${u}`;
  return `${BASE}/${u}`;
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );
}

/** Extract inner HTML of every .wsite-section-content via div depth matching. */
function extractSectionContents(html: string): string[] {
  const sections: string[] = [];
  const re = /<div([^>]*\bclass=["'][^"']*\bwsite-section-content\b[^"']*["'][^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const start = m.index + m[0].length;
    let i = start;
    let depth = 1;
    while (i < html.length && depth > 0) {
      const nextOpen = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);
      if (nextClose < 0) break;
      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth++;
        i = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) {
          sections.push(html.slice(start, nextClose));
          break;
        }
        i = nextClose + 6;
      }
    }
  }
  return sections;
}

function isJunkImage(url: string) {
  const u = url.toLowerCase();
  return (
    u.includes('background-images/') ||
    u.includes('footer-toast') ||
    u.includes('/published/78-1.jpg') ||
    u.includes('686098162') ||
    /\/(icon|logo|button|spacer|favicon)/i.test(u)
  );
}

function isNavJunkText(text: string) {
  if (/^Menu\s+20\d{2}/i.test(text)) return true;
  if (/Powered by|Create your own|Weebly|Featured Products/i.test(text)) {
    return true;
  }
  if (
    text.length > 100 &&
    /ՆՈՐՈւԹՅՈւՆՆԵՐ/i.test(text) &&
    /Այցելություններ|ԳՆԱՀԱՏՈՒՄ|օրինակելի/i.test(text)
  ) {
    return true;
  }
  if ((text.match(/>/g) || []).length >= 3 && text.length < 200) return true;
  return false;
}

type Block =
  | { type: 'h2' | 'h3' | 'p' | 'quote'; text: string }
  | { type: 'img'; src: string; alt: string }
  | { type: 'file'; href: string; label: string }
  | { type: 'video'; href: string; label: string };

function sectionToBlocks(sectionHtml: string): Block[] {
  let html = sectionHtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(
      /<div[^>]*(?:wsite-menu|wsite-nav|nav-wrap|mobile-nav)[^>]*>[\s\S]*?<\/div>/gi,
      ' ',
    );

  const blocks: Block[] = [];
  const seenImg = new Set<string>();
  const seenText = new Set<string>();

  // Walk in document order via a lightweight tokenizer
  const tokenRe =
    /<(h2|h3|p|blockquote|li|img|a|iframe)(\s[^>]*)?>([\s\S]*?)<\/\1>|<img(\s[^>]*)?\/?>|<iframe(\s[^>]*)?>[\s\S]*?<\/iframe>/gi;

  // Simpler sequential: replace iframes/imgs first as markers, then text tags
  // 1) images
  for (const m of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = m[1] || '';
    const src =
      attrs.match(/\b(?:src|data-src)=["']([^"']+)["']/i)?.[1] ||
      attrs.match(/\b(?:src|data-src)=([^\s>]+)/i)?.[1] ||
      '';
    const alt = attrs.match(/\balt=["']([^"']*)["']/i)?.[1] || '';
    if (!src) continue;
    const abs = absUrl(decodeURIComponent(src.split('?')[0]));
    if (isJunkImage(abs) || seenImg.has(abs)) continue;
    if (!/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(abs) && !/uploads\//i.test(abs)) {
      continue;
    }
    seenImg.add(abs);
    blocks.push({ type: 'img', src: abs, alt: decodeEntities(alt).trim() });
  }

  // 2) youtube iframes / links
  for (const m of html.matchAll(
    /(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{6,})/gi,
  )) {
    const href = `https://www.youtube.com/watch?v=${m[1]}`;
    if (seenText.has(href)) continue;
    seenText.add(href);
    blocks.push({ type: 'video', href, label: 'Տեսանյութ' });
  }

  // 3) file links
  for (const m of html.matchAll(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
  )) {
    const attrs = m[1] || '';
    const hrefRaw = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1] || '';
    if (!hrefRaw) continue;
    const href = absUrl(decodeURIComponent(hrefRaw.split('?')[0]));
    const label = decodeEntities(m[2].replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (/\.(pdf|docx?|xlsx?|pptx?)(\?|$)/i.test(href)) {
      if (seenText.has(href)) continue;
      seenText.add(href);
      blocks.push({
        type: 'file',
        href,
        label: label || basename(href),
      });
    }
  }

  // 4) text blocks
  for (const m of html.matchAll(
    /<(h2|h3|p|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi,
  )) {
    const tag = m[1].toLowerCase();
    let text = decodeEntities(m[2].replace(/<[^>]+>/g, ' '));
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length < 2) continue;
    if (isNavJunkText(text)) continue;
    const key = text.slice(0, 80);
    if (seenText.has(key)) continue;
    seenText.add(key);

    if (tag === 'h2') blocks.push({ type: 'h2', text });
    else if (tag === 'h3') blocks.push({ type: 'h3', text });
    else if (tag === 'blockquote') blocks.push({ type: 'quote', text });
    else blocks.push({ type: 'p', text });
  }

  return blocks;
}

function blocksToMarkdown(
  title: string,
  blocks: Block[],
  resolveMedia: (url: string) => string,
): string {
  const lines: string[] = [];
  const images: string[] = [];
  const files: { href: string; label: string }[] = [];
  const videos: { href: string; label: string }[] = [];

  for (const b of blocks) {
    if (b.type === 'img') {
      images.push(resolveMedia(b.src));
      continue;
    }
    if (b.type === 'file') {
      files.push({ href: resolveMedia(b.href), label: b.label });
      continue;
    }
    if (b.type === 'video') {
      videos.push(b);
      continue;
    }
    // skip duplicate page title headings
    if (
      (b.type === 'h2' || b.type === 'h3') &&
      b.text.replace(/\s+/g, ' ') === title.replace(/\s+/g, ' ')
    ) {
      continue;
    }
    if (b.type === 'h2') lines.push(`## ${b.text}`, '');
    else if (b.type === 'h3') lines.push(`### ${b.text}`, '');
    else if (b.type === 'quote') lines.push(`> ${b.text}`, '');
    else if (b.text.length >= 20) lines.push(b.text, '');
  }

  if (files.length) {
    lines.push('### Փաստաթղթեր', '');
    for (const f of files) lines.push(`- [${f.label}](${f.href})`);
    lines.push('');
  }
  if (images.length) {
    lines.push('### Լուսանկարներ', '');
    for (const src of images) lines.push(`![ ](${src})`, '');
  }
  if (videos.length) {
    lines.push('### Տեսանյութեր', '');
    for (const v of videos) lines.push(`[${v.label}](${v.href})`, '');
  }

  return lines.join('\n').trim();
}

function hubMarkdown(
  title: string,
  children: { slug: string; title: string }[],
) {
  const lines = [
    `${title} բաժնի էջ։ Ընտրեք ենթաբաժինը.`,
    '',
  ];
  for (const c of children) {
    lines.push(`- [${c.title}](/p/${c.slug})`);
  }
  return lines.join('\n').trim();
}

async function fetchHtml(path: string) {
  const url = path.startsWith('http') ? path : absUrl(path);
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function getDrive() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const refresh = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!folderId || !refresh || !clientId || !clientSecret) return null;
  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refresh });
  return { drive: google.drive({ version: 'v3', auth: oauth2 }), folderId };
}

async function uploadOne(
  drive: NonNullable<Awaited<ReturnType<typeof getDrive>>>,
  remoteUrl: string,
  cache: UrlCache,
) {
  if (cache[remoteUrl]) return cache[remoteUrl];
  if (/googleusercontent\.com|drive\.google\.com/i.test(remoteUrl)) {
    cache[remoteUrl] = remoteUrl;
    return remoteUrl;
  }
  const res = await fetch(remoteUrl, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  let contentType =
    res.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
  if (/\.pdf$/i.test(remoteUrl)) contentType = 'application/pdf';
  else if (/\.docx$/i.test(remoteUrl)) {
    contentType =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (/\.png$/i.test(remoteUrl)) contentType = 'image/png';
  else if (/\.(jpe?g)$/i.test(remoteUrl)) contentType = 'image/jpeg';

  let original = 'file';
  try {
    original = basename(decodeURIComponent(new URL(remoteUrl).pathname));
  } catch {
    /* ignore */
  }
  const name = `${Date.now()}-${original.replace(/[^\w.\-()+ ]+/gi, '_')}`.slice(
    0,
    180,
  );
  const created = await drive.drive.files.create({
    requestBody: {
      name,
      parents: [drive.folderId],
      description: `wsite resync ${remoteUrl}`,
    },
    media: { mimeType: contentType, body: Readable.from(buf) },
    fields: 'id',
    supportsAllDrives: true,
  });
  const fileId = created.data.id!;
  await drive.drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });
  const isDoc = /\.(pdf|docx?|xlsx?|pptx?)(\?|$)/i.test(remoteUrl);
  const view = isDoc
    ? `https://drive.google.com/file/d/${fileId}/view`
    : `https://lh3.googleusercontent.com/d/${fileId}`;
  cache[remoteUrl] = view;
  return view;
}

async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<void>,
) {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, () =>
      worker(),
    ),
  );
}

function yearLabelFromSlug(slug: string) {
  const m = slug.match(/(20\d{2})-(20\d{2})$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

async function main() {
  const cache = loadCache();
  const drive = DRY ? null : await getDrive();
  const sources = SECTION_SOURCES.filter(
    (s) => !ONLY.length || ONLY.includes(s.slug),
  );

  const pendingUpload = new Set<string>();
  const prepared: {
    slug: string;
    title: string;
    yearOf?: string;
    am: string;
    cover?: string;
  }[] = [];

  for (const src of sources) {
    if (PRESERVE.has(src.slug)) {
      console.log('SKIP curated', src.slug);
      continue;
    }

    const title = src.title.am;
    if (!src.paths.length) {
      const kids = SECTION_SOURCES.filter((s) => s.yearOf === src.slug).map(
        (s) => ({ slug: s.slug, title: s.title.am }),
      );
      // Also hub children for school-life
      const hubKids =
        src.slug === 'school-life'
          ? [
              { slug: 'visits', title: 'Այցելություններ' },
              { slug: 'meetings', title: 'Հանդիպումներ' },
              { slug: 'exemplary-lessons', title: 'Օրինակելի դասեր' },
              { slug: 'project-based-learning', title: 'Նախագծային ուսուցում' },
              { slug: 'lesson-led-by', title: 'Դասը վարում է…' },
              { slug: 'events', title: 'Միջոցառումներ' },
            ]
          : kids;
      prepared.push({
        slug: src.slug,
        title,
        yearOf: src.yearOf,
        am: hubMarkdown(title, hubKids),
      });
      console.log('HUB', src.slug);
      continue;
    }

    const allBlocks: Block[] = [];
    for (const path of src.paths) {
      try {
        const html = await fetchHtml(path);
        let sections = extractSectionContents(html);
        if (!sections.length) {
          // fallback: #wsite-content
          const m = html.match(
            /id=["']wsite-content["'][^>]*>([\s\S]*?)<footer/i,
          );
          if (m) sections = [m[1]];
        }
        // Prefer largest section (main body); also merge all non-tiny
        const usable = sections
          .filter((s) => s.length > 80)
          .sort((a, b) => b.length - a.length);
        const picked = usable.length ? usable : sections;
        for (const sec of picked.slice(0, 3)) {
          allBlocks.push(...sectionToBlocks(sec));
        }
        console.log(
          'OK',
          src.slug,
          path.slice(0, 50),
          'sections',
          sections.length,
          'blocks',
          allBlocks.length,
        );
      } catch (e) {
        console.warn('FAIL fetch', src.slug, path, String(e).slice(0, 100));
      }
    }

    // Deduplicate blocks roughly
    const deduped: Block[] = [];
    const seen = new Set<string>();
    for (const b of allBlocks) {
      const key =
        b.type === 'img'
          ? `img:${b.src}`
          : b.type === 'file' || b.type === 'video'
            ? `${b.type}:${b.href}`
            : `${b.type}:${b.text.slice(0, 60)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(b);
    }

    for (const b of deduped) {
      if (b.type === 'img' && !cache[b.src] && /school78|weebly|uploads\//i.test(b.src)) {
        pendingUpload.add(b.src);
      }
      if (
        b.type === 'file' &&
        !cache[b.href] &&
        /school78|weebly|uploads\//i.test(b.href)
      ) {
        pendingUpload.add(b.href);
      }
    }

    prepared.push({
      slug: src.slug,
      title,
      yearOf: src.yearOf,
      am: '', // filled after uploads
      // stash blocks in title field? use side map
    });
    (prepared[prepared.length - 1] as { _blocks?: Block[] })._blocks = deduped;
  }

  const toUpload = [...pendingUpload];
  console.log('Pending media upload', toUpload.length);

  if (drive && toUpload.length && !DRY) {
    let ok = 0;
    let fail = 0;
    await mapPool(toUpload, CONCURRENCY, async (url, i) => {
      try {
        await uploadOne(drive, url, cache);
        ok++;
        if ((i + 1) % 20 === 0 || i === toUpload.length - 1) {
          saveCache(cache);
          console.log(`upload ${ok + fail}/${toUpload.length} ok=${ok}`);
        }
      } catch (e) {
        fail++;
        console.warn('upload fail', url.slice(0, 90), String(e).slice(0, 80));
      }
    });
    saveCache(cache);
    console.log({ uploadedOk: ok, uploadedFail: fail });
  }

  const resolveMedia = (url: string) => {
    const key = url.split('?')[0];
    return cache[key] || cache[url] || url;
  };

  let updated = 0;
  for (const item of prepared) {
    const blocks = (item as { _blocks?: Block[] })._blocks;
    let am = item.am;
    if (blocks) {
      am = blocksToMarkdown(item.title, blocks, resolveMedia);
    }
    if (!am.trim()) {
      console.warn('empty content', item.slug);
      continue;
    }

    // First image as cover when available
    const cover = am.match(/!\[[^\]]*\]\(([^)]+)\)/)?.[1] || null;

    if (DRY) {
      console.log('DRY', item.slug, 'chars', am.length, 'cover', !!cover);
      continue;
    }

    const existing = await prisma.page.findUnique({ where: { slug: item.slug } });
    const yearLabel = yearLabelFromSlug(item.slug);
    const parentSlug = item.yearOf || existing?.parentSlug || null;

    const content = {
      am,
      en: (existing?.content as { en?: string })?.en || '',
      ru: (existing?.content as { ru?: string })?.ru || '',
    };

    if (existing) {
      await prisma.page.update({
        where: { id: existing.id },
        data: {
          content,
          coverImage: cover || existing.coverImage,
          status: PostStatus.PUBLISHED,
          parentSlug,
          yearLabel: yearLabel || existing.yearLabel,
          title: {
            am: item.title,
            en: (existing.title as { en?: string })?.en || '',
            ru: (existing.title as { ru?: string })?.ru || '',
          },
        },
      });
    } else {
      await prisma.page.create({
        data: {
          slug: item.slug,
          title: L(item.title),
          content,
          coverImage: cover,
          status: PostStatus.PUBLISHED,
          parentSlug,
          yearLabel,
        },
      });
    }
    updated++;
    console.log('saved', item.slug, 'chars', am.length);
  }

  console.log({ updated, dry: DRY, cached: Object.keys(cache).length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
