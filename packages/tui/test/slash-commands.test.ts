import { expect, test } from "vitest";
import { parseSlash } from "../src/slash-commands.js";

test("non-slash text returns null (sent to agent)", () => {
  expect(parseSlash("why did this diverge?")).toBeNull();
});

test("lens commands parse with the lens name as arg", () => {
  expect(parseSlash("/tree")).toEqual({ kind: "lens", arg: "tree" });
  expect(parseSlash("/missions")).toEqual({ kind: "lens", arg: "missions" });
  expect(parseSlash("/chat")).toEqual({ kind: "lens", arg: "chat" });
});

test("spawn and kill parse an optional id arg", () => {
  expect(parseSlash("/spawn")).toEqual({ kind: "spawn", arg: undefined });
  expect(parseSlash("/spawn H-004")).toEqual({ kind: "spawn", arg: "H-004" });
  expect(parseSlash("/kill H-002")).toEqual({ kind: "kill", arg: "H-002" });
});

test("review, help, and quit aliases parse", () => {
  expect(parseSlash("/review")?.kind).toBe("review");
  expect(parseSlash("/help")?.kind).toBe("help");
  expect(parseSlash("/quit")?.kind).toBe("quit");
  expect(parseSlash("/exit")?.kind).toBe("quit");
  expect(parseSlash("/q")?.kind).toBe("quit");
});

test("unknown command reports the word", () => {
  expect(parseSlash("/frobnicate")).toEqual({ kind: "unknown", arg: "frobnicate" });
});

test("a bare slash shows help", () => {
  expect(parseSlash("/")?.kind).toBe("help");
  expect(parseSlash("/   ")?.kind).toBe("help");
});

test("commands are case-insensitive and trim whitespace", () => {
  expect(parseSlash("/TREE")).toEqual({ kind: "lens", arg: "tree" });
  expect(parseSlash("/  spawn  H-1  ")).toEqual({ kind: "spawn", arg: "H-1" });
});
