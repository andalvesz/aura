import { AuraChat } from "@/components/dashboard/aura-chat";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">
          Aura OS
        </h1>

        <p className="text-sm text-zinc-500">
          Sistema operacional pessoal de Anderson Alves.
        </p>
      </div>

      <AuraChat />
    </div>
  );
}