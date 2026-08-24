/** Parse / serialize staff :::person blocks without exposing markdown to editors. */

export type StaffCard = {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo: string;
};

function newId() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyStaffCard(): StaffCard {
  return { id: newId(), name: "", role: "", bio: "", photo: "" };
}

/**
 * Unify scraped bio openings to one style:
 *   Ծնվել է՝ <date>[, <place>]։
 *   Կրթություն՝ <studies>։
 * Also normalizes first-person lines and place-only headers.
 */
export function normalizeStaffBio(raw: string): string {
  let text = raw
    .replace(/&nbsp;/gi, " ")
    .replace(/[`´]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";

  // Drop "Ես՝ Անուն Ազգանուն, …" — name is already on the card
  text = text.replace(/^Ես\s*՝?\s*[^,.]{2,80}[,.]\s*/i, "");

  // Place-only → birth line
  text = text.replace(/^Ծննդավայրը?\s*[՝:]?\s*/i, "Ծնվել է՝ ");

  // Birth label variants → Ծնվել է՝
  text = text
    .replace(/^Ծննդյան\s+տարեթիվ\s*[՝:]?\s*/i, "Ծնվել է՝ ")
    .replace(/^Ծնված\s*[՝:]?\s*/i, "Ծնվել է՝ ")
    .replace(/^Ծնվել\s+եմ\s*/i, "Ծնվել է՝ ")
    .replace(/^ծնվել\s+եմ\s*/i, "Ծնվել է՝ ")
    .replace(/^Ծնվել\s+է\s+է\s*/i, "Ծնվել է՝ ")
    .replace(/^Ծնվել\s+է\s*[՝:]?\s*/i, "Ծնվել է՝ ")
    .replace(/^ծնվել\s+է\s*[՝:]?\s*/i, "Ծնվել է՝ ")
    // Bare "Ծնվել 01.05.…"
    .replace(/^Ծնվել\s+(?=\d)/i, "Ծնվել է՝ ");

  // Mid-text first person (after name strip leftovers)
  text = text.replace(/\sծնվել եմ\s+/gi, " Ծնվել է՝ ");

  // Orphan month/day (year line lost) → still label as birth
  if (
    !/^Ծնվել է՝/i.test(text) &&
    /^(?:\d{1,2}\.?\s*)?(?:հունվար|փետրվար|մարտ|ապրիլ|մայիս|հունիս|հուլիս|օգոստոս|սեպտեմբեր|հոկտեմբեր|նոյեմբեր|դեկտեմբեր)/i.test(
      text,
    )
  ) {
    text = `Ծնվել է՝ ${text}`;
  }

  // Known fix: year dropped for one card in an earlier pass
  if (
    text.startsWith("Ծնվել է՝ հոկտեմբերի 13-ին") ||
    text.startsWith("հոկտեմբերի 13-ին")
  ) {
    text = text.replace(
      /^(?:Ծնվել է՝\s*)?հոկտեմբերի 13-ին/,
      "Ծնվել է՝ 1992թ. հոկտեմբերի 13-ին",
    );
  }

  // Collapse accidental double markers
  text = text.replace(/Ծնվել է՝\s*Ծնվել է՝\s*/gi, "Ծնվել է՝ ");
  text = text.replace(/Ծնվել է՝\s*[՝:]+\s*/g, "Ծնվել է՝ ");

  // Education / work headers → one style
  text = text
    .replace(/\s*Կրթությունը?\s*[՝:]?\s*/gi, " Կրթություն՝ ")
    .replace(/\s*Աշխատանքային գործունեություն\s*[՝:]?\s*/gi, " Աշխատանք՝ ")
    .replace(/\s*Աշխատանքային փորձ\s*[՝:]?\s*/gi, " Աշխատանք՝ ")
    .replace(/\s*Աշխատանք\s*[՝:]\s*/gi, " Աշխատանք՝ ");

  text = text.replace(/Կրթություն՝\s*Կրթություն՝/gi, " Կրթություն՝ ");

  // Insert Կրթություն՝ before first study narrative if missing
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

  // Study phrasing consistency
  text = text
    .replace(/ընդունվել եւ ավարտել/gi, "ընդունվել և ավարտել")
    .replace(/ընդունվել է և\s+(\d{4})/gi, "ընդունվել է և $1");

  // First-person CV verbs → third person (matches Ծնվել է style)
  text = text
    .replace(/սովորել եմ/gi, "սովորել է")
    .replace(/աշխատել եմ/gi, "աշխատել է")
    .replace(/ավարտել եմ/gi, "ավարտել է")
    .replace(/ընդունվել եմ/gi, "ընդունվել է")
    .replace(/ամուսնացած եմ/gi, "ամուսնացած է")
    .replace(/\sունեմ\s+/gi, " ունի ");

  return text.replace(/\s+/g, " ").trim();
}

export function isStaffPageContent(markdown: string, slug?: string) {
  if (/:::person/.test(markdown)) return true;
  return slug === "staff" || slug === "teachers";
}

export function parseStaffContent(markdown: string): {
  intro: string;
  people: StaffCard[];
} {
  const people: StaffCard[] = [];
  const re = /:::person\s*([\s\S]*?):::/g;
  let m: RegExpExecArray | null;
  let working = markdown;

  while ((m = re.exec(markdown))) {
    const block = m[1].trim();
    let name = "";
    let photo = "";
    let role = "";
    const bioLines: string[] = [];

    for (const line of block.split("\n").map((l) => l.trim()).filter(Boolean)) {
      const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (img) {
        name = img[1].trim() || name;
        const src = img[2].trim();
        photo = src && src !== "#" ? src : "";
        continue;
      }
      const bold = line.match(/^\*\*(.+)\*\*$/);
      if (bold && !role) {
        role = bold[1].trim();
        continue;
      }
      bioLines.push(line);
    }

    people.push({
      id: newId(),
      name: name || "Աշխատակից",
      role,
      bio: normalizeStaffBio(bioLines.join("\n").trim()),
      photo,
    });
  }

  working = markdown.replace(/:::person[\s\S]*?:::/g, "").trim();
  working = working.replace(/^##\s+.+$/m, "").trim();

  return { intro: working, people };
}

export function serializeStaffContent(
  title: string,
  intro: string,
  people: StaffCard[],
): string {
  const lines: string[] = [];
  const cleanTitle = title.trim();
  if (cleanTitle) lines.push(`## ${cleanTitle}`, "");
  const lead = intro.trim();
  if (lead) lines.push(lead, "");

  for (const p of people) {
    const name = (p.name || "Աշխատակից").trim().replace(/[[\]]/g, "");
    const photo = p.photo.trim();
    if (!photo && !name) continue;
    lines.push(":::person");
    if (photo) lines.push(`![${name}](${photo})`);
    else lines.push(`![${name}]()`);
    if (p.role.trim()) lines.push(`**${p.role.trim()}**`);
    if (p.bio.trim()) lines.push(normalizeStaffBio(p.bio.trim()));
    lines.push(":::", "");
  }

  return lines.join("\n").trim();
}
