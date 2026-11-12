import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import {
  formatShortcut,
  getSidePanelTabShortcutLabel,
  SIDE_PANEL_TAB_SHORTCUT_SLOT_COUNT,
} from "../../../contracts/ipc";
import { toolRefId, type TaskWorkbenchTemplate, type ToolRef } from "../../../contracts/workbench";
import type { DesktopExtensionViewInfo } from "../../../contracts/extension-views";
import { useTranslation, type Translate } from "../../i18n";
import { CloseIcon, ExtensionIcon, PlusIcon, SidePanelIcon } from "../../ui/icons";
import {
  BUILTIN_TOOL_ENTRIES,
  BUILTIN_TOOLS,
  builtinToolDescription,
  builtinToolLabel,
} from "./builtin-tools";
import { WorkbenchResizeHandle } from "./workbench-resize-handle";
import { activeWorkbenchTool } from "./workbench-state";

interface WorkbenchProps {
  readonly view: TaskWorkbenchTemplate;
  readonly platform: NodeJS.Platform;
  /** Whether the side panel tab modifier is held, so tabs show their numbers. */
  readonly tabHintsVisible: boolean;
  readonly onResize: (width: number) => void;
  readonly onTogglePanel: () => void;
  readonly onOpenTool: (tool: ToolRef) => void;
  readonly onActivateTool: (toolId: string) => void;
  readonly onCloseTool: (toolId: string) => void;
  readonly onShowChooser: () => void;
  readonly children?: ReactNode;
  readonly error?: string;
  readonly loading?: boolean;
  readonly onRetryRestore?: () => void;
  readonly extensionViews?: readonly DesktopExtensionViewInfo[];
  readonly extensionViewsLoading?: boolean;
  readonly extensionViewsError?: string;
  readonly onReloadExtensionViews?: () => void;
}

export function workbenchToolLabel(tool: ToolRef, t?: Translate): string {
  return tool.kind === "extension" ? tool.viewId : builtinToolLabel(tool.kind, t);
}

function ToolIcon({ tool }: { readonly tool: ToolRef }) {
  if (tool.kind === "extension") return <ExtensionIcon />;
  const { Icon } = BUILTIN_TOOLS[tool.kind];
  return <Icon />;
}

