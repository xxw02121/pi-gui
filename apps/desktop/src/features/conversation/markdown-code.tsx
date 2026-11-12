import { isValidElement, useEffect, useId, useState, type ReactNode } from "react";
import { useTranslation } from "../../i18n";
import { useActiveTheme } from "../../ui/active-theme";
import { CopyIcon } from "../../ui/icons";
import { HighlightedLine } from "../../ui/highlighted-line";
import { fenceToSyntaxLanguage } from "../../ui/syntax-highlight";

export function readFencedCode(children: ReactNode): { className?: string; code: string } | null {
  const child = Array.isArray(children) ? children.find((entry) => isValidElement(entry)) : children;
  if (!isValidElement<{ className?: string; children?: ReactNode }>(child)) return null;
  return {
    className: child.props.className,
    code: String(child.props.children ?? "").replace(/\n$/, ""),
  };
}

export function FencedCodeBlock({
  className,
  code,
}: {
  readonly className?: string;
  readonly code: string;
}) {
  const language = /language-([\w+-]+)/.exec(className ?? "")?.[1];
  if (language === "mermaid") return <MermaidBlock source={code} />;
  return <CodeBlock code={code} language={language} />;
}

function CodeBlock({ code, language }: { readonly code: string; readonly language?: string }) {
  const { t } = useTranslation();
  const syntaxLanguage = fenceToSyntaxLanguage(language);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const lines = code.split("\n");
  return (
    <div className="message__code">
      <div className="message__code-toolbar">
        {language ? <span className="message__code-lang">{language}</span> : <span />}
        <button
          aria-label={t("markdown.copyCode")}
          className="message__code-copy"
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(code).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
        >
          <CopyIcon />
          <span>{copied ? t("markdown.copied") : t("markdown.copy")}</span>
        </button>
      </div>
      <pre>
        <code>
          {lines.map((line, index) => (
            <span className="message__code-line" key={`${index}:${line}`}>
              {syntaxLanguage ? (
                <HighlightedLine content={line} language={syntaxLanguage} />
              ) : (
                line
              )}
              {index < lines.length - 1 ? "\n" : null}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

function isSafeSvg(svg: string): boolean {
  return svg.includes("<svg") && !/<script|javascript:|on\w+\s*=/i.test(svg);
}

function MermaidBlock({ source }: { readonly source: string }) {
  const { variant } = useActiveTheme();
  const reactId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void import("mermaid")
        .then(async (mod) => {
          const mermaid = mod.default;
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: variant === "dark" ? "dark" : "neutral",
            fontFamily: "inherit",
          });
          const rendered = await mermaid.render(`mermaid-${reactId}`, source);
          if (cancelled) return;
          setSvg(isSafeSvg(rendered.svg) ? rendered.svg : null);
        })
        .catch(() => {
          if (!cancelled) setSvg(null);
        });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reactId, source, variant]);
  if (!svg) return <CodeBlock code={source} language="mermaid" />;
  return (
    <div className="message__mermaid" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
