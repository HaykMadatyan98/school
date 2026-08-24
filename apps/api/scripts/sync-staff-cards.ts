/**
 * Rebuild /p/staff (+ teachers) with structured person cards.
 * npm run sync:staff -w api
 */
import { PrismaClient, PostStatus } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

loadEnv();

const prisma = new PrismaClient();
const BASE = 'http://school78.safe.am';
const STAFF_PATH =
  '/133214021408140014091387-1377139913891377140713771391137713821396.html';

const ROLE_HINT =
  /(տեղակալ|հոգեբան|բուժքույր|օգնական|նախագահ|ուսուցիչ|ուսուցչուհի|դաստիարակ|մեթոդ|տնօրեն|քարտուղար|գրադարանավար|հաշվապահ|կազմակերպիչ|լաբորանտ)/i;

const ROLE_PREFIX =
  /(ուսումնական|վարչատնտեսական|մասնագիտացված|կրթական|դաստիարակչական|աջակցությունների|աշխատանքի|աշխատանքների|գծով|ուսուցչի|մեթոդմիավորման|ավագ)/i;

const BIO_START =
  /(Ծնվել|Ծննդյան|Ծննդավայր|Ծնված|ծնվել եմ|Ես[`']?\s|Կրթություն|Աշխատանք՝|Աշխատանքային)/i;

type Person = { name: string; role: string; bio: string; photo: string };

function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function clean(t: string) {
  return decodeEntities(t)
    .replace(/[\u00a0\u200b\u200c\u200d\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absUrl(u: string) {
  const raw = decodeURIComponent(u.split('?')[0]);
  if (raw.startsWith('http')) return raw;
  if (raw.startsWith('//')) return `http:${raw}`;
  return `${BASE}${raw.startsWith('/') ? raw : `/${raw}`}`;
}

function isJunk(url: string) {
  const u = url.toLowerCase();
  return (
    u.includes('background-images/') ||
    u.includes('footer-toast') ||
    u.includes('/download.jpg') ||
    u.includes('_orig.') ||
    /\/published\/78-1\.jpg$/i.test(u) ||
    /icon|logo|button|spacer|facebook|twitter|weebly|toast/i.test(u)
  );
}

/** Strip leading list numbers like "9" */
function stripLeadingNumber(s: string) {
  return s.replace(/^\d{1,3}\s+/, '').trim();
}

function splitNameRoleBio(plain: string): {
  name: string;
  role: string;
  bio: string;
} {
  let text = stripLeadingNumber(clean(plain));

  const bioM = text.match(BIO_START);
  let head = bioM ? text.slice(0, bioM.index).trim() : text.slice(0, 120).trim();
  let bio = bioM ? text.slice(bioM.index!).trim() : '';

  // If no bio marker, try to keep only first 2–4 name-like tokens as name
  if (!bioM) {
    const words = text.split(/\s+/);
    const nameWords: string[] = [];
    for (const w of words) {
      if (!/^[\u0531-\u0587]/.test(w)) {
        if (nameWords.length >= 2) break;
        continue;
      }
      // stop if word looks like bio/role keyword mid-stream after we have a name
      if (
        nameWords.length >= 2 &&
        /^(Ծնվ|Կրթ|Աշխ|Մեթ|Ուսո|հոգ|բուժ)/i.test(w)
      ) {
        break;
      }
      nameWords.push(w.replace(/[.,;:]+$/, ''));
      if (nameWords.length >= 4) break;
    }
    if (nameWords.length >= 2) {
      head = nameWords.join(' ');
      bio = clean(text.slice(text.indexOf(nameWords[nameWords.length - 1]) + nameWords[nameWords.length - 1].length));
    }
  }

  head = stripLeadingNumber(clean(head));
  bio = clean(bio).slice(0, 520);
  bio = bio.replace(/(Create your|Powered by|ՆՈՐՈւԹ).*$/i, '').trim();

  const words = head.split(/\s+/).filter(Boolean);
  let hintIdx = -1;
  for (let i = 0; i < words.length; i++) {
    if (ROLE_HINT.test(words[i])) {
      hintIdx = i;
      break;
    }
  }

  let name = head;
  let role = '';
  if (hintIdx >= 0) {
    let start = hintIdx;
    for (let j = hintIdx - 1; j >= 0; j--) {
      if (ROLE_PREFIX.test(words[j])) start = j;
      else break;
    }
    if (start > 0 && ROLE_PREFIX.test(words[start - 1])) start -= 1;
    role = words.slice(start).join(' ').trim();
    name = words.slice(0, start).join(' ').trim();
  }

  // Name should stay short — if still long, cut at first bio leak
  name = stripLeadingNumber(name);
  if (name.length > 48 || BIO_START.test(name)) {
    const nm = name.match(
      /^([\u0531-\u0587]+(?:\s+[\u0531-\u0587]+){1,3})/,
    );
    if (nm) {
      const rest = clean(name.slice(nm[1].length) + ' ' + bio);
      name = nm[1];
      if (!role && ROLE_HINT.test(rest)) {
        const { name: _n, role: r, bio: b } = splitNameRoleBio(rest);
        role = r;
        bio = b || rest;
      } else if (!bio) {
        bio = rest;
      }
    }
  }

  // Infer role from bio if missing (e.g. ուսուցչուհի)
  if (!role) {
    const fromBio = bio.match(
      /(?:որպես|՝)\s*([^.]{0,40}?(?:ուսուցիչ|ուսուցչուհի|հոգեբան|տեղակալ|օգնական|նախագահ)[^0-9.]{0,20})/i,
    );
    if (fromBio) {
      role = clean(fromBio[1]).replace(/[։.].*$/, '').trim().slice(0, 60);
    } else if (/հայոց\s+լեզվի|գրականության\s+ուսուց/i.test(bio)) {
      role = 'Հայոց լեզվի և գրականության ուսուցիչ';
    }
  }

  return { name: name || 'Աշխատակից', role, bio };
}

function extractPeople(html: string): Person[] {
  const decoded = decodeEntities(html);
  const out: Person[] = [];
  const seenPhoto = new Set<string>();
  const seenName = new Set<string>();

  for (const m of decoded.matchAll(/<img([^>]+)>/gi)) {
    const srcM = m[1].match(/src=["']([^"']+)/i);
    if (!srcM) continue;
    const photo = absUrl(srcM[1]);
    if (!photo.includes('/uploads/') || isJunk(photo)) continue;
    if (seenPhoto.has(photo)) continue;

    // Prefer nearby name in <strong>/<font>; role often in <em>
    const windowHtml = decoded.slice(
      m.index!,
      m.index! + m[0].length + 1600,
    );

    const looksLikeNamePart = (t: string) => {
      const words = t.split(/\s+/);
      if (words.length > 3) return false;
      if (/[.,։,]/.test(t)) return false;
      if (
        /(մասնախումբ|ամուսնացած|ունի|զավակ|դպրոց|համալսարան|լեզվի|աշխատ)/i.test(
          t,
        )
      ) {
        return false;
      }
      return words.every((w) => /^[\u0531-\u0587]{2,}$/i.test(w.replace(/-/g, '')));
    };

    const strongParts = [
      ...windowHtml.matchAll(
        /<strong[^>]*>([\s\S]*?)<\/strong>/gi,
      ),
    ]
      .map((x) => clean(x[1].replace(/<[^>]+>/g, ' ')))
      .map(stripLeadingNumber)
      .filter(
        (t) =>
          t.length >= 2 &&
          t.length <= 40 &&
          /^[\u0531-\u0587]/.test(t) &&
          !BIO_START.test(t) &&
          !ROLE_HINT.test(t),
      );

    // Join consecutive short strong name parts: «Իզաբելա» + «Մարտիրոսյան»
    let nameFromMarkup = '';
    if (
      strongParts.length >= 2 &&
      looksLikeNamePart(strongParts[0]) &&
      looksLikeNamePart(strongParts[1])
    ) {
      nameFromMarkup = `${strongParts[0]} ${strongParts[1]}`.trim();
    } else {
      const candidates = strongParts.filter(looksLikeNamePart);
      if (candidates.length) {
        nameFromMarkup = candidates.sort((a, b) => b.length - a.length)[0];
      }
    }
    if (nameFromMarkup.length > 48) nameFromMarkup = '';

    const roleFromMarkup = [
      ...windowHtml.matchAll(/<em[^>]*>([\s\S]*?)<\/em>/gi),
    ]
      .map((x) => clean(x[1].replace(/<[^>]+>/g, ' ')))
      .find((t) => t.length >= 3 && t.length <= 60 && ROLE_HINT.test(t));

    const after = windowHtml
      .slice(m[0].length)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
    const plain = clean(after);
    if (!/[\u0531-\u0587]/.test(plain)) continue;
    if (/ՆՈՐՈւԹՅՈւՆ|Create your own|Powered by/i.test(plain.slice(0, 80))) {
      continue;
    }

    let { name, role, bio } = splitNameRoleBio(plain);
    if (nameFromMarkup) name = nameFromMarkup;
    if (roleFromMarkup) role = roleFromMarkup;
    // Keep inferred short roles tidy
    if (role.length > 70) {
      role = role.split(/[։.]/)[0].trim().slice(0, 70);
    }

    if (name.length < 4) continue;
    // Dedupe only exact same photo; same names (homonyms) stay as separate cards
    if (seenPhoto.has(photo)) continue;
    seenPhoto.add(photo);

    // Soft-dedupe: identical name + nearly identical bio start
    const nameKey = name.toLowerCase();
    const bioKey = bio.slice(0, 40).toLowerCase();
    const twin = out.find(
      (p) =>
        p.name.toLowerCase() === nameKey &&
        p.bio.slice(0, 40).toLowerCase() === bioKey,
    );
    if (twin) {
      if (bio.length > twin.bio.length) twin.bio = bio;
      if (role && !twin.role) twin.role = role;
      continue;
    }

    seenName.add(nameKey);
    out.push({ name, role, bio, photo });
  }
  return out;
}

function toMarkdown(title: string, intro: string, people: Person[]) {
  const lines = [`## ${title}`, '', intro, ''];
  for (const p of people) {
    lines.push(':::person');
    lines.push(`![${p.name.replace(/[[\]]/g, '')}](${p.photo})`);
    if (p.role) lines.push(`**${p.role}**`);
    if (p.bio) lines.push(p.bio);
    lines.push(':::');
    lines.push('');
  }
  return lines.join('\n').trim();
}

async function main() {
  const res = await fetch(`${BASE}${STAFF_PATH}`, {
    headers: { 'User-Agent': 'School78StaffSync/1.1' },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const people = extractPeople(html);
  if (people.length < 5) throw new Error(`Too few people: ${people.length}`);

  const cover = people[0]?.photo || null;
  const staffAm = toMarkdown(
    'Դպրոցի աշխատակազմ',
    'Հ. 78 հիմնական դպրոցի մանկավարժական և վարչական աշխատակազմը։ Ստորև՝ աշխատակիցների քարտերը լուսանկարով, պաշտոնով և կարճ տեղեկանքով։',
    people,
  );

  await prisma.page.update({
    where: { slug: 'staff' },
    data: {
      title: { am: 'Դպրոցի աշխատակազմ', en: 'Staff', ru: 'Работники' },
      excerpt: {
        am: 'Մանկավարժական և վարչական աշխատակազմ՝ լուսանկարներով և կարճ կենսագրությամբ։',
        en: '',
        ru: '',
      },
      content: { am: staffAm, en: '', ru: '' },
      coverImage: cover,
      status: PostStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  const teachers = await prisma.page.findUnique({ where: { slug: 'teachers' } });
  if (teachers) {
    const teachersAm = toMarkdown(
      'Մանկավարժներ',
      'Դպրոցի մանկավարժական և վարչական կազմը՝ լուսանկարով, պաշտոնով և կարճ տեղեկանքով։',
      people,
    );
    await prisma.page.update({
      where: { slug: 'teachers' },
      data: {
        content: { am: teachersAm, en: '', ru: '' },
        excerpt: {
          am: 'Մանկավարժներ և աշխատակիցներ՝ քարտերով։',
          en: '',
          ru: '',
        },
        coverImage: cover,
        status: PostStatus.PUBLISHED,
      },
    });
  }

  console.log('Staff cards synced:', people.length);
  const broken = people.filter(
    (p) =>
      /^\d/.test(p.name) ||
      p.name.length > 48 ||
      BIO_START.test(p.name) ||
      (!p.bio && p.name.split(' ').length > 5),
  );
  for (const p of people.slice(0, 8)) {
    console.log(` - ${p.name} | ${p.role || '—'} | bio=${p.bio.slice(0, 40)}…`);
  }
  if (broken.length) {
    console.warn('Still suspicious:', broken.map((p) => p.name));
  } else {
    console.log('No suspicious names.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
