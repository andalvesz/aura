"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { MODULES } from "@/lib/modules";
import { Panel, PanelContent } from "./panel";

export function ModuleOverviewGrid() {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {MODULES.map((mod, i) => {
        const Icon = mod.icon;
        return (
          <motion.div
            key={mod.id}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link href={mod.href} className="block group">
              <Panel className="h-full transition-all duration-200 hover:border-white/[0.1] hover:bg-zinc-900/60">
                <PanelContent className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex size-8 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02]">
                      <Icon className={`size-3.5 ${mod.accent}`} />
                    </div>
                    <ArrowUpRight className="size-3.5 text-zinc-600 transition-colors duration-200 group-hover:text-zinc-400" />
                  </div>
                  <h3 className="mt-2 text-[13px] font-medium text-zinc-200">
                    {mod.shortLabel}
                  </h3>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-600">
                    {mod.description}
                  </p>
                  <div className="mt-3 border-t border-white/[0.06] pt-2">
                    <p className="text-[10px] text-zinc-600">{mod.overview.metric}</p>
                    <p className="text-[15px] font-semibold tracking-tight text-zinc-100">
                      {mod.overview.value}
                    </p>
                    <p className="text-[10px] text-zinc-500">{mod.overview.hint}</p>
                  </div>
                </PanelContent>
              </Panel>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
