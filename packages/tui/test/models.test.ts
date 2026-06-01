import { expect, test } from "vitest";
import { parseModels } from "../src/models.js";

const SAMPLE = `Canonical models
canonical                               selected                                variants  context  max-out
claude-opus-4-8                         openrouter/anthropic/claude-opus-4.8     1         1M       128K
claude-sonnet-4-6                       openrouter/anthropic/claude-sonnet-4.6   1         1M       128K
gpt-5.2                                 openai/gpt-5.2                           1         400K     128K
`;

test("parseModels extracts canonical ids and skips header rows", () => {
  const models = parseModels(SAMPLE);
  expect(models).toEqual(["claude-opus-4-8", "claude-sonnet-4-6", "gpt-5.2"]);
});

test("parseModels ignores the section title and blank lines", () => {
  expect(parseModels("Canonical models\n\n")).toEqual([]);
});

test("parseModels returns empty for empty input", () => {
  expect(parseModels("")).toEqual([]);
});
