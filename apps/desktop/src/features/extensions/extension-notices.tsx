import type { SessionExtensionNoticeRecord } from "../../../contracts/desktop-state";
import { useTranslation, type Translate } from "../../i18n";

function levelPrefix(
  level: SessionExtensionNoticeRecord["level"],
  t: Translate,
): string | undefined {
  switch (level) {
    case "warning":
      return t("extensions.notices.warning");
    case "error":
      return t("extensions.notices.error");
    case "info":
      return undefined;
  }
}

/** Draws `ctx.ui.notify` toasts above the composer. Main adds and expires them. */
export function ExtensionNotices({
  notices,
}: {
  readonly notices?: readonly SessionExtensionNoticeRecord[];
}) {
  const { t } = useTranslation();
  // The live region stays mounted so screen readers announce notices as they arrive.
  return (
    <div className="extension-notices" data-testid="extension-notices" role="status">
      {notices?.map((notice) => {
        const prefix = levelPrefix(notice.level, t);
        return (
          <div
            className="extension-notice"
            data-level={notice.level}
            data-testid="extension-notice"
            key={notice.id}
          >
            {prefix ? <span className="extension-notice__level">{prefix}</span> : null}
            <span className="extension-notice__message">{notice.message}</span>
          </div>
        );
      })}
    </div>
  );
}
