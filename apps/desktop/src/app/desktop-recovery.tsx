import { Component, Fragment, type ReactNode } from "react";
import { useTranslation, type Translate } from "../i18n";
import { translate } from "../i18n/translate";
import type { DesktopAppView, StateHydrationFailure } from "./desktop-app-state";

export type DesktopStartupSurfaceState =
  | { readonly kind: "loading" }
  | {
      readonly kind: "failed";
      readonly failure: StateHydrationFailure;
      readonly retrying: boolean;
    }
  | { readonly kind: "crashed" };

export interface DesktopStartupCopy {
  readonly title: string;
  readonly body: string;
  readonly status: "loading" | "failed" | "crashed";
}

function loadingCopy(t: Translate): DesktopStartupCopy {
  return {
    title: t("shell.loadingTitle"),
    body: t("shell.loadingBody"),
    status: "loading",
  };
}

function stateFailedCopy(t: Translate): DesktopStartupCopy {
  return {
    title: t("shell.restoreFailedTitle"),
    body: t("shell.restoreFailedBody"),
    status: "failed",
  };
}

function bridgeFailedCopy(t: Translate): DesktopStartupCopy {
  return {
    title: t("shell.restoreFailedTitle"),
    body: t("shell.bridgeFailedBody"),
    status: "failed",
  };
}

function crashedCopy(t: Translate): DesktopStartupCopy {
  return {
    title: t("shell.crashedTitle"),
    body: t("shell.crashedBody"),
    status: "crashed",
  };
}

export function startupSurfaceCopy(
  state: DesktopStartupSurfaceState,
  t: Translate = translate,
): DesktopStartupCopy {
  if (state.kind === "loading") {
    return loadingCopy(t);
  }
  if (state.kind === "crashed") {
    return crashedCopy(t);
  }
  if (state.failure.code === "bridge-unavailable") {
    return bridgeFailedCopy(t);
  }
  return stateFailedCopy(t);
}

export function rendererBoundaryCopy(t: Translate = translate): DesktopStartupCopy {
  return crashedCopy(t);
}

interface DesktopStartupSurfaceProps {
  readonly state: DesktopStartupSurfaceState;
  readonly onRetry: () => void;
  readonly onRelaunch?: () => void;
}

export function DesktopStartupSurface({ state, onRetry, onRelaunch }: DesktopStartupSurfaceProps) {
  const { t } = useTranslation();
  const copy = startupSurfaceCopy(state, t);
  const retrying = state.kind === "failed" ? state.retrying : false;
  const showActions = copy.status !== "loading";
  const showRelaunch =
    Boolean(onRelaunch) &&
    (state.kind === "crashed" ||
      (state.kind === "failed" && state.failure.code !== "bridge-unavailable"));

  return (
    <div className="shell shell--loading">
      <main
        className="loading-card"
        data-testid="shell-status-card"
        data-status={copy.status}
        data-retrying={retrying ? "true" : "false"}
        data-failure={state.kind === "failed" ? state.failure.code : undefined}
      >
        <div className="loading-card__eyebrow">pi-gui</div>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        {showActions ? (
          <div className="loading-card__actions">
            <button
              className="button button--primary"
              data-testid="hydrate-retry"
              type="button"
              disabled={retrying}
              onClick={onRetry}
            >
              {retrying ? t("shell.retrying") : t("shell.retry")}
            </button>
            {showRelaunch ? (
              <button
                className="button button--ghost"
                data-testid="hydrate-relaunch"
                type="button"
                onClick={onRelaunch}
              >
                {t("shell.relaunch")}
              </button>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}

interface RendererErrorBoundaryProps {
  readonly children: ReactNode;
  readonly onRelaunch?: () => void;
}

interface RendererErrorBoundaryState {
  readonly hasError: boolean;
  readonly remountKey: number;
}

export class RendererErrorBoundary extends Component<
  RendererErrorBoundaryProps,
  RendererErrorBoundaryState
> {
  state: RendererErrorBoundaryState = { hasError: false, remountKey: 0 };

  static getDerivedStateFromError(): Pick<RendererErrorBoundaryState, "hasError"> {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("[renderer] render tree failed", error);
  }

  private readonly handleRetry = (): void => {
    this.setState((current) => ({
      hasError: false,
      remountKey: current.remountKey + 1,
    }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <DesktopStartupSurface
          state={{ kind: "crashed" }}
          onRetry={this.handleRetry}
          onRelaunch={this.props.onRelaunch}
        />
      );
    }
    return <Fragment key={this.state.remountKey}>{this.props.children}</Fragment>;
  }
}

export function toStartupSurfaceState(view: DesktopAppView): DesktopStartupSurfaceState {
  if (view.kind === "failed") {
    return view;
  }
  return { kind: "loading" };
}
