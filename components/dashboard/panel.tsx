import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

type PanelProps = HTMLAttributes<HTMLDivElement>;

export function Panel({ className, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/[0.06] bg-zinc-900/40 text-zinc-100",
        className
      )}
      {...props}
    />
  );
}

export function PanelHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between px-3 pt-3", className)}
      {...props}
    />
  );
}

export function PanelTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-[13px] font-medium tracking-tight text-zinc-200",
        className
      )}
      {...props}
    />
  );
}

export function PanelContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-3 pb-3", className)} {...props} />;
}
