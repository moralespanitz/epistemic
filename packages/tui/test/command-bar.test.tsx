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
      onClose={() => {}}
    />,
  );
  expect(lastFrame()).toContain("why diverge?");
  expect(lastFrame()).toContain("because the LR was too high");
});

test("CommandBar renders nothing when not visible", () => {
  const { lastFrame } = render(
    <CommandBar visible={false} draft="" answer="" busy={false} onChange={() => {}} onSubmit={() => {}} onClose={() => {}} />,
  );
  expect(lastFrame()?.trim()).toBe("");
});

test("CommandBar shows a thinking indicator when busy", () => {
  const { lastFrame } = render(
    <CommandBar visible={true} draft="q" answer="" busy={true} onChange={() => {}} onSubmit={() => {}} onClose={() => {}} />,
  );
  expect(lastFrame()).toContain("thinking");
});

test("CommandBar calls onClose when escape is pressed", async () => {
  let closed = false;
  const { stdin } = render(
    <CommandBar visible={true} draft="q" answer="" busy={false} onChange={() => {}} onSubmit={() => {}} onClose={() => { closed = true; }} />,
  );
  await new Promise((r) => setTimeout(r, 20));
  stdin.write("\x1B"); // escape
  await new Promise((r) => setTimeout(r, 20));
  expect(closed).toBe(true);
});
