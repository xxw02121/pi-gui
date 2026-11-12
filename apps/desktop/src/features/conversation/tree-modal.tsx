import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type {
  NavigateSessionTreeOptions,
  SessionTreeNodeKind,
  SessionTreeNodeSnapshot,
  SessionTreeSnapshot,
} from "@pi-gui/session-driver/types";
import { useTranslation, type Translate } from "../../i18n";
import { trapDialogFocus } from "../../ui/dialog-focus";
import { ChevronDownIcon, ChevronRightIcon } from "../../ui/icons";

interface TreeModalProps {
  readonly tree?: SessionTreeSnapshot;
  readonly loading: boolean;
  readonly submitting: boolean;
  readonly error?: string;
  readonly onClose: () => void;
  readonly onNavigate: (targetId: string, options?: NavigateSessionTreeOptions) => void;
}

interface GutterInfo {
  readonly position: number;
  readonly show: boolean;
}

/** The modal's nested view of the flat snapshot; it never crosses the preload bridge. */
interface TreeNode extends SessionTreeNodeSnapshot {
  readonly children: readonly TreeNode[];
}

interface TreeRow {
  readonly node: TreeNode;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
  readonly displayIndent: number;
  readonly showConnector: boolean;
  readonly isLast: boolean;
  readonly isVirtualRootChild: boolean;
  readonly gutters: readonly GutterInfo[];
  readonly isOnActivePath: boolean;
}

type TreeSummaryMode = "none" | "summary" | "custom";

const DEFAULT_HIDDEN_KINDS: ReadonlySet<SessionTreeNodeKind> = new Set([
  "label",
  "custom",
  "model_change",
  "thinking_level_change",
  "session_info",
  "usage",
  "context_edit",
]);

