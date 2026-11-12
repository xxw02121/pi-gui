import { expect, test } from "@playwright/test";
import { prepareStreamingMarkdown } from "../../src/features/conversation/markdown-math";

test("math delimiters stay closed and currency stays text", () => {
  const source = [
    "Chemistry $\\text{ZnSO}_4$ and $\\frac{1}{2}$.",
    "",
    "$$",
    "\\int_0^1 x^2 \\, dx",
    "$$",
    "",
    "\\(a+b\\) and \\[c+d\\]",
    "",
    "A price of $5 and $10 stays text, as does $1,250.00.",
    "",
    "Unclosed $\\frac{1}{2}",
    "",
    "```",
    "echo $HOME and $5",
    "```",
    "",
    "Inline `$PATH` stays code.",
  ].join("\n");

  const prepared = prepareStreamingMarkdown(source);
  expect(prepared).toContain("$\\text{ZnSO}_4$");
  expect(prepared).toContain("$\\frac{1}{2}$");
  expect(prepared).toContain("$$\n\\int_0^1 x^2 \\, dx\n$$");
  expect(prepared).toContain("\\(a+b\\)");
  expect(prepared).toContain("\\[c+d\\]");
  expect(prepared).toContain("\\$5 and \\$10");
  expect(prepared).toContain("\\$1,250.00");
  expect(prepared).toContain("Unclosed \\$\\frac{1}{2}");
  expect(prepared).toContain("echo $HOME and $5");
  expect(prepared).not.toContain("echo \\$HOME");
  expect(prepared).toContain("`$PATH`");
});

test("an unclosed display delimiter does not swallow the following paragraph", () => {
  const prepared = prepareStreamingMarkdown("Wait $$\n\\frac{1}{2}\n\nStill text.");
  expect(prepared.startsWith("Wait \\$\\$")).toBe(true);
  expect(prepared).toContain("Still text.");
});
