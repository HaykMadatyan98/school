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
  const total = items.length;
  const current = items[Math.min(index, Math.max(0, total - 1))];

  const markThumbLoaded = useCallback((i: number) => {
    setLoadedThumbs((prev) => {
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      // Also warm neighbors in the strip
      if (i > 0) next.add(i - 1);
      if (i + 1 < total) next.add(i + 1);
      return next;
    });
  }, [total]);

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

  // Prefetch neighbor full images only (lazy for the rest)
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

  // Lazy-expand thumb strip when user scrolls near the end
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

  return (
    <div className="my-8 md:my-10">
      <div className="relative overflow-hidden rounded-[var(--radius-xl)] bg-ink shadow-lg shadow-ink/10">
        <button
          type="button"
          className="group block w-full"
          onClick={() => setLightbox(true)}
          aria-label="Open gallery"
        >
          <MediaFrame
            item={current}
            eager
            className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        </button>

        {current.alt ? (
          <p className="absolute bottom-12 left-4 right-4 rounded-[var(--radius-md)] bg-black/55 px-3 py-2 text-[length:var(--text-sm)] leading-snug text-white backdrop-blur">
            {current.alt}
          </p>
        ) : null}

        {total > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
            >
              ›
            </button>
            <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[length:var(--text-xs)] font-medium text-white backdrop-blur">
              {index + 1} / {total}
            </div>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {thumbs.map((img, i) => {
              const active = i === index;
              const shouldLoad = loadedThumbs.has(i) || active || i < 8;
              return (
                <button
                  key={`${img.src}-${i}`}
                  ref={i === thumbs.length - 1 ? thumbEndRef : undefined}
                  type="button"
                  onClick={() => {
                    setIndex(i);
                    markThumbLoaded(i);
                  }}
                  onMouseEnter={() => markThumbLoaded(i)}
                  onFocus={() => markThumbLoaded(i)}
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border-2 bg-mist transition sm:h-16 sm:w-24 ${
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
            className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1 text-sm text-white"
            onClick={() => setLightbox(false)}
          >
            ✕
          </button>
          {total > 1 ? (
            <button
              type="button"
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/15 px-3 py-2 text-2xl text-white"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
            >
              ‹
            </button>
          ) : null}
          <div
            className="max-h-[85vh] max-w-[92vw]"
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
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/15 px-3 py-2 text-2xl text-white"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
            >
              ›
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
