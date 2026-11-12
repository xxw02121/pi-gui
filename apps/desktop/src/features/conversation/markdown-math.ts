/*
 * Prepares assistant markdown before remark-math sees it.
 *
 * Unclosed `$`, `$$`, `\(` and `\[` delimiters are escaped so a streaming
 * token cannot swallow the rest of the message. Dollar amounts (`$5`,
 * `$10.50`, `$5 and $10`) stay text. Fenced and inline code is left alone.
 */

const CURRENCY = /^(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?$/;

export function prepareStreamingMarkdown(source: string): string {
  let result = "";
  let index = 0;
  while (index < source.length) {
    const fence = readFence(source, index);
    if (fence) {
      result += fence;
      index += fence.length;
      continue;
    }
    const inline = source[index] === "`" ? readInlineCode(source, index) : null;
    if (inline) {
      result += inline;
      index += inline.length;
      continue;
    }
    let next = index + 1;
    while (next < source.length && !readFence(source, next) && source[next] !== "`") next += 1;
    result += escapeUnstableMath(source.slice(index, next));
    index = next;
  }
  return result;
}

function readFence(source: string, index: number): string | null {
  if (index > 0 && source[index - 1] !== "\n") return null;
  const marker = source.startsWith("```", index)
    ? "```"
    : source.startsWith("~~~", index)
      ? "~~~"
      : null;
  if (!marker) return null;
  const lineEnd = source.indexOf("\n", index);
  if (lineEnd === -1) return source.slice(index);
  const rest = source.slice(lineEnd + 1);
  const close = new RegExp(`^${marker}[ \\t]*$`, "m").exec(rest);
  if (!close || close.index === undefined) return source.slice(index);
  return source.slice(index, lineEnd + 1 + close.index + close[0].length);
}

function readInlineCode(source: string, index: number): string | null {
  let size = 0;
  while (source[index + size] === "`") size += 1;
  if (size === 0) return null;
  const marker = "`".repeat(size);
  const closer = source.indexOf(marker, index + size);
  if (closer === -1) return null;
  const inner = source.slice(index + size, closer);
  if (inner.includes("\n")) return null;
  return source.slice(index, closer + size);
}

function escapeUnstableMath(text: string): string {
  let out = "";
  for (let index = 0; index < text.length; ) {
    const char = text[index] ?? "";
    if (char === "\\" && index + 1 < text.length) {
      out += text.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (text.startsWith("$$", index)) {
      const close = text.indexOf("$$", index + 2);
      if (close === -1) {
        out += "\\$\\$";
        index += 2;
        continue;
      }
      out += text.slice(index, close + 2);
      index = close + 2;
      continue;
    }
    if (text.startsWith("\\[", index) || text.startsWith("\\(", index)) {
      const opener = text.slice(index, index + 2);
      const closer = opener === "\\[" ? "\\]" : "\\)";
      const close = text.indexOf(closer, index + 2);
      if (close === -1) {
        out += `\\${opener}`;
        index += 2;
        continue;
      }
      out += text.slice(index, close + closer.length);
      index = close + closer.length;
      continue;
    }
    if (char === "$") {
      const next = text[index + 1];
      if (!next || next === "$" || /\s/.test(next) || /\d/.test(next)) {
        out += "\\$";
        index += 1;
        continue;
      }
      const lineBreak = text.indexOf("\n", index + 1);
      const region = text.slice(index + 1, lineBreak === -1 ? undefined : lineBreak);
      const close = findClosingDollar(region);
      if (close === -1) {
        out += "\\$";
        index += 1;
        continue;
      }
      const inner = region.slice(0, close);
      if (CURRENCY.test(inner) || inner.endsWith(" ") || inner.startsWith(" ")) {
        out += "\\$";
        index += 1;
        continue;
      }
      out += `$${inner}$`;
      index += close + 2;
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

function findClosingDollar(region: string): number {
  for (let index = 0; index < region.length; index += 1) {
    if (region[index] === "\\") {
      index += 1;
      continue;
    }
    if (region[index] === "$") return index;
  }
  return -1;
}
