import { expect, test } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { CommandBar } from "../src/ui/CommandBar.js";

test("CommandBar shows the prompt and streamed answer", () => {
  const { lastFrame } = render(
    <CommandBar
      visible={true}
      draft="why diverge?"
      answer="because the LR was too high"
      busy={false}
      onChange={() => {}}
      onSubmit={() => {}}
    />,
  );
  expect(lastFrame()).toContain("why diverge?");
  expect(lastFrame()).toContain("because the LR was too high");
});

test("CommandBar renders nothing when not visible", () => {
  const { lastFrame } = render(
    <CommandBar visible={false} draft="" answer="" busy={false} onChange={() => {}} onSubmit={() => {}} />,
  );
  expect(lastFrame()?.trim()).toBe("");
});

test("CommandBar shows a thinking indicator when busy", () => {
  const { lastFrame } = render(
    <CommandBar visible={true} draft="q" answer="" busy={true} onChange={() => {}} onSubmit={() => {}} />,
  );
  expect(lastFrame()).toContain("thinking");
});
