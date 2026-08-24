"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { GallerySlider } from "@/components/gallery-slider";
import { StaffCards, type StaffPerson } from "@/components/staff-cards";
import { mediaDownloadUrl } from "@/lib/api";
import { isPdfHref } from "@/lib/content-media";

const IMAGE_MD = /!\[([^\]]*)\]\(([^)]+)\)/g;
const LINK_OR_IMAGE =
  /(!\[([^\]]*)\]\(([^)]+)\))|(\[([^\]]+)\]\(([^)]+)\))/g;

function ContentImage({
  src,
  alt,
  resolveUrl,
}: {
  src: string;
  alt: string;
  resolveUrl: (u: string) => string;
}) {
  const url = resolveUrl(src.trim());
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt || ""}
      className="my-3 max-h-[28rem] w-auto max-w-full rounded-[var(--radius-lg)] border border-[var(--line)] object-contain"
      loading="lazy"
    />
  );
}

function PartnerLogos({
  images,
}: {
  images: { src: string; alt: string }[];
}) {
  if (!images.length) return null;
  return (
    <ul className="mt-6 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-3 md:grid-cols-4 md:gap-6">
      {images.map((img) => (
        <li
          key={img.src}
          className="flex min-h-[5.5rem] items-center justify-center rounded-[var(--radius-lg)] border border-[var(--line)] bg-white px-4 py-5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.src}
            alt={img.alt || ""}
            className="max-h-16 w-auto max-w-full object-contain"
            loading="lazy"
          />
        </li>
      ))}
    </ul>
  );
}

function isPartnersHeading(title: string) {
  return /^(Գործընկերներ|Partners|Партнёры|Партнеры)$/i.test(title.trim());
}

function inlineFormat(
  text: string,
  keyPrefix: string,
  resolveUrl: (u: string) => string,
): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  const re = new RegExp(LINK_OR_IMAGE.source, "g");

  while ((match = re.exec(text))) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }

    if (match[1]) {
      // Markdown image: ![alt](src)
      const alt = match[2] || "";
      const src = match[3] || "";
      parts.push(
        <ContentImage
          key={`${keyPrefix}-img-${i++}`}
          src={src}
          alt={alt}
          resolveUrl={resolveUrl}
        />,
      );
    } else {
      const label = match[5] || "";
      const href = match[6] || "";
      const isExternal =
        href.startsWith("http://") || href.startsWith("https://");
      const isPdf = isPdfHref(href, label);
      const isMock = href.startsWith("#mock");
      const pdfHref = isPdf && !isMock ? mediaDownloadUrl(href) || href : href;

      if (isPdf) {
        parts.push(
          <a
            key={`${keyPrefix}-a-${i++}`}
            href={isMock ? undefined : pdfHref}
            onClick={isMock ? (e) => e.preventDefault() : undefined}
            className="my-1 inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line)] bg-white/80 px-3 py-2 text-[length:var(--text-sm)] font-medium text-ink no-underline transition hover:border-accent/40"
            target={isExternal && !isMock ? "_blank" : undefined}
            rel={isExternal && !isMock ? "noreferrer" : undefined}
          >
            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-accent-deep">
              PDF
            </span>
            <span>{label.replace(/\.pdf$/i, "")}</span>
            {isMock ? (
              <span className="text-[0.7rem] text-ink-soft">(մոկ)</span>
            ) : null}
          </a>,
        );
      } else {
        parts.push(
          <a
            key={`${keyPrefix}-a-${i++}`}
            href={isMock ? undefined : href}
            onClick={isMock ? (e) => e.preventDefault() : undefined}
            className="font-medium text-accent-deep underline-offset-2 hover:underline"
            target={isExternal && !isMock ? "_blank" : undefined}
            rel={isExternal && !isMock ? "noreferrer" : undefined}
          >
            {label}
          </a>,
        );
      }
    }

    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Pull consecutive markdown images from the start of a line (TipTap may glue them). */
function takeImages(line: string) {
  const images: { alt: string; src: string }[] = [];
  let rest = line.trim();
  const one = /^!\[([^\]]*)\]\(([^)]+)\)\s*/;
  while (rest) {
    const m = rest.match(one);
    if (!m) break;
    if (m[2].trim()) images.push({ alt: m[1], src: m[2].trim() });
    rest = rest.slice(m[0].length).trimStart();
  }
  return { images, rest: rest.trim() };
}

function parseImageLine(line: string) {
  const { images, rest } = takeImages(line);
  if (images.length === 1 && !rest) return images[0];
  return null;
}

function parsePersonBlock(
  block: string,
  resolveUrl: (u: string) => string,
): StaffPerson | null {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let name = "";
  let photo = "";
  let role = "";
  const bioParts: string[] = [];

  for (const line of lines) {
    const img = parseImageLine(line) || takeImages(line).images[0];
    if (img) {
      name = img.alt || name;
      const src = (img.src || "").trim();
      photo =
        src && src !== "#" && !src.startsWith("about:")
          ? resolveUrl(src)
          : "";
      continue;
    }
    const bold = line.match(/^\*\*(.+)\*\*$/);
    if (bold && !role) {
      role = bold[1].trim();
      continue;
    }
    bioParts.push(line);
  }

  if (!photo && !name) return null;
  return {
    name: name || "Աշխատակից",
    role: role || undefined,
    bio: bioParts.join(" ").trim() || undefined,
    photo,
  };
}

