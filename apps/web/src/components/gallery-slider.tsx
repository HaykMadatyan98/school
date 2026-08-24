"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  images: { src: string; alt: string }[];
};

const INITIAL = 12;
const STEP = 24;

export function GallerySlider({ images }: Props) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [visibleThumbs, setVisibleThumbs] = useState(INITIAL);
  const total = images.length;
  const current = images[index] ?? images[0];

  const thumbs = useMemo(
    () => images.slice(0, Math.min(visibleThumbs, total)),
    [images, visibleThumbs, total],
  );

  const go = useCallback(
    (dir: -1 | 1) => {
      setIndex((i) => {
        const next = (i + dir + total) % total;
        // Ensure thumb strip grows when navigating beyond loaded thumbs
        setVisibleThumbs((v) => Math.max(v, Math.min(total, next + 1)));
        return next;
      });
    },
    [total],
  );

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

  // Prefetch neighbors
  useEffect(() => {
    if (!total) return;
    for (const offset of [-1, 1, 2]) {
      const img = images[(index + offset + total) % total];
      if (!img) continue;
      const el = new Image();
      el.src = img.src;
    }
  }, [index, images, total]);

  if (!total) return null;

  if (total === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={current.src}
        alt={current.alt}
        className="my-8 w-full rounded-2xl object-cover shadow-sm"
        loading="lazy"
      />
    );
  }

  return (
    <div className="my-8 md:my-10">
      <div className="relative overflow-hidden rounded-[var(--radius-xl)] bg-ink shadow-lg shadow-ink/10">
        <button
          type="button"
          className="group block w-full"
          onClick={() => setLightbox(true)}
          aria-label="Open gallery"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={current.src}
            src={current.src}
            alt={current.alt}
            className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        </button>

        {current.alt ? (
          <p className="absolute bottom-12 left-4 right-4 rounded-[var(--radius-md)] bg-black/55 px-3 py-2 text-[length:var(--text-sm)] leading-snug text-white backdrop-blur">
            {current.alt}
          </p>
        ) : null}

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
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {thumbs.map((img, i) => (
          <button
            key={`${img.src}-${i}`}
            type="button"
            onClick={() => setIndex(i)}
            className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border-2 transition sm:h-16 sm:w-24 ${
              i === index
                ? "border-accent"
                : "border-transparent opacity-70 hover:opacity-100"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      {visibleThumbs < total && (
        <button
          type="button"
          onClick={() =>
            setVisibleThumbs((v) => Math.min(total, v + STEP))
          }
          className="mt-3 text-[length:var(--text-sm)] font-semibold text-accent-deep hover:underline"
        >
          Ցույց տալ ևս {Math.min(STEP, total - visibleThumbs)} լուսանկար (
          {visibleThumbs}/{total})
        </button>
      )}

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.src}
            alt={current.alt}
            className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
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
