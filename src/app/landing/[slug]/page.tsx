import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingBuilderRenderer } from "@/components/landing-builder-renderer";
import { MetaPageEvent } from "@/components/meta-page-event";
import { getPublishedLandingPage } from "@/server/landing-pages";
import { getCheckoutSettings } from "@/server/checkout";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getPublishedLandingPage((await params).slug);
  if (!page) return { title: "Halaman tidak ditemukan", robots: { index: false } };
  return { title: page.title, description: page.seoDescription || undefined,
    alternates: { canonical: `/landing/${page.slug}` }, openGraph: { title: page.title, description: page.seoDescription || undefined, type: "website" } };
}

export default async function Page({ params }: Props) {
  const page = await getPublishedLandingPage((await params).slug);
  if (!page) notFound();
  const checkout = page.metaViewContentEnabled ? await getCheckoutSettings() : null;
  return <>{checkout && <MetaPageEvent name="ViewContent" price={Number(checkout.price)} pagePath={`/landing/${page.slug}`}/>}<LandingBuilderRenderer page={page}/></>;
}
