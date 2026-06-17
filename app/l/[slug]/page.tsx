import { notFound } from "next/navigation";
import { LandingPagePublic } from "@/components/landing-page/landing-page-public";
import { getLandingPageBySlug } from "@/lib/supabase/services/landing-factory.service";

type PageProps = { params: Promise<{ slug: string }> };

export default async function PublicLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const { page } = await getLandingPageBySlug(slug, { publicOnly: true });

  if (!page || page.status !== "published") {
    notFound();
  }

  return <LandingPagePublic page={page} />;
}
