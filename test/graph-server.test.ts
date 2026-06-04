import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startGraphServer, type GraphServer } from "../src/graph/server.js";

let server: GraphServer;
before(async () => { server = await startGraphServer(process.cwd(), Date.now()); });
after(() => server.close());

describe("graph server", () => {
  it("serves HTML on /", async () => {
    const res = await fetch(server.url + "/");
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes("epistemic"));
    assert.ok(text.includes("svg"));
  });

  it("returns JSON on GET /api/state", async () => {
    const res = await fetch(server.url + "/api/state");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok("root" in data && "nodes" in data && "edges" in data);
  });

  it("returns 204 on valid POST /api/event", async () => {
    const res = await fetch(server.url + "/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "new-research" }),
    });
    assert.equal(res.status, 204);
  });

  it("rejects unknown event types with 400", async () => {
    const res = await fetch(server.url + "/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "evil-inject" }),
    });
    assert.equal(res.status, 400);
  });

  it("rejects oversized bodies with 413", async () => {
    const res = await fetch(server.url + "/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "x".repeat(65 * 1024),
    });
    assert.equal(res.status, 413);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await fetch(server.url + "/unknown");
    assert.equal(res.status, 404);
  });

  it("rejects non-localhost origin with 403", async () => {
    const res = await fetch(server.url + "/api/state", {
      headers: { "Origin": "http://evil.com" },
    });
    assert.equal(res.status, 403);
  });

  it("returns 204 for OPTIONS preflight", async () => {
    const res = await fetch(server.url + "/api/state", { method: "OPTIONS" });
    assert.equal(res.status, 204);
  });

  it("rejects invalid JSON body with 400", async () => {
    const res = await fetch(server.url + "/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not valid json",
    });
    assert.equal(res.status, 400);
  });

  it("eventReader is returned and has a read() method", () => {
    assert.equal(typeof server.eventReader.read, "function");
  });
});
