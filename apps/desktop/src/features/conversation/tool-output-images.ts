import { isShownToolImageUrl, isToolImageBlock } from "../../../contracts/tool-output-images";
import { translate, type Translate } from "../../i18n/translate";

/** An image block that still carries data or a URL, wherever it sits in a tool's input or output. */
function carriesImage(value: unknown): value is { type: "image"; mimeType?: unknown } {
  return isToolImageBlock(value) && ("data" in value || "src" in value);
}

/**
 * Images a tool returned in its result content, such as the read tool on a screenshot or a code
 * mode script calling `image()` with `models.generateImages()`. Main sends each one the window can
 * show as a `pi-gui-image://` URL and loads it when its row is shown.
 */
export interface ToolOutputImage {
  readonly mimeType: string;
  readonly src: string;
}

/** Only images main serves; any other `src` a tool or extension set is never loaded. */
export function toolOutputImages(output: unknown): readonly ToolOutputImage[] {
  if (typeof output !== "object" || output === null) return [];
  const { content } = output as Record<string, unknown>;
  if (!Array.isArray(content)) return [];
  return content.filter(isShownToolImageUrl).map(({ mimeType, src }) => ({ mimeType, src }));
}

/** JSON for the expanded row and Copy, with each image shown as a short placeholder. */
export function stringifyToolValue(value: unknown, t: Translate = translate): string {
  return JSON.stringify(
    value,
    (_key, nested: unknown) =>
      carriesImage(nested)
        ? {
            ...nested,
            src: undefined,
            data: t("timeline.tool.imagePlaceholder", {
              kind:
                typeof nested.mimeType === "string"
                  ? nested.mimeType
                  : t("timeline.tool.imageKind"),
            }),
          }
        : nested,
    2,
  );
}
