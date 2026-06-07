import { cn } from "@/utils/cn";
import { Panel, PanelContent } from "./panel";

type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  hintClassName?: string;
  className?: string;
};

export function MetricCard({
  label,
  value,
  hint,
  hintClassName,
  className,
}: MetricCardProps) {
  return (
    <Panel
      className={cn(
        "transition-colors duration-200 hover:border-white/[0.1] hover:bg-zinc-900/60",
        className
      )}
    >
      <PanelContent className="py-3 sm:py-2.5">
        <p className="text-[11px] font-medium text-zinc-500">{label}</p>
        <p className="mt-1 break-words text-base font-semibold tracking-tight text-zinc-100 sm:text-lg">
          {value}
        </p>
        {hint && (
          <p
            className={cn(
              "mt-0.5 line-clamp-2 break-words text-[11px] text-zinc-600",
              hintClassName
            )}
          >
            {hint}
          </p>
        )}
      </PanelContent>
    </Panel>
  );
}
