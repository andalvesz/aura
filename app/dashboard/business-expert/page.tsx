import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { BusinessExpertClient } from "@/components/dashboard/business-expert/business-expert-client";
import { getDataContext } from "@/lib/supabase/services/context";

export default async function BusinessExpertPage() {
  let userId = "local";
  try {
    const ctx = await getDataContext();
    userId = ctx.userId;
  } catch {
    // local / unauthenticated fallback for foundation render
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 md:p-6">
      <PageBreadcrumb
        items={[
          { label: "Aura", href: "/dashboard" },
          { label: "Business Expert" },
        ]}
      />
      <BusinessExpertClient userId={userId} />
    </div>
  );
}
