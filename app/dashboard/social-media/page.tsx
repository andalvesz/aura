import { ModuleHeader } from "@/components/dashboard/module-header";
import { SocialMediaView } from "@/components/dashboard/modules/social-media-view";
import { getModule } from "@/lib/modules";
export default function SocialMediaPage() {
  const mod = getModule("social-media");
  return (
    <div className="space-y-3">
      <ModuleHeader module={mod} />
      <SocialMediaView />
    </div>
  );
}
