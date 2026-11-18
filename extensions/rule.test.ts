import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { makeHandler, stripRedundantCd } from "./rule.ts";

const cwd = "/Users/me/Development/repo";

test("strips a leading cd into the current directory", () => {
  assert.equal(stripRedundantCd(`cd ${cwd} && go test ./...`, cwd), "go test ./...");
  assert.equal(stripRedundantCd(`cd ${cwd}/ && ls`, cwd), "ls");
  assert.equal(stripRedundantCd(`cd "${cwd}" && ls`, cwd), "ls");
  assert.equal(stripRedundantCd(`cd '${cwd}'; ls`, cwd), "ls");
  assert.equal(stripRedundantCd(`  cd . && ls`, cwd), "ls");
  assert.equal(stripRedundantCd(`cd ~/x && ls`, `${homedir()}/x`), "ls");
});

test("matches through symlinks (macOS /tmp is /private/tmp)", () => {
  const dir = mkdtempSync(join(tmpdir(), "cdprobe-"));
  const link = dir + "-link";
  symlinkSync(dir, link);
  try {
    assert.equal(stripRedundantCd(`cd ${link} && ls`, realpathSync(dir)), "ls");
  } finally {
    rmSync(link);
    rmSync(dir, { recursive: true });
  }
});

test("leaves every other command alone", () => {
  assert.equal(stripRedundantCd(`cd ${cwd}/web && npm test`, cwd), null, "a subdirectory changes behaviour");
  assert.equal(stripRedundantCd(`cd /tmp && ls`, cwd), null);
  assert.equal(stripRedundantCd(`cd ${cwd}`, cwd), null, "a bare cd has nothing to run");
  assert.equal(stripRedundantCd(`cd ${cwd} || exit 1`, cwd), null, "only && and ; are equivalent");
  assert.equal(stripRedundantCd(`ls && cd ${cwd} && ls`, cwd), null, "only a leading cd");
  assert.equal(stripRedundantCd(`cd ${cwd}-other && ls`, cwd), null, "a sibling with a shared prefix");
  assert.equal(stripRedundantCd(`go test ./...`, cwd), null);
});

test("blocks the first redundant cd, then strips silently", () => {
  const handle = makeHandler();
  const first = { toolName: "bash", input: { command: `cd ${cwd} && go build ./...` } };
  const blocked = handle(first, cwd);
  assert.equal(blocked?.block, true);
  assert.match(blocked!.reason, /already runs in/);
  assert.equal(first.input.command, `cd ${cwd} && go build ./...`, "a blocked call is not rewritten");

  const second = { toolName: "bash", input: { command: `cd ${cwd} && go test ./...` } };
  assert.equal(handle(second, cwd), undefined);
  assert.equal(second.input.command, "go test ./...");
});

test("ignores other tools and unrelated commands", () => {
  const handle = makeHandler();
  const read = { toolName: "read", input: { command: `cd ${cwd} && ls` } };
  assert.equal(handle(read, cwd), undefined);
  const plain = { toolName: "bash", input: { command: "ls" } };
  assert.equal(handle(plain, cwd), undefined);
  assert.equal(plain.input.command, "ls");
  // A plain command does not use up the one-time warning.
  assert.equal(handle({ toolName: "bash", input: { command: `cd ${cwd} && ls` } }, cwd)?.block, true);
});
