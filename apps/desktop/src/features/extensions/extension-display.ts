import type {
  RuntimeExtensionRecord,
  RuntimeSourceScope,
} from "@pi-gui/session-driver/runtime-types";
import { translate, type Translate } from "../../i18n/translate";

export function extensionSourceSummary(
  extension: RuntimeExtensionRecord,
  t: Translate = translate,
): string {
  return `${extensionScopeLabel(extension, t)} · ${extension.sourceInfo.origin}`;
}

/** Extensions pi-gui itself adds to every session; switched on and off app-wide. */
export function isPiGuiBuiltinExtension(extension: RuntimeExtensionRecord): boolean {
  return (
    extension.sourceInfo.source === "builtin" &&
    extension.sourceInfo.origin === "top-level" &&
    extension.sourceInfo.scope === "temporary"
  );
}

/**
 * pi's own add-ons (MCP, code mode, tool search), named `builtin:<name>`. Their switch writes
 * pi's `extensions` setting, so terminal pi follows it too.
 */
export function isPiAddonExtension(extension: RuntimeExtensionRecord): boolean {
  return extension.sourceInfo.source === "builtin" && extension.path.startsWith("builtin:");
}

export function extensionScopeLabel(
  extension: RuntimeExtensionRecord,
  t: Translate = translate,
): string {
  if (isPiGuiBuiltinExtension(extension)) return t("extensions.scope.piGuiTools");
  if (isPiAddonExtension(extension)) return t("extensions.scope.piAddons");
  return extension.sourceInfo.scope;
}

/** Group heading for where a skill or extension was discovered. */
export function sourceScopeGroupLabel(scope: RuntimeSourceScope, t: Translate = translate): string {
  switch (scope) {
    case "project":
      return t("extensions.scope.workspace");
    case "user":
      return t("extensions.scope.user");
    case "temporary":
      return t("extensions.scope.session");
  }
}

export function extensionGroupLabel(
  extension: RuntimeExtensionRecord,
  t: Translate = translate,
): string {
  if (isPiGuiBuiltinExtension(extension)) return t("extensions.scope.piGuiTools");
  if (isPiAddonExtension(extension)) return t("extensions.scope.piAddons");
  return sourceScopeGroupLabel(extension.sourceInfo.scope, t);
}
