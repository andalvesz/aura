import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ErrorInboxClient } from "@/components/dashboard/beta-ops/error-inbox-client";
import { listErrorGroups, sanitizeErrorGroupForUi } from "@/lib/beta-ops";
import {
  canAccessAdminPlatform,
  getAdminAllowlistFromEnv,
} from "@/lib/capabilities/permissions";

export default async function AdminErrorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const allowed = canAccessAdminPlatform({
    userId: user.id,
    allowedUserIds: getAdminAllowlistFromEnv(),
  });
  if (!allowed) {
    return <ErrorInboxClient initial={[]} denied />;
  }
  return (
    <ErrorInboxClient initial={listErrorGroups().map(sanitizeErrorGroupForUi)} />
  );
}
