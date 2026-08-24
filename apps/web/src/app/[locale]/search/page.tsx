import { setRequestLocale } from "next-intl/server";
import { SearchView } from "@/components/search-view";
import { getPublishedPages } from "@/lib/public-data";

export default async function SearchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const pages = await getPublishedPages();
  return <SearchView pages={pages} />;
}
