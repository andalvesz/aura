import { CapabilitiesSettingsClient } from "@/components/dashboard/settings/capabilities-settings-client";

export default function CapabilitiesSettingsPage() {
  return (
    <CapabilitiesSettingsClient
      userId="local"
      role="owner"
      workspaceId={null}
      workspaceSlug={null}
    />
  );
}
