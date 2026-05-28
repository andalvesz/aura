import { cn } from "@/utils/cn";

export type AvatarMember = {
  name: string;
  initials: string;
  className: string;
};

const defaultMembers: AvatarMember[] = [
  { name: "Ana Costa", initials: "AC", className: "bg-violet-500/90" },
  { name: "Bruno Lima", initials: "BL", className: "bg-sky-500/90" },
  { name: "Carla Dias", initials: "CD", className: "bg-emerald-500/90" },
  { name: "Diego Ruiz", initials: "DR", className: "bg-amber-500/90" },
  { name: "Elena Park", initials: "EP", className: "bg-rose-500/90" },
];

type AvatarStackProps = {
  members?: AvatarMember[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
};

export function AvatarStack({
  members = defaultMembers,
  max = 4,
  size = "sm",
  className,
}: AvatarStackProps) {
  const visible = members.slice(0, max);
  const overflow = members.length - max;
  const dim = size === "sm" ? "size-6 text-[10px]" : "size-7 text-[11px]";

  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex -space-x-2">
        {visible.map((member) => (
          <div
            key={member.name}
            title={member.name}
            className={cn(
              "flex items-center justify-center rounded-full border-2 border-zinc-950 font-medium text-white ring-0 transition-transform duration-200 ease-out hover:z-10 hover:scale-110",
              dim,
              member.className
            )}
          >
            {member.initials}
          </div>
        ))}
        {overflow > 0 && (
          <div
            className={cn(
              "flex items-center justify-center rounded-full border-2 border-zinc-950 bg-zinc-800 font-medium text-zinc-400",
              dim
            )}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
