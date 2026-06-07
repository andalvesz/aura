"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import type { InstagramMarca } from "@/types/database";
import { INSTAGRAM_MARCAS } from "@/utils/instagram";
import { parseJsonResponse } from "@/utils/safe-json";

type AddInstagramProfileModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialMarca?: InstagramMarca;
};

export function AddInstagramProfileModal({
  open,
  onClose,
  onSaved,
  initialMarca = "marca_pessoal",
}: AddInstagramProfileModalProps) {
  const [pending, setPending] = useState(false);
  const [marca, setMarca] = useState<InstagramMarca>(initialMarca);

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
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        toast.error(data?.error ?? parseError ?? "Erro ao cadastrar perfil.");
        return;
      }

      toast.success("Perfil analisado e salvo pela Aura.");
      onSaved();
      onClose();
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cadastrar perfil Instagram"
      description={brand?.description}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-[12px] text-zinc-500">
          Marca
          <select
            value={marca}
            onChange={(e) => setMarca(e.target.value as InstagramMarca)}
            className="mt-1 w-full rounded-md border border-white/[0.08] bg-zinc-950 px-3 py-2 text-[13px] text-zinc-200"
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

        <Field label="@ Username" name="username" placeholder="and.alvesz" required />
        <Field label="Bio" name="bio" placeholder="Texto da bio do Instagram" />
        <Field label="Nicho" name="nicho" placeholder={brand?.themes[0]} />
        <Field label="Objetivo" name="objetivo" placeholder="Autoridade, leads, vendas..." />
        <Field
          label="Frequência de conteúdo"
          name="frequencia"
          placeholder="Ex: 4 Reels + 7 Stories por semana"
        />

        <button
          type="submit"
          disabled={pending}
          className="flex w-full min-h-10 items-center justify-center gap-2 rounded-md bg-pink-600 text-[13px] font-medium text-white hover:bg-pink-500 disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Cadastrar e analisar
        </button>
      </form>
    </Modal>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-[12px] text-zinc-500">
      {label}
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-white/[0.08] bg-zinc-950 px-3 py-2 text-[13px] text-zinc-200"
      />
    </label>
  );
}
