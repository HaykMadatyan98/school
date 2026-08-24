import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import {
  Manrope,
  Noto_Sans_Armenian,
  Noto_Serif_Armenian,
} from "next/font/google";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing, type AppLocale } from "@/i18n/routing";
import { LocaleProvider } from "@/components/locale-provider";
import { MenuProvider } from "@/components/menu-provider";
import { getPublicMenu } from "@/lib/public-data";
import { getSiteUrl } from "@/lib/site";
import "../globals.css";

const display = Noto_Serif_Armenian({
  variable: "--font-display",
  subsets: ["armenian", "latin", "latin-ext"],
  display: "swap",
  weight: ["500", "600", "700"],
});

const armenianSans = Noto_Sans_Armenian({
  variable: "--font-armenian",
  subsets: ["armenian"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const latinSans = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: paramLocale } = await params;
  const locale = hasLocale(routing.locales, paramLocale)
    ? paramLocale
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "meta" });
  const siteUrl = getSiteUrl();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t("homeTitle"),
      template: `%s · ${t("homeTitle")}`,
    },
    description: t("homeDescription"),
    openGraph: {
      type: "website",
      locale,
      siteName: t("homeTitle"),
      title: t("homeTitle"),
      description: t("homeDescription"),
      url: siteUrl,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: paramLocale } = await params;
  if (!hasLocale(routing.locales, paramLocale)) {
    notFound();
  }

  const locale = paramLocale as AppLocale;
  setRequestLocale(locale);
  const [messages, menu] = await Promise.all([getMessages(), getPublicMenu()]);

  const bodyStyle = {
    ["--font-body"]: "var(--font-armenian), var(--font-manrope)",
  } as CSSProperties;

  return (
    <html lang={locale}>
      <body
        className={`${display.variable} ${armenianSans.variable} ${latinSans.variable} antialiased`}
        style={bodyStyle}
      >
        <LocaleProvider initialLocale={locale} initialMessages={messages}>
          <MenuProvider initialMenu={menu}>{children}</MenuProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
