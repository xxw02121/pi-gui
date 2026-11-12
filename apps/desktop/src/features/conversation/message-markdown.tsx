import { memo, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { useTranslation, type Translate } from "../../i18n";
import { FencedCodeBlock, readFencedCode } from "./markdown-code";
import { prepareStreamingMarkdown } from "./markdown-math";
import {
  remarkWorkspaceFileLines,
  workspaceFileLineFromAnchorProps,
  type WorkspaceFileLine,
} from "./workspace-file-line";

const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [[rehypeKatex, { throwOnError: false, strict: "ignore", trust: false }]];

function markdownComponents(
  t: Translate,
  onOpenWorkspaceFileLine?: (target: WorkspaceFileLine) => void,
  blockImages = false,
): Components {
  return {
    code: ({ className, children }) => {
      const code = String(children).replace(/\n$/, "");
      return <code className={className}>{code}</code>;
    },
    pre: ({ children }) => {
      const fenced = readFencedCode(children as ReactNode);
      if (!fenced) return <pre>{children}</pre>;
      return <FencedCodeBlock className={fenced.className} code={fenced.code} />;
    },
    ...(blockImages
      ? {
          img: ({ alt }: { alt?: string }) => (
            <span className="file-editor__blocked-image">
              {alt ? t("markdown.imageWithAlt", { alt }) : t("markdown.imageBlocked")}
            </span>
          ),
        }
      : {}),
    a: ({ href, children, ...props }) => {
      const file = onOpenWorkspaceFileLine ? workspaceFileLineFromAnchorProps(props) : null;
      if (file && onOpenWorkspaceFileLine) {
        return (
          <button
            className="message__file-link"
            data-end-line={file.endLine}
            data-line={file.line}
            data-path={file.path}
            data-testid="workspace-file-link"
            type="button"
            onClick={() => onOpenWorkspaceFileLine(file)}
          >
            {children}
          </button>
        );
      }
      return (
        <a href={href} rel="noreferrer" target="_blank">
          {children}
        </a>
      );
    },
    table: ({ children }) => (
      <div className="message__table-scroll">
        <table>{children}</table>
      </div>
    ),
  };
}

// Memoized: remark parsing is the dominant render cost on long threads, and the
// timeline re-renders on every streaming tick. `text` is a string, so shallow
// comparison skips the re-parse for every message except the one still growing.
export const MessageMarkdown = memo(function MessageMarkdown({
  text,
  workspacePath,
  onOpenWorkspaceFileLine,
  annotationRoot = false,
  blockImages = false,
  className = "message__content",
}: {
  readonly text: string;
  /** Marks this text as what transcript annotations anchor to. */
  readonly annotationRoot?: boolean;
  readonly workspacePath?: string;
  readonly onOpenWorkspaceFileLine?: (target: WorkspaceFileLine) => void;
  /** File preview refuses remote images; assistant messages still render them. */
  readonly blockImages?: boolean;
  readonly className?: string;
}) {
  const { t } = useTranslation();
  const components = useMemo(
    () => markdownComponents(t, onOpenWorkspaceFileLine, blockImages),
    [blockImages, onOpenWorkspaceFileLine, t],
  );
  const remarkPlugins = useMemo(
    () =>
      onOpenWorkspaceFileLine
        ? [remarkGfm, remarkMath, remarkWorkspaceFileLines(workspacePath ?? null)]
        : REMARK_PLUGINS,
    [onOpenWorkspaceFileLine, workspacePath],
  );
  return (
    <div className={className} data-annotation-root={annotationRoot ? "" : undefined}>
      <ReactMarkdown
        components={components}
        rehypePlugins={REHYPE_PLUGINS}
        remarkPlugins={remarkPlugins}
      >
        {prepareStreamingMarkdown(text)}
      </ReactMarkdown>
    </div>
  );
});
