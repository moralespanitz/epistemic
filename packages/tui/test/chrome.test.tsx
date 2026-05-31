import { expect, test } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { Header } from "../src/ui/Header.js";
import { ChatView } from "../src/ui/ChatView.js";
import { PromptInput } from "../src/ui/PromptInput.js";
import type { ChatMessage, ResearchWorld } from "../src/model/types.js";

const world: ResearchWorld = {
  nodes: [
    { id: "H-004", claim: "scale to 7B", status: "RUNNING", computeTarget: "modal", costCap: 80, spent: 12, childIds: [], alternativeIds: [] },
  ],
  runs: [], lessons: [], totalSpent: 12, totalCap: 80,
};

test("Header shows the active hypothesis and brand", () => {
  const { lastFrame } = render(<Header world={world} />);
  expect(lastFrame()).toContain("epistemic");
  expect(lastFrame()).toContain("H-004");
  expect(lastFrame()).toContain("RUNNING");
});

test("Header shows a placeholder when there are no hypotheses", () => {
  const empty: ResearchWorld = { nodes: [], runs: [], lessons: [], totalSpent: 0, totalCap: 0 };
  const { lastFrame } = render(<Header world={empty} />);
  expect(lastFrame()).toContain("no active hypothesis");
});

test("ChatView shows an empty-state hint with no messages", () => {
  const { lastFrame } = render(<ChatView messages={[]} busy={false} />);
  expect(lastFrame()).toContain("/help");
});

test("ChatView renders user and agent turns", () => {
  const messages: ChatMessage[] = [
    { role: "user", text: "why diverge?" },
    { role: "assistant", text: "the LR was too high" },
  ];
  const { lastFrame } = render(<ChatView messages={messages} busy={false} />);
  expect(lastFrame()).toContain("why diverge?");
  expect(lastFrame()).toContain("the LR was too high");
  expect(lastFrame()).toContain("you");
  expect(lastFrame()).toContain("agent");
});

test("PromptInput shows the draft and chat hint", () => {
  const { lastFrame } = render(<PromptInput draft="hello world" busy={false} />);
  expect(lastFrame()).toContain("hello world");
  expect(lastFrame()).toContain("enter send");
});

test("PromptInput shows the command hint when the draft is a slash command", () => {
  const { lastFrame } = render(<PromptInput draft="/sp" busy={false} />);
  expect(lastFrame()).toContain("/spawn");
});
