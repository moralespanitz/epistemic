import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { makeEventReader } from "../src/graph/events.js";

describe("readGraphEvents", () => {
  it("returns empty array when events file does not exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "epistemic-test-"));
    const reader = makeEventReader(dir, Date.now());
    const events = await reader.read();
    assert.deepEqual(events, []);
  });

  it("returns events written after serverStartTime", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ep-ev-"));
    await mkdir(join(dir, ".epistemic"), { recursive: true });
    const startTime = Date.now();
    const oldEvent = JSON.stringify({ type: "new-research", timestamp: startTime - 5000 });
    const newEvent = JSON.stringify({ type: "open-hypothesis", id: "RS-001", timestamp: startTime + 100 });
    await writeFile(join(dir, ".epistemic/graph-events.jsonl"), `${oldEvent}\n${newEvent}\n`);

    const reader = makeEventReader(dir, startTime);
    const events = await reader.read();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "open-hypothesis");
  });

  it("does not return same events twice (cursor advances)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ep-ev2-"));
    await mkdir(join(dir, ".epistemic"), { recursive: true });
    const startTime = Date.now() - 1000;
    const event = JSON.stringify({ type: "new-research", timestamp: startTime + 100 });
    await writeFile(join(dir, ".epistemic/graph-events.jsonl"), `${event}\n`);

    const reader = makeEventReader(dir, startTime);
    await reader.read();
    const second = await reader.read();
    assert.deepEqual(second, []);
  });

  it("ignores lines with unknown event types", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ep-ev3-"));
    await mkdir(join(dir, ".epistemic"), { recursive: true });
    const startTime = Date.now() - 1000;
    const bad = JSON.stringify({ type: "inject-malicious", timestamp: startTime + 100 });
    await writeFile(join(dir, ".epistemic/graph-events.jsonl"), `${bad}\n`);

    const reader = makeEventReader(dir, startTime);
    const events = await reader.read();
    assert.deepEqual(events, []);
  });

  it("returns only new events after file grows (cursor advances correctly)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ep-ev4-"));
    await mkdir(join(dir, ".epistemic"), { recursive: true });
    const startTime = Date.now() - 1000;
    const event1 = JSON.stringify({ type: "new-research", timestamp: startTime + 100 });
    const eventsFile = join(dir, ".epistemic/graph-events.jsonl");
    await writeFile(eventsFile, `${event1}\n`);

    const reader = makeEventReader(dir, startTime);
    const first = await reader.read();
    assert.equal(first.length, 1);

    // Append a new event
    const { appendFile } = await import("node:fs/promises");
    const event2 = JSON.stringify({ type: "open-hypothesis", id: "RS-001", timestamp: startTime + 200 });
    await appendFile(eventsFile, `${event2}\n`);

    const second = await reader.read();
    assert.equal(second.length, 1);
    assert.equal(second[0].type, "open-hypothesis");
  });

  it("skips malformed JSON lines and returns valid events", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ep-ev5-"));
    await mkdir(join(dir, ".epistemic"), { recursive: true });
    const startTime = Date.now() - 1000;
    const good = JSON.stringify({ type: "new-research", timestamp: startTime + 100 });
    await writeFile(join(dir, ".epistemic/graph-events.jsonl"), `{bad json\n${good}\n`);

    const reader = makeEventReader(dir, startTime);
    const events = await reader.read();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "new-research");
  });

  it("includes events where timestamp exactly equals serverStartTime", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ep-ev6-"));
    await mkdir(join(dir, ".epistemic"), { recursive: true });
    const startTime = 1000000;
    const event = JSON.stringify({ type: "new-research", timestamp: startTime });
    await writeFile(join(dir, ".epistemic/graph-events.jsonl"), `${event}\n`);

    const reader = makeEventReader(dir, startTime);
    const events = await reader.read();
    assert.equal(events.length, 1);
  });
});
