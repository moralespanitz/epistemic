import { expect, test } from "vitest";
import { parseSlash, matchCommands, COMMANDS, COMMAND_TOKENS } from "../src/slash-commands.js";

test("non-slash text returns null (sent to agent)", () => {
  expect(parseSlash("why did this diverge?")).toBeNull();
});

test("view commands resolve to kind 'view'", () => {
  expect(parseSlash("/tree")).toMatchObject({ name: "tree", kind: "view" });
  expect(parseSlash("/missions")).toMatchObject({ name: "missions", kind: "view" });
  expect(parseSlash("/chat")).toMatchObject({ name: "chat", kind: "view" });
});

test("action commands resolve to kind 'action' with optional arg", () => {
  expect(parseSlash("/model")).toMatchObject({ name: "model", kind: "action", arg: undefined });
  expect(parseSlash("/model gpt-5.2")).toMatchObject({ name: "model", kind: "action", arg: "gpt-5.2" });
  expect(parseSlash("/spawn H-004")).toMatchObject({ name: "spawn", kind: "action", arg: "H-004" });
  expect(parseSlash("/clear")).toMatchObject({ name: "clear", kind: "action" });
  expect(parseSlash("/cost")).toMatchObject({ name: "cost", kind: "action" });
});

test("pi.dev passthrough commands resolve to kind 'passthrough'", () => {
  expect(parseSlash("/commit")).toMatchObject({ name: "commit", kind: "passthrough" });
  expect(parseSlash("/mcp")).toMatchObject({ name: "mcp", kind: "passthrough" });
  expect(parseSlash("/memory")).toMatchObject({ name: "memory", kind: "passthrough" });
  expect(parseSlash("/plan")).toMatchObject({ name: "plan", kind: "passthrough" });
});

test("aliases resolve to the canonical command", () => {
  expect(parseSlash("/exit")).toMatchObject({ name: "quit", kind: "action" });
  expect(parseSlash("/q")).toMatchObject({ name: "quit", kind: "action" });
  expect(parseSlash("/?")).toMatchObject({ name: "help", kind: "action" });
});

test("unknown command reports the word", () => {
  expect(parseSlash("/frobnicate")).toMatchObject({ name: "unknown", kind: "unknown", arg: "frobnicate" });
});

test("a bare slash shows help", () => {
  expect(parseSlash("/")).toMatchObject({ name: "help" });
  expect(parseSlash("/   ")).toMatchObject({ name: "help" });
});

test("commands are case-insensitive and trim whitespace", () => {
  expect(parseSlash("/TREE")).toMatchObject({ name: "tree", kind: "view" });
  expect(parseSlash("/  spawn  H-1  ")).toMatchObject({ name: "spawn", arg: "H-1" });
});

test("matchCommands autocompletes by prefix", () => {
  const names = matchCommands("/co").map((c) => c.name);
  expect(names).toContain("commit");
  expect(names).toContain("cost");
  expect(names).toContain("compact");
});

test("the registry includes the headline pi.dev commands", () => {
  const names = COMMANDS.map((c) => c.name);
  for (const n of ["model", "clear", "compact", "commit", "mcp", "memory", "plan", "goal", "review"]) {
    expect(names).toContain(n);
  }
  expect(COMMAND_TOKENS).toContain("/model");
});
