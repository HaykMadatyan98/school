"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type GalleryMedia = {
  src: string;
  alt?: string;
  kind?: "image" | "video";
};

type Props = {
  images: GalleryMedia[];
};

const INITIAL_THUMBS = 16;
const THUMB_STEP = 20;

function isVideoUrl(src: string, kind?: string) {
  if (kind === "video") return true;
  if (kind === "image") return false;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src);
}

function youtubeId(src: string) {
  const m =
    src.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i,
    ) || src.match(/[?&]v=([\w-]{6,})/i);
  return m?.[1] || null;
}

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {dir === "left" ? (
        <path d="M15 6 9 12l6 6" />
      ) : (
        <path d="m9 6 6 6-6 6" />
      )}
    </svg>
  );
}

function MediaFrame({
  item,
  className,
  eager,
}: {
  item: GalleryMedia;
  className?: string;
  eager?: boolean;
}) {
  const video = isVideoUrl(item.src, item.kind);
  const yt = youtubeId(item.src);

  if (yt) {
    return (
      <iframe
        title={item.alt || "Video"}
        src={`https://www.youtube.com/embed/${yt}`}
        className={className}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (video) {
    return (
      <video
        src={item.src}
        className={className}
        controls
        playsInline
        preload={eager ? "metadata" : "none"}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.src}
      alt={item.alt || ""}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
    />
  );
}

export function GallerySlider({ images }: Props) {
  const items = useMemo(
    () => images.filter((img) => Boolean(img.src?.trim())),
    [images],
  );
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [visibleThumbs, setVisibleThumbs] = useState(INITIAL_THUMBS);
  const [loadedThumbs, setLoadedThumbs] = useState<Set<number>>(
    () => new Set([0]),
  );
  const thumbEndRef = useRef<HTMLButtonElement | null>(null);
  const thumbStripRef = useRef<HTMLDivElement | null>(null);
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);
  const total = items.length;
  const current = items[Math.min(index, Math.max(0, total - 1))];

  const markThumbLoaded = useCallback(
    (i: number) => {
      setLoadedThumbs((prev) => {
        if (prev.has(i)) return prev;
        const next = new Set(prev);
        next.add(i);
        if (i > 0) next.add(i - 1);
        if (i + 1 < total) next.add(i + 1);
        return next;
      });
    },
    [total],
  );

  const go = useCallback(
    (dir: -1 | 1) => {
      setIndex((i) => {
        const next = (i + dir + total) % total;
        setVisibleThumbs((v) => Math.max(v, Math.min(total, next + 4)));
        markThumbLoaded(next);
        return next;
      });
    },
    [total, markThumbLoaded],
  );

  useEffect(() => {
    setIndex(0);
    setVisibleThumbs(Math.min(INITIAL_THUMBS, total));
    setLoadedThumbs(new Set([0]));
  }, [items, total]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, go]);

  useEffect(() => {
    if (!total || !current || isVideoUrl(current.src, current.kind)) return;
    for (const offset of [-1, 1]) {
      const item = items[(index + offset + total) % total];
      if (!item || isVideoUrl(item.src, item.kind)) continue;
      const el = new Image();
      el.src = item.src;
    }
    markThumbLoaded(index);
  }, [index, items, total, current, markThumbLoaded]);

  // Keep active thumbnail scrolled to the center of the strip
  useEffect(() => {
    const strip = thumbStripRef.current;
    const thumb = activeThumbRef.current;
    if (!strip || !thumb) return;
    const target =
      thumb.offsetLeft - strip.clientWidth / 2 + thumb.clientWidth / 2;
    strip.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [index, visibleThumbs]);

  useEffect(() => {
    const el = thumbEndRef.current;
    if (!el || visibleThumbs >= total) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleThumbs((v) => Math.min(total, v + THUMB_STEP));
        }
      },
      { root: el.parentElement, rootMargin: "120px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleThumbs, total, index]);

  if (!total || !current) return null;

  const thumbs = items.slice(0, Math.min(visibleThumbs, total));
  const navBtnClass =
    "absolute top-1/2 z-10 flex h-11 w-11 shrink-0 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white shadow-md backdrop-blur transition hover:bg-black/70";

  return (
    <div className="not-prose my-8 md:my-10">
      <div className="relative overflow-hidden rounded-[var(--radius-xl)] bg-[#e8eef2]">
        <button
          type="button"
          className="group flex aspect-[16/10] w-full items-center justify-center leading-none"
          onClick={() => setLightbox(true)}
          aria-label="Open gallery"
        >
          <MediaFrame
            item={current}
            eager
            className="max-h-full max-w-full object-contain transition duration-500 group-hover:scale-[1.01]"
          />
        </button>

        {current.alt ? (
          <p className="pointer-events-none absolute bottom-14 left-1/2 z-10 max-w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 rounded-[var(--radius-md)] bg-black/55 px-3 py-2 text-center text-[length:var(--text-sm)] leading-snug text-white backdrop-blur">
            {current.alt}
          </p>
        ) : null}

        {total > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={() => go(-1)}
              className={`${navBtnClass} left-3`}
            >
              <ChevronIcon dir="left" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => go(1)}
              className={`${navBtnClass} right-3`}
            >
              <ChevronIcon dir="right" />
            </button>
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[length:var(--text-xs)] font-medium tabular-nums text-white backdrop-blur">
              {index + 1} / {total}
            </div>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <>
          <div
            ref={thumbStripRef}
            className="mt-3 flex gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:thin]"
          >
            {thumbs.map((img, i) => {
              const active = i === index;
              const shouldLoad = loadedThumbs.has(i) || active || i < 8;
              return (
                <button
                  key={`${img.src}-${i}`}
                  ref={(node) => {
                    if (i === thumbs.length - 1) thumbEndRef.current = node;
                    if (active) activeThumbRef.current = node;
                  }}
                  type="button"
                  onClick={() => {
                    setIndex(i);
                    markThumbLoaded(i);
                  }}
                  onMouseEnter={() => markThumbLoaded(i)}
                  onFocus={() => markThumbLoaded(i)}
                  className={`relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border-2 bg-mist leading-none transition sm:h-16 sm:w-24 ${
                    active
                      ? "border-accent"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  {shouldLoad ? (
                    <MediaFrame
                      item={img}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 animate-pulse bg-mist" />
                  )}
                </button>
              );
            })}
          </div>

          {visibleThumbs < total ? (
            <button
              type="button"
              onClick={() =>
                setVisibleThumbs((v) => Math.min(total, v + THUMB_STEP))
              }
              className="mt-3 text-[length:var(--text-sm)] font-semibold text-accent-deep hover:underline"
            >
              Ցույց տալ ևս {Math.min(THUMB_STEP, total - visibleThumbs)} (
              {visibleThumbs}/{total})
            </button>
          ) : null}
        </>
      ) : null}

      {lightbox && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg leading-none text-white"
            onClick={() => setLightbox(false)}
            aria-label="Close"
          >
            ✕
          </button>
          {total > 1 ? (
            <button
              type="button"
              className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label="Previous"
            >
              <ChevronIcon dir="left" />
            </button>
          ) : null}
          <div
            className="flex max-h-[85vh] max-w-[92vw] items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <MediaFrame
              item={current}
              eager
              className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain"
            />
          </div>
          {total > 1 ? (
            <button
              type="button"
              className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label="Next"
            >
              <ChevronIcon dir="right" />
            </button>
          ) : null}
          {current.alt ? (
            <p className="absolute bottom-6 left-1/2 max-w-xl -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-center text-sm text-white">
              {current.alt}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
