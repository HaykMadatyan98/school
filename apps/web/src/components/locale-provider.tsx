"use client";

import { createContext, useContext, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import type { AppLocale } from "@/i18n/routing";

type Messages = Record<string, unknown>;

type LocaleContextValue = {
  locale: AppLocale;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale,
  initialMessages,
}: {
  children: ReactNode;
  initialLocale: AppLocale;
  initialMessages: Messages;
}) {
  return (
    <LocaleContext.Provider value={{ locale: initialLocale }}>
      <NextIntlClientProvider locale={initialLocale} messages={initialMessages}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

export function useAppLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useAppLocale must be used within LocaleProvider");
  }
  return ctx;
}
