import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseResearchDocument } from "../src/graph/parser.js";

const SAMPLE = `# RD: CoT for Code

## 1. Research overview
### 1.2 Research summary
Does chain-of-thought prompting improve code generation?

## 10. Research stories

### 10.1. Establish baseline performance
- **ID**: RS-001
- **Description**: Reproduce gpt-4o baseline on HumanEval pass@1.
- **Validation criteria**: Baseline matches published ±1%.

### 10.2. Test CoT prompting
- **ID**: RS-002
- **Description**: Compare CoT vs vanilla on 30 runs.
- **Validation criteria**: p < 0.05, effect size reported.
`;

describe("parseResearchDocument", () => {
  it("extracts title from h1", () => {
    const doc = parseResearchDocument(SAMPLE);
    assert.equal(doc.title, "CoT for Code");
  });

  it("extracts summary from section 1.2", () => {
    const doc = parseResearchDocument(SAMPLE);
    assert.ok(doc.summary.includes("chain-of-thought"));
  });

  it("extracts two research stories", () => {
    const doc = parseResearchDocument(SAMPLE);
    assert.equal(doc.stories.length, 2);
  });

  it("parses RS-001 id, title, description, validationCriteria", () => {
    const { stories } = parseResearchDocument(SAMPLE);
    assert.equal(stories[0].id, "RS-001");
    assert.equal(stories[0].title, "Establish baseline performance");
    assert.ok(stories[0].description.includes("Reproduce gpt-4o"));
    assert.ok(stories[0].validationCriteria.includes("±1%"));
  });

  it("returns empty stories when section 10 is absent", () => {
    const doc = parseResearchDocument("# RD: Empty\n## 1. Research overview\n");
    assert.equal(doc.stories.length, 0);
  });

  it("returns Untitled Research when h1 is absent", () => {
    const doc = parseResearchDocument("## 1. Research overview\n");
    assert.equal(doc.title, "Untitled Research");
  });
});
