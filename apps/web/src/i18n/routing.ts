import { defineRouting } from "next-intl/routing";

export const locales = ["am"] as const;
export type AppLocale = (typeof locales)[number];

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const routing = defineRouting({
  locales,
  defaultLocale: "am",
  localePrefix: "never",
  localeDetection: false,
});
