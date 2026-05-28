import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
        <Inbox className="size-4 text-zinc-600" />
      </div>
      <p className="text-[13px] font-medium text-zinc-300">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-[12px] text-zinc-600">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
