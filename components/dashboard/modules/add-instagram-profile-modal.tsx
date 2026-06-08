"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import type { GrowthProfile, InstagramMarca } from "@/types/database";
import { INSTAGRAM_MARCAS } from "@/utils/instagram";
import { parseJsonResponse } from "@/utils/safe-json";

type AddInstagramProfileModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialMarca?: InstagramMarca;
  profile?: GrowthProfile | null;
};

export function AddInstagramProfileModal({
  open,
  onClose,
  onSaved,
  initialMarca = "marca_pessoal",
  profile = null,
}: AddInstagramProfileModalProps) {
  const [pending, setPending] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [marca, setMarca] = useState<InstagramMarca>(initialMarca);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [nicho, setNicho] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [frequencia, setFrequencia] = useState("");
  const isEdit = Boolean(profile);

  useEffect(() => {
    if (!open) return;
    setMarca(profile?.marca ?? initialMarca);
    setUsername(profile?.username ?? "");
    setBio(profile?.bio ?? profile?.observacoes ?? "");
    setNicho(profile?.nicho ?? "");
    setObjetivo(profile?.objetivo ?? "");
    setFrequencia(profile?.frequencia_conteudo ?? "");
  }, [open, profile, initialMarca]);

  const brand = INSTAGRAM_MARCAS.find((m) => m.id === marca);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username")).trim();
    if (!username) {
      toast.error("Informe o @ do perfil.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/social-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marca,
          username,
          bio: String(fd.get("bio") ?? ""),
          nicho: String(fd.get("nicho") ?? ""),
          objetivo: String(fd.get("objetivo") ?? ""),
          frequencia_conteudo: String(fd.get("frequencia") ?? ""),
        }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        analysis?: { summary?: string };
        warning?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        toast.error(data?.error ?? parseError ?? "Erro ao salvar perfil.");
        return;
      }

      if (data?.warning) {
        toast.warning(`Perfil salvo, mas a análise falhou: ${data.warning}`);
      } else {
        toast.success(isEdit ? "Perfil atualizado e reanalisado." : "Perfil analisado e salvo.");
      }
      onSaved();
      onClose();
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setPending(false);
    }
  }

  async function handleReanalyze() {
    if (!profile?.id) return;
    setReanalyzing(true);
    try {
      const res = await fetch("/api/social-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        analysis?: { summary?: string };
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        toast.error(data?.error ?? parseError ?? "Erro ao reanalisar perfil.");
        return;
      }

      toast.success("Perfil reanalisado pela Aura.");
      onSaved();
      onClose();
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setReanalyzing(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar perfil Instagram" : "Cadastrar perfil Instagram"}
      description={brand?.description}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-[12px] text-zinc-500">
          Marca
          <select
            value={marca}
            onChange={(e) => setMarca(e.target.value as InstagramMarca)}
            disabled={isEdit}
            className="mt-1 w-full rounded-md border border-white/[0.08] bg-zinc-950 px-3 py-2 text-[13px] text-zinc-200 disabled:opacity-60"
          >
            {INSTAGRAM_MARCAS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <p className="text-[11px] text-zinc-600">
          Temas: {brand?.themes.join(" · ")}
        </p>

        <Field
          label="@ Username"
          name="username"
          placeholder="and.alvesz"
          value={username}
          onChange={setUsername}
          required
        />
        <Field
          label="Bio"
          name="bio"
          placeholder="Texto da bio do Instagram"
          value={bio}
          onChange={setBio}
        />
        <Field
          label="Nicho"
          name="nicho"
          placeholder={brand?.themes[0]}
          value={nicho}
          onChange={setNicho}
        />
        <Field
          label="Objetivo"
          name="objetivo"
          placeholder="Autoridade, leads, vendas..."
          value={objetivo}
          onChange={setObjetivo}
        />
        <Field
          label="Frequência de conteúdo"
          name="frequencia"
          placeholder="Ex: 4 Reels + 7 Stories por semana"
          value={frequencia}
          onChange={setFrequencia}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={pending || reanalyzing}
            className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-pink-600 text-[13px] font-medium text-white hover:bg-pink-500 disabled:opacity-50"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Salvar e reanalisar" : "Cadastrar e analisar"}
          </button>
          {isEdit && (
            <button
              type="button"
              disabled={pending || reanalyzing}
              onClick={() => void handleReanalyze()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-pink-500/25 bg-pink-500/10 px-3 text-[13px] text-pink-200 hover:bg-pink-500/15 disabled:opacity-50"
            >
              {reanalyzing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Re-analisar IA
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  name,
  placeholder,
  value,
  onChange,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-[12px] text-zinc-500">
      {label}
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-white/[0.08] bg-zinc-950 px-3 py-2 text-[13px] text-zinc-200"
      />
    </label>
  );
}
