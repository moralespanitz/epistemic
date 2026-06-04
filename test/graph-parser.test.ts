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

  it("parses RS-002 id and title", () => {
    const { stories } = parseResearchDocument(SAMPLE);
    assert.equal(stories[1].id, "RS-002");
    assert.equal(stories[1].title, "Test CoT prompting");
  });

  it("handles CRLF line endings", () => {
    const crlf = SAMPLE.replace(/\n/g, "\r\n");
    const doc = parseResearchDocument(crlf);
    assert.equal(doc.title, "CoT for Code");
    assert.equal(doc.stories.length, 2);
    assert.equal(doc.stories[0].id, "RS-001");
  });

  it("returns empty string for blank description field", () => {
    const content = `# RD: Test\n## 1. Research overview\n### 1.2 Research summary\nSummary.\n## 10. Research stories\n### 10.1. Story\n- **ID**: RS-001\n- **Description**: \n- **Validation criteria**: Must pass.\n`;
    const { stories } = parseResearchDocument(content);
    assert.equal(stories[0].description, "");
    assert.equal(stories[0].validationCriteria, "Must pass.");
  });

  it("defaults kind to hypothesis and parent to undefined", () => {
    const { stories } = parseResearchDocument(SAMPLE);
    assert.equal(stories[0].kind, "hypothesis");
    assert.equal(stories[0].parent, undefined);
  });

  it("parses Parent and Kind fields when present", () => {
    const content = `# RD: Test
## 10. Research stories
### 10.1. Root hypothesis
- **ID**: RS-001
- **Description**: The base claim.
- **Validation criteria**: x.
### 10.2. Ablation of RS-001
- **ID**: RS-002
- **Parent**: RS-001
- **Kind**: ablation
- **Description**: Remove component.
- **Validation criteria**: y.
`;
    const { stories } = parseResearchDocument(content);
    assert.equal(stories[1].id, "RS-002");
    assert.equal(stories[1].parent, "RS-001");
    assert.equal(stories[1].kind, "ablation");
  });
});
