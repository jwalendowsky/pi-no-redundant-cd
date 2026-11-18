import assert from "node:assert/strict";
import test from "node:test";
import { analyse } from "./estimate-savings.mjs";

const cwd = "/work/repo"; // does not exist, so paths compare lexically
const prefix = `cd ${cwd} && `; // 17 chars = 4.25 tokens
const P = prefix.length / 4;

function session(...entries) {
  return [{ type: "session", cwd }, ...entries].map((e) => JSON.stringify(e)).join("\n");
}
function request(usage, ...commands) {
  return {
    type: "message",
    message: {
      role: "assistant",
      usage,
      content: commands.map((command) => ({ type: "toolCall", name: "bash", arguments: { command } })),
    },
  };
}

test("output counts the prefix as written; later requests carry it as input", () => {
  const t = analyse(session(
    request({ input: 0, cacheRead: 100, cacheWrite: 0, output: 50 }, `${prefix}ls`, "pwd"),
    request({ input: 25, cacheRead: 75, cacheWrite: 0, output: 50 }, "ls"),
  ));
  assert.equal(t.bashCalls, 3);
  assert.equal(t.prefixedCalls, 1);
  assert.equal(t.saveOutput, P);
  // Second request re-sends P tokens, billed 25% fresh input, 75% cache read.
  assert.equal(t.saveInput, P * 0.25);
  assert.equal(t.saveCacheRead, P * 0.75);
  assert.equal(t.saveCacheWrite, 0);
});

test("cost uses each request's own per-token prices", () => {
  const t = analyse(session(
    // output costs 0.10 per token here.
    request({ input: 0, cacheRead: 100, cacheWrite: 0, output: 50, cost: { input: 0, cacheRead: 1, cacheWrite: 0, output: 5, total: 6 } }, `${prefix}ls`),
    // cache read costs 0.01 per token here.
    request({ input: 0, cacheRead: 100, cacheWrite: 0, output: 50, cost: { input: 0, cacheRead: 1, cacheWrite: 0, output: 5, total: 6 } }, "ls"),
  ));
  assert.equal(t.cost, 12);
  assert.ok(Math.abs(t.saveCost - (P * 0.1 + P * 0.01)) < 1e-12);
});

test("a compaction drops what was carried", () => {
  const t = analyse(session(
    request({ input: 0, cacheRead: 100, cacheWrite: 0, output: 50 }, `${prefix}ls`),
    { type: "compaction" },
    request({ input: 0, cacheRead: 100, cacheWrite: 0, output: 50 }, "ls"),
  ));
  assert.equal(t.saveCacheRead, 0);
});

test("a cd elsewhere or into a subdirectory is not counted", () => {
  const t = analyse(session(
    request({ input: 0, cacheRead: 100, cacheWrite: 0, output: 50 }, `cd ${cwd}/web && npm test`, "cd /tmp && ls", `ls && ${prefix}ls`),
  ));
  assert.equal(t.prefixedCalls, 0);
  assert.equal(t.saveOutput, 0);
});
