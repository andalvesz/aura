"use client";

import { Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import type { GrowthProfile, InstagramMarca } from "@/types/database";
import {
  getProfileForMarca,
  INSTAGRAM_MARCAS,
  MARCA_LABELS,
  parseProfileAnalysis,
} from "@/utils/instagram";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { AddInstagramProfileModal } from "./add-instagram-profile-modal";

type InstagramProfilesPanelProps = {
  profiles: GrowthProfile[];
  activeMarca: InstagramMarca;
  onMarcaChange: (marca: InstagramMarca) => void;
  onRefresh: () => void;
};

export function InstagramProfilesPanel({
  profiles,
  activeMarca,
  onMarcaChange,
  onRefresh,
}: InstagramProfilesPanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMarca, setModalMarca] = useState<InstagramMarca>("marca_pessoal");

  const activeProfile = getProfileForMarca(profiles, activeMarca);
  const modalProfile = getProfileForMarca(profiles, modalMarca);
  const analysis = activeProfile?.analise
    ? parseProfileAnalysis(activeProfile.analise)
    : null;

  function openForMarca(marca: InstagramMarca) {
    setModalMarca(marca);
    setModalOpen(true);
  }

  return (
    <>
      <Panel className="border-pink-500/10 bg-pink-500/[0.03]">
        <PanelHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-pink-400" />
            Instagram Inteligente
          </PanelTitle>
          <button
            type="button"
            onClick={() => openForMarca(activeMarca)}
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-pink-500/25 bg-pink-500/10 px-2.5 text-[11px] text-pink-200"
          >
            <Plus className="size-3.5" />
            {activeProfile ? "Editar perfil" : "Cadastrar perfil"}
          </button>
        </PanelHeader>
        <PanelContent className="space-y-3 pt-0">
          <div className="flex flex-wrap gap-1">
            {INSTAGRAM_MARCAS.map((m) => {
              const hasProfile = Boolean(getProfileForMarca(profiles, m.id));
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onMarcaChange(m.id)}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] transition-colors ${
                    activeMarca === m.id
                      ? "bg-pink-500/20 text-pink-200"
                      : "text-zinc-500 hover:bg-white/[0.04]"
                  }`}
                >
                  {m.label}
                  {!hasProfile && (
                    <span className="ml-1 text-zinc-600">+</span>
                  )}
                </button>
              );
            })}
          </div>

          {activeProfile ? (
            <div className="rounded-md border border-white/[0.06] bg-zinc-950/40 p-3 text-[12px]">
              <p className="font-medium text-zinc-200">
                @{activeProfile.username} · {MARCA_LABELS[activeMarca]}
              </p>
              {(activeProfile.bio ?? activeProfile.observacoes) && (
                <p className="mt-1 text-zinc-400">
                  {activeProfile.bio ?? activeProfile.observacoes}
                </p>
              )}
              <div className="mt-2 grid gap-1 text-[11px] text-zinc-500 sm:grid-cols-2">
                <span>Nicho: {activeProfile.nicho ?? "—"}</span>
                <span>Objetivo: {activeProfile.objetivo ?? "—"}</span>
                <span className="sm:col-span-2">
                  Frequência: {activeProfile.frequencia_conteudo ?? "—"}
                </span>
              </div>
              {analysis && (
                <div className="mt-3 border-t border-white/[0.06] pt-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-pink-400/80">
                    Análise da Aura
                  </p>
                  <p className="mt-1 text-zinc-400">{analysis.summary}</p>
                  {analysis.contentIdeas.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-[11px] text-zinc-500">
                      {analysis.contentIdeas.slice(0, 3).map((idea) => (
                        <li key={idea}>· {idea}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-zinc-500">
              Cadastre o perfil de {MARCA_LABELS[activeMarca]} para análise de bio, nicho,
              objetivo e frequência.
            </p>
          )}
        </PanelContent>
      </Panel>

      <AddInstagramProfileModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={onRefresh}
        initialMarca={modalMarca}
        profile={modalProfile}
      />
    </>
  );
}
