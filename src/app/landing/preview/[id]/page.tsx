import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingBuilderRenderer } from "@/components/landing-builder-renderer";
import { getLandingPage } from "@/server/landing-pages";
import { DomainError } from "@/server/http";
import { protectPage } from "@/server/page-access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pratinjau landing page | KulinerKit", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const denied = await protectPage("admin");
  if (denied) return denied;
  try { return <LandingBuilderRenderer page={await getLandingPage((await params).id)} preview/>; }
  catch (error) { if (error instanceof DomainError && error.status === 404) notFound(); throw error; }
}
