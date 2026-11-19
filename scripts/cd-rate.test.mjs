import assert from "node:assert/strict";
import test from "node:test";
import { session } from "./cd-rate.mjs";

const cwd = "/work/repo";
const prefix = `cd ${cwd} && `;

function log(...entries) {
  return [{ type: "session", cwd, timestamp: "2026-11-19T00:00:00.000Z" }, ...entries]
    .map((e) => JSON.stringify(e))
    .join("\n");
}
function bash(command) {
  return { type: "message", message: { role: "assistant", content: [{ type: "toolCall", name: "bash", arguments: { command } }] } };
}
function block() {
  return {
    type: "message",
    message: { role: "toolResult", isError: true, content: [{ type: "text", text: "Your shell already runs in /work/repo; ..." }] },
  };
}

test("counts bash calls and how many carried a redundant prefix", () => {
  const s = session(log(bash(`${prefix}ls`), bash("pwd"), bash(`cd /other && ls`)));
  assert.equal(s.bash, 3);
  assert.equal(s.redundant, 1, "only the cd into cwd counts");
  assert.equal(s.blocks, 0);
  assert.equal(s.started, "2026-11-19T00:00:00.000Z");
});

test("counts block markers only from error tool results", () => {
  assert.equal(session(log(block())).blocks, 1);
  // The same text in a non-error result is source code the model read, not a block.
  const quoted = {
    type: "message",
    message: { role: "toolResult", isError: false, content: [{ type: "text", text: "Your shell already runs in /work/repo; ..." }] },
  };
  assert.equal(session(log(quoted)).blocks, 0);
});