/** Markdown-ish renderer with gallery sliders and staff person cards */
export function renderContent(
  content: string,
  resolveUrl: (u: string) => string,
) {
  // TipTap often emits images glued on one line — split for cleaner parsing
  const normalized = content.replace(/\)\s*!\[/g, ")\n![");
  const lines = normalized.split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === ":::person") {
      const people: StaffPerson[] = [];
      while (i < lines.length && lines[i].trim() === ":::person") {
        i++;
        const buf: string[] = [];
        while (i < lines.length && lines[i].trim() !== ":::") {
          buf.push(lines[i]);
          i++;
        }
        if (i < lines.length && lines[i].trim() === ":::") i++;
        const person = parsePersonBlock(buf.join("\n"), resolveUrl);
        if (person) people.push(person);
        while (i < lines.length && !lines[i].trim()) i++;
      }
      if (people.length) {
        nodes.push(
          <StaffCards key={`staff-${people[0].photo}`} people={people} />,
        );
      }
      continue;
    }

    const { images: leadingImages, rest } = takeImages(line);

    if (leadingImages.length && !rest) {
      const gallery: { src: string; alt: string }[] = leadingImages
        .map((img) => ({ src: resolveUrl(img.src), alt: img.alt }))
        .filter((img) => Boolean(img.src));
      i++;
      while (i < lines.length) {
        const next = lines[i];
        if (!next.trim()) {
          i++;
          continue;
        }
        const more = takeImages(next);
        if (!more.images.length || more.rest) break;
        for (const img of more.images) {
          const src = resolveUrl(img.src);
          if (src) gallery.push({ src, alt: img.alt });
        }
        i++;
      }
      if (gallery.length === 1) {
        nodes.push(
          <ContentImage
            key={`img-${i}-${gallery[0].src}`}
            src={gallery[0].src}
            alt={gallery[0].alt}
            resolveUrl={(u) => u}
          />,
        );
      } else if (gallery.length > 1) {
        nodes.push(
          <GallerySlider key={`gal-${i}-${gallery[0]?.src}`} images={gallery} />,
        );
      }
      continue;
    }

    if (leadingImages.length && rest) {
      for (const [idx, img] of leadingImages.entries()) {
        nodes.push(
          <ContentImage
            key={`img-mix-${i}-${idx}`}
            src={img.src}
            alt={img.alt}
            resolveUrl={resolveUrl}
          />,
        );
      }
      nodes.push(
        <p key={`p-mix-${i}`}>{inlineFormat(rest, `p-${i}`, resolveUrl)}</p>,
      );
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      nodes.push(
        <h2 key={i}>{inlineFormat(line.slice(3), `h2-${i}`, resolveUrl)}</h2>,
      );
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      const title = line.slice(4).trim();
      if (/^(Լուսանկարներ|Photos|Галерея|Gallery)$/i.test(title)) {
        i++;
        continue;
      }
      if (isPartnersHeading(title)) {
        i++;
        const logos: { src: string; alt: string }[] = [];
        while (i < lines.length) {
          const next = lines[i];
          if (!next.trim()) {
            i++;
            continue;
          }
          if (next.startsWith("#") || next.startsWith(":::")) break;
          const more = takeImages(next);
          if (!more.images.length || more.rest) break;
          for (const img of more.images) {
            const src = resolveUrl(img.src);
            if (src) logos.push({ src, alt: img.alt });
          }
          i++;
        }
        nodes.push(
          <div key={`partners-${i}`} className="mt-10">
            <h3>{title}</h3>
            <PartnerLogos images={logos} />
          </div>,
        );
        continue;
      }
      nodes.push(
        <h3 key={i}>{inlineFormat(line.slice(4), `h3-${i}`, resolveUrl)}</h3>,
      );
      i++;
      continue;
    }
    if (line.trim().startsWith(">")) {
      const quotes: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quotes.push(lines[i].replace(/^\s*>\s?/, "").trim());
        i++;
      }
      const text = quotes.join(" ").trim();
      if (text) {
        nodes.push(
          <blockquote key={`bq-${i}`} className="about-quote">
            {inlineFormat(text, `bq-${i}`, resolveUrl)}
          </blockquote>,
        );
      }
      continue;
    }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`}>
          {items.map((item, idx) => (
            <li key={idx}>{inlineFormat(item, `li-${i}-${idx}`, resolveUrl)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      nodes.push(
        <ol key={i} start={Number(line.match(/^(\d+)/)?.[1] || 1)}>
          <li>
            {inlineFormat(line.replace(/^\d+\.\s/, ""), `oli-${i}`, resolveUrl)}
          </li>
        </ol>,
      );
      i++;
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    // Paragraph that may still contain inline images
    if (IMAGE_MD.test(line)) {
      IMAGE_MD.lastIndex = 0;
      nodes.push(
        <div key={`block-${i}`} className="space-y-2">
          {inlineFormat(line, `p-${i}`, resolveUrl)}
        </div>,
      );
    } else {
      nodes.push(
        <p key={i}>{inlineFormat(line, `p-${i}`, resolveUrl)}</p>,
      );
    }
    i++;
  }

  return nodes;
}

export function useAdminT() {
  return useTranslations("admin");
}