export function Workbench({
  view,
  platform,
  tabHintsVisible,
  onResize,
  onTogglePanel,
  onOpenTool,
  onActivateTool,
  onCloseTool,
  onShowChooser,
  children,
  error,
  loading = false,
  onRetryRestore,
  extensionViews = [],
  extensionViewsLoading = false,
  extensionViewsError = "",
  onReloadExtensionViews,
}: WorkbenchProps) {
  const { t } = useTranslation();
  const panelId = useId();
  const addRef = useRef<HTMLButtonElement | null>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const activeTool = activeWorkbenchTool(view);
  const activeExtension =
    activeTool?.kind === "extension"
      ? extensionViews.find(
          (entry) => entry.extensionId === activeTool.extensionId && entry.id === activeTool.viewId,
        )
      : undefined;
  useEffect(() => {
    if (view.visibility === "visible" && view.selection.kind === "tool") {
      tabRefs.current
        .get(view.selection.toolId)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [view.selection, view.visibility]);

  const tabId = (toolId: string) => `${panelId}-${encodeURIComponent(toolId)}`;

  const closeAndFocus = (toolId: string) => {
    const index = view.tools.findIndex((tool) => toolRefId(tool) === toolId);
    const remaining = view.tools.filter((tool) => toolRefId(tool) !== toolId);
    const neighbor = remaining[Math.min(index, remaining.length - 1)];
    const active = view.selection;
    const nextId =
      active.kind === "tool" && active.toolId !== toolId
        ? active.toolId
        : neighbor
          ? toolRefId(neighbor)
          : undefined;
    onCloseTool(toolId);
    window.requestAnimationFrame(() => {
      if (nextId) tabRefs.current.get(nextId)?.focus();
      else addRef.current?.focus();
    });
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, toolId: string) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      closeAndFocus(toolId);
      return;
    }
    const index = view.tools.findIndex((tool) => toolRefId(tool) === toolId);
    const nextIndex =
      event.key === "ArrowRight"
        ? (index + 1) % view.tools.length
        : event.key === "ArrowLeft"
          ? (index - 1 + view.tools.length) % view.tools.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? view.tools.length - 1
              : undefined;
    if (nextIndex === undefined) return;
    event.preventDefault();
    const nextTool = view.tools[nextIndex];
    if (!nextTool) return;
    const nextId = toolRefId(nextTool);
    onActivateTool(nextId);
    tabRefs.current.get(nextId)?.focus();
  };

  if (view.visibility === "hidden") return null;

  return (
    <aside
      aria-label={t("workbench.panel.sideWorkspace")}
      className="workbench side-panel"
      data-testid="workbench"
      id="task-workbench"
    >
      <WorkbenchResizeHandle onResize={onResize} />
      <div className="workbench__tabbar">
        <div aria-label={t("workbench.panel.tools")} className="workbench__tabs" role="tablist">
          {view.tools.map((tool, index) => {
            const toolId = toolRefId(tool);
            const label =
              tool.kind === "extension"
                ? (extensionViews.find(
                    (entry) => entry.extensionId === tool.extensionId && entry.id === tool.viewId,
                  )?.title ?? workbenchToolLabel(tool, t))
                : workbenchToolLabel(tool, t);
            const selected = view.selection.kind === "tool" && view.selection.toolId === toolId;
            const slot = index < SIDE_PANEL_TAB_SHORTCUT_SLOT_COUNT ? index + 1 : undefined;
            const shortcut = slot ? getSidePanelTabShortcutLabel(platform, slot) : undefined;
            return (
              <div className="workbench__tab-wrapper" key={toolId} role="presentation">
                <button
                  aria-controls={panelId}
                  aria-keyshortcuts={
                    slot ? `${platform === "darwin" ? "Control" : "Alt"}+${slot}` : undefined
                  }
                  aria-label={label}
                  aria-selected={selected}
                  className={`workbench__tab${selected ? " workbench__tab--active" : ""}`}
                  data-tab-shortcut={tabHintsVisible && slot ? String(slot) : undefined}
                  data-testid={`workbench-tab-${toolId}`}
                  disabled={loading}
                  id={tabId(toolId)}
                  onClick={() => onActivateTool(toolId)}
                  onKeyDown={(event) => onTabKeyDown(event, toolId)}
                  ref={(button) => {
                    if (button) tabRefs.current.set(toolId, button);
                    else tabRefs.current.delete(toolId);
                  }}
                  role="tab"
                  tabIndex={selected || (view.selection.kind === "chooser" && index === 0) ? 0 : -1}
                  title={shortcut ? `${label} (${shortcut})` : label}
                  type="button"
                >
                  {tabHintsVisible && shortcut ? (
                    <span className="workbench__tab-shortcut" aria-hidden="true">
                      {shortcut}
                    </span>
                  ) : (
                    <ToolIcon tool={tool} />
                  )}
                  <span>{label}</span>
                </button>
                <button
                  aria-label={t("workbench.panel.closeTab", { name: label })}
                  className="workbench__tab-close icon-button"
                  disabled={loading}
                  onClick={() => closeAndFocus(toolId)}
                  tabIndex={-1}
                  title={t("workbench.panel.closeTab", { name: label })}
                  type="button"
                >
                  <CloseIcon />
                </button>
              </div>
            );
          })}
        </div>
        <button
          aria-keyshortcuts={`${platform === "darwin" ? "Meta" : "Control"}+T`}
          aria-label={t("workbench.panel.addTab")}
          className="workbench__add icon-button"
          data-testid="workbench-add-tab"
          disabled={loading}
          onClick={onShowChooser}
          ref={addRef}
          title={t("workbench.panel.addTabShortcut", {
            shortcut: formatShortcut(platform, "T"),
          })}
          type="button"
        >
          <PlusIcon />
        </button>
        <button
          aria-label={t("workbench.panel.toggle")}
          aria-pressed="true"
          aria-controls="task-workbench"
          data-testid="toggle-side-panel"
          className="workbench__add icon-button"
          onClick={onTogglePanel}
          title={t("workbench.panel.hide")}
          type="button"
        >
          <SidePanelIcon />
        </button>
      </div>
      {error ? (
        <div className="workbench__error" role="status">
          <p>{error}</p>
          {loading && onRetryRestore ? (
            <button className="button" onClick={onRetryRestore} type="button">
              {t("workbench.panel.retryRestore")}
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        aria-labelledby={activeTool ? tabId(toolRefId(activeTool)) : undefined}
        className="workbench__content"
        id={panelId}
        role={activeTool ? "tabpanel" : undefined}
      >
        {loading ? (
          <p className="workbench__loading" role="status">
            {error ? t("workbench.panel.savedUnavailable") : t("workbench.panel.restoring")}
          </p>
        ) : view.selection.kind === "chooser" ? (
          <div className="workbench__chooser" data-testid="workbench-chooser">
            <h2>{t("workbench.panel.openTool")}</h2>
            <p>{t("workbench.panel.openToolHint")}</p>
            {BUILTIN_TOOL_ENTRIES.map(({ kind, Icon, shortcutKey }) => {
              const label = builtinToolLabel(kind, t);
              const description = builtinToolDescription(kind, t);
              return (
                <button
                  aria-keyshortcuts={
                    shortcutKey
                      ? `${platform === "darwin" ? "Meta" : "Control"}+${shortcutKey}`
                      : undefined
                  }
                  aria-label={label}
                  className="workbench__choice"
                  key={kind}
                  onClick={() => onOpenTool({ kind })}
                  type="button"
                >
                  <span className="workbench__choice-icon">
                    <Icon />
                  </span>
                  <span className="workbench__choice-copy">
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </span>
                  {shortcutKey ? (
                    <kbd className="workbench__choice-shortcut">
                      {formatShortcut(platform, shortcutKey)}
                    </kbd>
                  ) : null}
                </button>
              );
            })}
            <h3 className="workbench__extension-heading">{t("workbench.panel.extensionViews")}</h3>
            {extensionViewsLoading ? (
              <p role="status">{t("workbench.panel.loadingExtensionViews")}</p>
            ) : null}
            {extensionViewsError ? (
              <div role="status">
                <p>{extensionViewsError}</p>
                {onReloadExtensionViews ? (
                  <button className="button" type="button" onClick={onReloadExtensionViews}>
                    {t("workbench.panel.refreshViews")}
                  </button>
                ) : null}
              </div>
            ) : null}
            {extensionViews.map((extension) => (
              <button
                aria-label={extension.title}
                className="workbench__choice"
                key={toolRefId({
                  kind: "extension",
                  extensionId: extension.extensionId,
                  viewId: extension.id,
                })}
                onClick={() =>
                  onOpenTool({
                    kind: "extension",
                    extensionId: extension.extensionId,
                    viewId: extension.id,
                  })
                }
                type="button"
              >
                <span className="workbench__choice-icon">
                  <ExtensionIcon />
                </span>
                <span className="workbench__choice-copy">
                  <strong>{extension.title}</strong>
                  {extension.state === "error" ? (
                    <span>{extension.error ?? t("workbench.panel.viewUnavailable")}</span>
                  ) : null}
                </span>
              </button>
            ))}
            {!extensionViewsLoading && !extensionViewsError && extensionViews.length === 0 ? (
              <p>{t("workbench.panel.extensionsCanProvideViews")}</p>
            ) : null}
          </div>
        ) : activeTool?.kind === "extension" && activeExtension?.state !== "ready" ? (
          <div className="workbench__unavailable" role="status">
            <ExtensionIcon />
            <h2>
              {extensionViewsLoading
                ? t("workbench.panel.findingView")
                : t("workbench.panel.viewUnavailableTitle")}
            </h2>
            <p>
              {activeExtension?.error || extensionViewsError || t("workbench.panel.viewRetained")}
            </p>
            {!extensionViewsLoading && onReloadExtensionViews ? (
              <button className="button" type="button" onClick={onReloadExtensionViews}>
                {t("workbench.panel.refreshViews")}
              </button>
            ) : null}
            <button
              className="button"
              onClick={() => closeAndFocus(toolRefId(activeTool))}
              type="button"
            >
              {t("workbench.panel.closeTabButton")}
            </button>
          </div>
        ) : (
          children
        )}
      </div>
    </aside>
  );
}
