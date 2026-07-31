"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

/** Isolates a Home widget — failure does not crash the whole page. */
export class HomeWidgetBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="rounded-lg border border-white/[0.06] bg-zinc-950/40 px-3 py-2 text-[11px] text-zinc-500"
          data-testid="home-widget-error"
        >
          Widget indisponível{this.props.label ? `: ${this.props.label}` : ""}. O restante
          da Home continua utilizável.
        </div>
      );
    }
    return this.props.children;
  }
}
