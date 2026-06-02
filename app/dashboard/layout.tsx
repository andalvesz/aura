import { requireUser } from "@/lib/auth";
import { isDevelopmentEnv } from "@/lib/dev/is-development";
import { createClient } from "@/lib/supabase/server";
import { DashboardOffline } from "@/components/dashboard/dashboard-offline";
import { DashboardHeader } from "@/components/dashboard/header";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const fullName =
    profile?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    null;

  return (
    <div className="flex min-h-screen">
      <DashboardOffline />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          email={user.email ?? ""}
          fullName={fullName}
          showResetTestData={isDevelopmentEnv()}
        />
        <MobileNav />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 md:p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