export function TreeModal({
  tree,
  loading,
  submitting,
  error,
  onClose,
  onNavigate,
}: TreeModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"select" | "summary">("select");
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string>("");
  const [summaryMode, setSummaryMode] = useState<TreeSummaryMode>("none");
  const [customInstructions, setCustomInstructions] = useState("");
  const [autoScrollRequest, setAutoScrollRequest] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const customInstructionsRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!tree) {
      return;
    }
    setStep("select");
    setSearch("");
    setExpandedIds(createInitialExpandedState(tree.nodes));
    setSelectedId(tree.leafId ?? tree.nodes[0]?.id ?? "");
    setSummaryMode("none");
    setCustomInstructions("");
    setAutoScrollRequest((value) => value + 1);
  }, [tree]);

  useLayoutEffect(() => {
    if (step === "select") {
      if (loading || !tree) {
        return;
      }
      searchRef.current?.focus();
      return;
    }
    if (summaryMode === "custom") {
      customInstructionsRef.current?.focus();
      return;
    }
    dialogRef.current
      ?.querySelector<HTMLButtonElement>("[data-tree-summary-confirm='true']")
      ?.focus();
  }, [loading, step, summaryMode, tree]);

  useLayoutEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      const dialog = dialogRef.current;
      const target = event.target;
      if (!dialog || !(target instanceof Node) || dialog.contains(target)) {
        return;
      }

      // Tab handling keeps keyboard navigation inside; this also contains delayed programmatic focus.
      if (step === "select" && !loading && tree && searchRef.current) {
        searchRef.current.focus();
        return;
      }
      if (step === "summary" && summaryMode === "custom" && customInstructionsRef.current) {
        customInstructionsRef.current.focus();
        return;
      }
      dialog.querySelector<HTMLButtonElement>("[data-tree-summary-confirm='true']")?.focus();
      if (!dialog.contains(document.activeElement)) {
        dialog.focus();
      }
    };

    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [loading, step, summaryMode, tree]);

  const displayRows = useMemo(
    () => (tree ? buildVisibleRows(tree.nodes, expandedIds, search, tree.leafId, t) : []),
    [expandedIds, search, t, tree],
  );
  const selectedRow = displayRows.find((row) => row.node.id === selectedId);
  const currentLeafId = tree?.leafId ?? null;
  const currentLeafSelected = selectedId !== "" && selectedId === currentLeafId;
  const searching = search.trim().length > 0;

  const cancelAutoScroll = () => {
    if (autoScrollRequest !== 0) {
      setAutoScrollRequest(0);
    }
  };

  useEffect(() => {
    if (displayRows.length === 0) {
      setSelectedId("");
      return;
    }
    if (!displayRows.some((row) => row.node.id === selectedId)) {
      setSelectedId(displayRows[0]?.node.id ?? "");
    }
  }, [displayRows, selectedId]);

  useLayoutEffect(() => {
    if (autoScrollRequest === 0 || step !== "select") {
      return;
    }
    const scrollToBottom = () => {
      const listElement = listRef.current;
      if (!listElement) {
        return;
      }
      const lastRow = listElement.lastElementChild;
      if (lastRow instanceof HTMLElement) {
        lastRow.scrollIntoView({ block: "end" });
      }
      listElement.scrollTop = Math.max(0, listElement.scrollHeight - listElement.clientHeight);
    };
    scrollToBottom();
    let attempts = 0;
    const frame = window.requestAnimationFrame(() => {
      scrollToBottom();
    });
    const interval = window.setInterval(() => {
      scrollToBottom();
      attempts += 1;
      if (attempts >= 8) {
        window.clearInterval(interval);
      }
    }, 30);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, [autoScrollRequest, displayRows, step]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      trapDialogFocus(event, dialogRef.current);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (submitting) {
        return;
      }
      if (step === "summary") {
        setStep("select");
        return;
      }
      onClose();
      return;
    }

    if (step !== "select" || displayRows.length === 0) {
      return;
    }

    const currentIndex = Math.max(
      0,
      displayRows.findIndex((row) => row.node.id === selectedId),
    );
    if (event.key === "ArrowDown") {
      event.preventDefault();
      cancelAutoScroll();
      setSelectedId(
        displayRows[Math.min(displayRows.length - 1, currentIndex + 1)]?.node.id ?? selectedId,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      cancelAutoScroll();
      setSelectedId(displayRows[Math.max(0, currentIndex - 1)]?.node.id ?? selectedId);
      return;
    }
    if (
      event.key === "ArrowLeft" &&
      !searching &&
      selectedRow?.hasChildren &&
      selectedRow.expanded
    ) {
      event.preventDefault();
      cancelAutoScroll();
      setExpandedIds((current) => ({ ...current, [selectedRow.node.id]: false }));
      return;
    }
    if (
      event.key === "ArrowRight" &&
      !searching &&
      selectedRow?.hasChildren &&
      !selectedRow.expanded
    ) {
      event.preventDefault();
      cancelAutoScroll();
      setExpandedIds((current) => ({ ...current, [selectedRow.node.id]: true }));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (!currentLeafSelected && selectedId) {
        setStep("summary");
      }
    }
  };

  const handleToggleExpanded = (nodeId: string) => {
    cancelAutoScroll();
    setExpandedIds((current) => ({ ...current, [nodeId]: !current[nodeId] }));
  };

  const handleSubmit = () => {
    if (!selectedId || submitting) {
      return;
    }
    if (summaryMode === "custom" && customInstructions.trim().length === 0) {
      return;
    }

    onNavigate(selectedId, {
      summarize: summaryMode !== "none",
      ...(summaryMode === "custom" ? { customInstructions: customInstructions.trim() } : {}),
    });
  };

  const setListElement = (node: HTMLDivElement | null) => {
    listRef.current = node;
    if (!node || autoScrollRequest === 0 || step !== "select") {
      return;
    }
    node.scrollTop = Math.max(0, node.scrollHeight - node.clientHeight);
  };

  return (
    <div
      className="tree-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget || step !== "select" || submitting) {
          return;
        }
        onClose();
      }}
    >
      <div
        aria-modal="true"
        className="tree-modal"
        data-testid="tree-modal"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="tree-modal__header">
          <div>
            <div className="tree-modal__eyebrow">{t("timeline.tree.eyebrow")}</div>
            <h2 className="tree-modal__title">
              {step === "summary" ? t("timeline.tree.switchBranch") : t("timeline.tree.browse")}
            </h2>
          </div>
          <button
            aria-label={t("timeline.tree.close")}
            className="tree-modal__close"
            disabled={submitting}
            type="button"
            onClick={() => {
              if (step === "summary") {
                setStep("select");
                return;
              }
              onClose();
            }}
          >
            ×
          </button>
        </div>

        {error ? (
          <div className="tree-modal__error error-banner" data-testid="tree-modal-error">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="tree-modal__loading" data-testid="tree-modal-loading">
            {t("timeline.tree.loading")}
          </div>
        ) : null}

        {!loading && tree && step === "select" ? (
          <>
            <div className="tree-modal__search-row">
              <input
                autoFocus
                aria-label={t("timeline.tree.searchLabel")}
                className="tree-modal__search"
                data-testid="tree-modal-search"
                placeholder={t("timeline.tree.searchPlaceholder")}
                ref={searchRef}
                value={search}
                onChange={(event) => {
                  cancelAutoScroll();
                  setSearch(event.target.value);
                }}
              />
              <div className="tree-modal__meta">
                {searching
                  ? t("timeline.tree.searchHint")
                  : currentLeafId
                    ? t("timeline.tree.recentHint")
                    : t("timeline.tree.selectHint")}
              </div>
            </div>

            <div className="tree-modal__list" data-testid="tree-modal-list" ref={setListElement}>
              {displayRows.length === 0 ? (
                <div className="tree-modal__empty">{t("timeline.tree.noMatches")}</div>
              ) : (
                displayRows.map((row) => {
                  const isSelected = row.node.id === selectedId;
                  const isCurrentLeaf = row.node.id === currentLeafId;
                  return (
                    <div
                      className={`tree-row ${isSelected ? "tree-row--selected" : ""} ${isCurrentLeaf ? "tree-row--active" : ""}`}
                      key={row.node.id}
                    >
                      <button
                        aria-label={
                          row.expanded ? t("timeline.tree.collapse") : t("timeline.tree.expand")
                        }
                        className={`tree-row__toggle ${row.hasChildren ? "" : "tree-row__toggle--hidden"}`}
                        disabled={searching || !row.hasChildren}
                        tabIndex={-1}
                        type="button"
                        onClick={() => handleToggleExpanded(row.node.id)}
                      >
                        {row.hasChildren ? (
                          row.expanded ? (
                            <ChevronDownIcon />
                          ) : (
                            <ChevronRightIcon />
                          )
                        ) : null}
                      </button>
                      <button
                        className="tree-row__content"
                        data-tree-selected={isSelected ? "true" : undefined}
                        data-testid={`tree-row-${row.node.id}`}
                        title={buildTreeRowLine(row, currentLeafId, t)}
                        type="button"
                        onClick={() => {
                          cancelAutoScroll();
                          setSelectedId(row.node.id);
                        }}
                        onDoubleClick={() => {
                          cancelAutoScroll();
                          setSelectedId(row.node.id);
                          if (row.node.id !== currentLeafId) {
                            setStep("summary");
                          }
                        }}
                      >
                        <span className="tree-row__line">
                          {buildTreeRowLine(row, currentLeafId, t)}
                        </span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="tree-modal__footer">
              <div className="tree-modal__hint">{t("timeline.tree.footerHint")}</div>
              <div className="tree-modal__actions">
                <button className="button button--secondary" type="button" onClick={onClose}>
                  {t("timeline.tree.cancel")}
                </button>
                <button
                  className="button button--primary"
                  disabled={!selectedId || currentLeafSelected}
                  type="button"
                  onClick={() => setStep("summary")}
                >
                  {currentLeafSelected
                    ? t("timeline.tree.alreadyHere")
                    : t("timeline.tree.continue")}
                </button>
              </div>
            </div>
          </>
        ) : null}

        {!loading && tree && step === "summary" ? (
          <div className="tree-modal__summary-step" data-testid="tree-summary-step">
            <div className="tree-modal__summary-copy">{t("timeline.tree.leaveCopy")}</div>
            <div className="tree-summary-options">
              <button
                className={`tree-summary-option ${summaryMode === "none" ? "tree-summary-option--selected" : ""}`}
                type="button"
                onClick={() => setSummaryMode("none")}
              >
                <span className="tree-summary-option__title">{t("timeline.tree.noSummary")}</span>
                <span className="tree-summary-option__description">
                  {t("timeline.tree.noSummaryDescription")}
                </span>
              </button>
              <button
                className={`tree-summary-option ${summaryMode === "summary" ? "tree-summary-option--selected" : ""}`}
                type="button"
                onClick={() => setSummaryMode("summary")}
              >
                <span className="tree-summary-option__title">{t("timeline.tree.summarize")}</span>
                <span className="tree-summary-option__description">
                  {t("timeline.tree.summarizeDescription")}
                </span>
              </button>
              <button
                className={`tree-summary-option ${summaryMode === "custom" ? "tree-summary-option--selected" : ""}`}
                type="button"
                onClick={() => setSummaryMode("custom")}
              >
                <span className="tree-summary-option__title">
                  {t("timeline.tree.customSummary")}
                </span>
                <span className="tree-summary-option__description">
                  {t("timeline.tree.customSummaryDescription")}
                </span>
              </button>
            </div>

            {summaryMode === "custom" ? (
              <textarea
                autoFocus
                aria-label={t("timeline.tree.customLabel")}
                className="tree-modal__custom-instructions"
                placeholder={t("timeline.tree.customPlaceholder")}
                ref={customInstructionsRef}
                value={customInstructions}
                onChange={(event) => setCustomInstructions(event.target.value)}
              />
            ) : null}

            <div className="tree-modal__footer">
              <div className="tree-modal__hint">
                {submitting
                  ? t("timeline.tree.switching")
                  : summaryMode === "none"
                    ? t("timeline.tree.leaveAsIs")
                    : t("timeline.tree.summaryAttached")}
              </div>
              <div className="tree-modal__actions">
                <button
                  className="button button--secondary"
                  disabled={submitting}
                  type="button"
                  onClick={() => setStep("select")}
                >
                  {t("timeline.tree.back")}
                </button>
                <button
                  className="button button--primary"
                  data-tree-summary-confirm="true"
                  disabled={
                    submitting ||
                    !selectedId ||
                    (summaryMode === "custom" && customInstructions.trim().length === 0)
                  }
                  type="button"
                  onClick={handleSubmit}
                >
                  {submitting ? t("timeline.tree.switchingShort") : t("timeline.tree.switchBranch")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function createInitialExpandedState(
  nodes: readonly SessionTreeNodeSnapshot[],
): Record<string, boolean> {
  const expanded: Record<string, boolean> = {};
  for (const node of nodes) {
    if (node.parentId !== null) {
      expanded[node.parentId] = true;
    }
  }
  return expanded;
}

function buildVisibleRows(
  nodes: readonly SessionTreeNodeSnapshot[],
  expandedIds: Readonly<Record<string, boolean>>,
  search: string,
  currentLeafId: string | null,
  t: Translate,
): readonly TreeRow[] {
  const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const { roots, activePathIds } = buildDisplayTree(nodes, currentLeafId, tokens, t);
  return flattenTreeRows(roots, currentLeafId, activePathIds, expandedIds, tokens.length > 0);
}

/**
 * Builds the nested tree the modal shows: hidden and non-matching nodes are dropped (their
 * shown descendants move up to the nearest shown ancestor), and siblings leading to the
 * current leaf sort first. Loops rather than recursion, since one path can be thousands of
 * entries deep.
 */
function buildDisplayTree(
  nodes: readonly SessionTreeNodeSnapshot[],
  currentLeafId: string | null,
  searchTokens: readonly string[],
  t: Translate,
): { readonly roots: readonly TreeNode[]; readonly activePathIds: ReadonlySet<string> } {
  const ids = new Set(nodes.map((node) => node.id));
  const shownChildren = new Map<string, TreeNode[]>();
  const roots: TreeNode[] = [];
  const activePathIds = new Set<string>();
  const leadsToLeaf = (node: TreeNode) => activePathIds.has(node.id);

  // Children follow their parent in the snapshot, so walking it backwards finishes every
  // child before its parent. Lists fill in reverse and flip once their owner is reached.
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]!;
    const children = (shownChildren.get(node.id) ?? []).reverse();
    children.sort((left, right) => Number(leadsToLeaf(right)) - Number(leadsToLeaf(left)));

    let shown: readonly TreeNode[] = children;
    const matches = searchTokens.length === 0 || matchesTreeSearch(node, searchTokens, t);
    if (shouldShowNodeInView(node) && (matches || children.length > 0)) {
      if (node.id === currentLeafId || children.some(leadsToLeaf)) {
        activePathIds.add(node.id);
      }
      shown = [{ ...node, children }];
    }

    const parentId = node.parentId;
    let siblings = roots;
    if (parentId !== null && parentId !== node.id && ids.has(parentId)) {
      siblings = shownChildren.get(parentId) ?? [];
      shownChildren.set(parentId, siblings);
    }
    for (let shownIndex = shown.length - 1; shownIndex >= 0; shownIndex -= 1) {
      siblings.push(shown[shownIndex]!);
    }
  }

  roots.reverse();
  roots.sort((left, right) => Number(leadsToLeaf(right)) - Number(leadsToLeaf(left)));
  return { roots, activePathIds };
}

function shouldShowNodeInView(node: SessionTreeNodeSnapshot): boolean {
  if (DEFAULT_HIDDEN_KINDS.has(node.kind)) {
    return false;
  }
  if (node.kind === "message" && node.role === "assistant" && !hasVisiblePreview(node.preview)) {
    return false;
  }
  return true;
}

function hasVisiblePreview(preview: string | undefined): boolean {
  return typeof preview === "string" && preview.trim().length > 0;
}

function matchesTreeSearch(
  node: SessionTreeNodeSnapshot,
  tokens: readonly string[],
  t: Translate,
): boolean {
  const text = nodeSearchText(node, t);
  return tokens.every((token) => text.includes(token));
}

function flattenTreeRows(
  roots: readonly TreeNode[],
  currentLeafId: string | null,
  activePathIds: ReadonlySet<string>,
  expandedIds: Readonly<Record<string, boolean>>,
  expandAll: boolean,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const multipleRoots = roots.length > 1;
  type StackItem = readonly [
    node: TreeNode,
    indent: number,
    justBranched: boolean,
    showConnector: boolean,
    isLast: boolean,
    gutters: readonly GutterInfo[],
    isVirtualRootChild: boolean,
  ];
  const stack: StackItem[] = [];

  for (let index = roots.length - 1; index >= 0; index -= 1) {
    const isLast = index === roots.length - 1;
    const root = roots[index];
    if (!root) {
      continue;
    }
    stack.push([
      root,
      multipleRoots ? 1 : 0,
      multipleRoots,
      multipleRoots,
      isLast,
      [],
      multipleRoots,
    ]);
  }

  while (stack.length > 0) {
    const [node, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild] =
      stack.pop()!;
    const children = node.children;
    const multipleChildren = children.length > 1;
    const expanded = expandAll || children.length === 0 || expandedIds[node.id] !== false;
    const displayIndent = multipleRoots ? Math.max(0, indent - 1) : indent;

    rows.push({
      node,
      hasChildren: children.length > 0,
      expanded,
      displayIndent,
      showConnector,
      isLast,
      isVirtualRootChild,
      gutters,
      isOnActivePath: activePathIds.has(node.id),
    });

    if (!expanded || children.length === 0) {
      continue;
    }

    let childIndent: number;
    if (multipleChildren) {
      childIndent = indent + 1;
    } else if (justBranched && indent > 0) {
      childIndent = indent + 1;
    } else {
      childIndent = indent;
    }

    const connectorDisplayed = showConnector && !isVirtualRootChild;
    const connectorPosition = Math.max(0, displayIndent - 1);
    const childGutters: readonly GutterInfo[] = connectorDisplayed
      ? [...gutters, { position: connectorPosition, show: !isLast }]
      : gutters;

    for (let index = children.length - 1; index >= 0; index -= 1) {
      const childIsLast = index === children.length - 1;
      const child = children[index];
      if (!child) {
        continue;
      }
      stack.push([
        child,
        childIndent,
        multipleChildren,
        multipleChildren,
        childIsLast,
        childGutters,
        false,
      ]);
    }
  }

  return rows;
}

function buildTreeRowLine(row: TreeRow, currentLeafId: string | null, t: Translate): string {
  const prefix = buildTreePrefix(row);
  const pathMarker = row.node.id === currentLeafId ? "• " : row.isOnActivePath ? "· " : "  ";
  const label = row.node.label ? `[${row.node.label}] ` : "";
  const current = row.node.id === currentLeafId ? t("timeline.tree.current") : "";
  return `${prefix}${pathMarker}${label}${formatTreeNodeDisplayText(row.node, t)}${current}`;
}

function buildTreePrefix(row: TreeRow): string {
  const chars: string[] = [];
  const connector =
    row.showConnector && !row.isVirtualRootChild ? (row.isLast ? "└─ " : "├─ ") : "";
  const connectorPosition = connector ? row.displayIndent - 1 : -1;
  const totalChars = row.displayIndent * 3;

  for (let index = 0; index < totalChars; index += 1) {
    const level = Math.floor(index / 3);
    const positionInLevel = index % 3;
    const gutter = row.gutters.find((entry) => entry.position === level);
    if (gutter) {
      chars.push(positionInLevel === 0 ? (gutter.show ? "│" : " ") : " ");
      continue;
    }
    if (connector && level === connectorPosition) {
      if (positionInLevel === 0) {
        chars.push(row.isLast ? "└" : "├");
      } else if (positionInLevel === 1) {
        chars.push(row.expanded ? "─" : "⊞");
      } else {
        chars.push(" ");
      }
      continue;
    }
    chars.push(" ");
  }

  return chars.join("");
}

function formatTreeNodeDisplayText(node: SessionTreeNodeSnapshot, t: Translate): string {
  switch (node.kind) {
    case "message":
      switch (node.role) {
        case "user":
          return t("timeline.tree.user", { preview: node.preview ?? t("timeline.tree.empty") });
        case "assistant":
          return t("timeline.tree.assistant", {
            preview: node.preview ?? t("timeline.tree.noContent"),
          });
        case "toolResult":
          return node.preview ?? t("timeline.tree.tool");
        case "bashExecution":
          return t("timeline.tree.bash", { preview: node.preview ?? t("timeline.tree.noCommand") });
        case "branchSummary":
          return t("timeline.tree.branchSummary", {
            preview: node.preview ?? t("timeline.tree.empty"),
          });
        case "compactionSummary":
          return t("timeline.tree.compaction", {
            preview: node.preview ?? t("timeline.tree.empty"),
          });
        default:
          return t("timeline.tree.role", {
            role: node.role ?? t("timeline.tree.message"),
            preview: node.preview ? ` ${node.preview}` : "",
          });
      }
    case "custom_message":
      return t("timeline.tree.customMessage", {
        type: node.customType ?? t("timeline.tree.custom"),
        preview: node.preview ?? t("timeline.tree.empty"),
      });
    case "compaction":
      return t("timeline.tree.compactionBracket", {
        preview: node.preview ?? t("timeline.tree.summary"),
      });
    case "branch_summary":
      return t("timeline.tree.branchSummary", {
        preview: node.preview ?? t("timeline.tree.empty"),
      });
    default:
      return node.preview ? `${node.title}: ${node.preview}` : node.title;
  }
}

function nodeSearchText(node: SessionTreeNodeSnapshot, t: Translate): string {
  return [
    node.title,
    node.preview,
    node.label,
    node.role,
    node.customType,
    formatTreeNodeDisplayText(node, t),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
