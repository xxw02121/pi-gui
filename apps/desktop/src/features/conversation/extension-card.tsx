import type { ReactNode } from "react";
import type { ExtensionAction, ExtensionCard, ExtensionCardTone } from "@pi-gui/session-driver";
import { useTranslation, type Translate } from "../../i18n";
import { ExtensionIcon } from "../../ui/icons";

/** Asks the app to run one of the fixed actions an extension's button can name. */
export type RunExtensionAction = (action: ExtensionAction) => void;

/**
 * A card an extension declared with `pi.appendEntry("pi-gui.card", ...)`, drawn in the
 * "Edited N files" shell: tone as a word, rows and buttons like file rows. A pinned card adds
 * header controls and can collapse to its header.
 */
export function ExtensionCardItem({
  card,
  onAction,
  controls,
  collapsed = false,
}: {
  readonly card: ExtensionCard;
  readonly onAction?: RunExtensionAction;
  readonly controls?: ReactNode;
  readonly collapsed?: boolean;
}) {
  const { t } = useTranslation();
  const toneLabel = cardToneLabel(card.tone, t);
  const hasBody = !collapsed && (card.rows.length > 0 || card.actions.length > 0);
  return (
    <section
      className={`turn-changes extension-card extension-card--${card.tone}`}
      aria-label={card.title}
      data-testid="extension-card"
      data-card-key={card.key}
    >
      <header className="turn-changes__header">
        <span className="turn-changes__glyph" aria-hidden="true">
          <ExtensionIcon />
        </span>
        <div className="turn-changes__summary">
          <span className="turn-changes__title">{card.title}</span>
          {card.subtitle ? <span className="extension-card__subtitle">{card.subtitle}</span> : null}
        </div>
        {toneLabel ? <span className="extension-card__tone">{toneLabel}</span> : null}
        {controls}
      </header>
      {hasBody ? (
        <ul className="turn-changes__files">
          {card.rows.map((row, index) => (
            <li className="extension-card__row" key={`row:${index}`}>
              <span className="extension-card__label">{row.label}</span>
              <span className="extension-card__value">{row.value}</span>
            </li>
          ))}
          {card.actions.map((action, index) => {
            const target = actionTarget(action, t);
            return (
              <li key={`action:${index}`}>
                <button
                  type="button"
                  className="turn-changes__file extension-card__action"
                  data-action-type={action.type}
                  disabled={!onAction}
                  title={target}
                  onClick={() => onAction?.(action)}
                >
                  <span className="extension-card__label">{action.label}</span>
                  <span className="extension-card__action-target">{target}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

/** What a button will touch, shown beside its label so the user knows before clicking. */
function actionTarget(action: ExtensionAction, t: Translate): string {
  switch (action.type) {
    case "openFile":
      return action.line ? `${action.path}:${action.line}` : action.path;
    case "composer":
      return t("timeline.card.addsToMessage");
    case "url":
      return new URL(action.url).host;
    case "command":
      return action.command;
    case "openThread":
      return t("timeline.card.opensThread");
    default:
      return unhandledAction(action);
  }
}

function unhandledAction(action: never): string {
  return (action as ExtensionAction).label;
}

function cardToneLabel(tone: ExtensionCardTone, t: Translate): string | undefined {
  switch (tone) {
    case "success":
      return t("timeline.card.passed");
    case "warning":
      return t("timeline.card.warning");
    case "error":
      return t("timeline.card.failed");
    case "neutral":
      return undefined;
  }
}
