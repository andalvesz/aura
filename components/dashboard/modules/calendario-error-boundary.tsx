"use client";

import { Component, type ReactNode } from "react";
import { ActionButton } from "@/components/dashboard/action-button";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class CalendarioErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[CalendarioView]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-6 text-center">
          <p className="text-[13px] font-medium text-zinc-200">
            Não foi possível carregar o calendário. Tente novamente.
          </p>
          <p className="mt-1 text-[12px] text-zinc-500">
            Se o problema persistir, recarregue a página ou cadastre eventos pelo botão abaixo.
          </p>
          <ActionButton
            className="mt-4"
            onClick={() => this.setState({ hasError: false })}
          >
            Tentar novamente
          </ActionButton>
        </div>
      );
    }

    return this.props.children;
  }
}
