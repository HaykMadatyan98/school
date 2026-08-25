/** Helpers to keep page body text separate from photos/PDFs in the admin editor. */

export type PageImage = { url: string; alt: string };
export type PagePdf = { url: string; label: string };

/** PDF / DOCX / other downloadable docs (incl. Drive file links). */
export function isPdfHref(href: string, label = "") {
  return (
    /\.(pdf|docx?|xlsx?|pptx?)(\b|$)/i.test(href) ||
    /\.(pdf|docx?|xlsx?|pptx?)$/i.test(label) ||
    href.includes("mock-document") ||
    /drive\.google\.com\/file\/d\//i.test(href) ||
    (/drive\.google\.com\/uc\?/i.test(href) &&
      /export=download/i.test(href))
  );
}

export function docBadgeLabel(href: string, label = "") {
  const from = `${label} ${href}`;
  if (/\.docx?(\b|$)/i.test(from)) return "DOC";
  if (/\.xlsx?(\b|$)/i.test(from)) return "XLS";
  if (/\.pptx?(\b|$)/i.test(from)) return "PPT";
  return "PDF";
}

function cleanText(md: string) {
  return md
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Pull photos and PDF links out of markdown so the text editor stays clean.
 * Leaves :::person blocks and normal links untouched.
 */
export function splitContentAndMedia(markdown: string): {
  text: string;
  images: PageImage[];
  pdfs: PagePdf[];
} {
  const images: PageImage[] = [];
  const pdfs: PagePdf[] = [];

  // Protect person blocks from media extraction
  const personBlocks: string[] = [];
  let working = markdown.replace(/:::person[\s\S]*?:::/g, (block) => {
    const token = `@@PERSON_${personBlocks.length}@@`;
    personBlocks.push(block);
    return token;
  });

  working = working.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_full, alt, url) => {
    const src = String(url || "").trim();
    if (src) images.push({ url: src, alt: String(alt || "") });
    return "";
  });

  working = working.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (full, label, url) => {
    const href = String(url || "").trim();
    const name = String(label || "").trim();
    const isPdf = isPdfHref(href, name);
    if (isPdf && href) {
      pdfs.push({ url: href, label: name.replace(/\.pdf$/i, "") || "PDF" });
      return "";
    }
    return full;
  });

  // Drop empty "### Documents" headings left behind
  working = working.replace(
    /^###\s*(Փաստաթղթեր|Documents|Документы)\s*$/gim,
    "",
  );
  working = working.replace(/^-\s*$/gm, "");

  personBlocks.forEach((block, i) => {
    working = working.replace(`@@PERSON_${i}@@`, block);
  });

  return { text: cleanText(working), images, pdfs };
}

export function mergeContentAndMedia(
  text: string,
  images: PageImage[],
  pdfs: PagePdf[],
): string {
  const parts: string[] = [cleanText(text)];

  if (images.length) {
    parts.push("");
    for (const img of images) {
      if (!img.url.trim()) continue;
      parts.push(`![${img.alt || ""}](${img.url.trim()})`);
    }
  }

  if (pdfs.length) {
    parts.push("", "### Փաստաթղթեր", "");
    for (const pdf of pdfs) {
      if (!pdf.url.trim()) continue;
      const label = (pdf.label || "PDF").trim();
      parts.push(`- [${label}](${pdf.url.trim()})`);
    }
  }

  return cleanText(parts.join("\n"));
}
