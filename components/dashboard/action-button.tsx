import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  variant?: "primary" | "ghost";
};

export function ActionButton({
  className,
  icon,
  variant = "primary",
  children,
  ...props
}: ActionButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex min-h-11 items-center gap-1.5 rounded-md px-3 py-2.5 text-[13px] font-medium transition-colors duration-200 md:h-8 md:min-h-8 md:px-3 md:py-0 md:text-[12px]",
        variant === "primary" &&
          "border border-white/[0.08] bg-white/[0.04] text-zinc-200 hover:border-white/[0.12] hover:bg-white/[0.06]",
        variant === "ghost" &&
          "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300",
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
