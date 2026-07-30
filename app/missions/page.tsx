import { redirect } from "next/navigation";

/** Canonical missions UI lives under the dashboard shell. */
export default function MissionsAliasPage() {
  redirect("/dashboard/missions");
}
