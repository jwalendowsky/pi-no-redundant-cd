// Pure logic for the pi-no-redundant-cd extension. Dependency-free (node:
// built-ins only), so it loads under pi and under plain `node --test`.

import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, normalize, resolve } from "node:path";

// A leading `cd <dir> &&` or `cd <dir>;` (optionally quoted). Only the first
// segment is considered: a cd later in the command changes behaviour.
const LEADING_CD = /^\s*cd\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|"']+))\s*(&&|;)\s*/;

function sameDir(target: string, cwd: string): boolean {
  let path = target;
  if (path === "~") path = homedir();
  else if (path.startsWith("~/")) path = homedir() + path.slice(1);
  if (path === "." || path === "./") return true;
  if (!isAbsolute(path)) path = resolve(cwd, path);
  // Resolve symlinks: on macOS the session cwd is /private/tmp/x while agents
  // write /tmp/x.
  return canonical(path) === canonical(cwd);
}

function canonical(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return normalize(path).replace(/\/+$/, "");
  }
}

// redundantCd returns the command with a leading `cd <cwd> &&` removed, or
// null when the command does not start with a cd into the current directory.
export function stripRedundantCd(command: string, cwd: string): string | null {
  const m = command.match(LEADING_CD);
  if (!m) return null;
  const target = m[1] ?? m[2] ?? m[3];
  if (!target || !sameDir(target, cwd)) return null;
  const rest = command.slice(m[0].length);
  return rest.trim() ? rest : null;
}

export function blockReason(cwd: string): string {
  return `Your shell already runs in ${cwd}; drop the leading \`cd ${cwd} &&\` and run the command as written. ` +
    "Later commands with that prefix run with it removed.";
}

type BashCall = { toolName: string; input: { command?: unknown } };

// tool_call handler: block the first redundant cd of a session with a reason so
// the model learns, then silently strip later ones so a stubborn model costs no
// extra round trips. The cwd is read per call because a session can move.
export function makeHandler() {
  let warned = false;
  return (event: BashCall, cwd: string): { block: true; reason: string } | undefined => {
    if (event.toolName !== "bash" || typeof event.input.command !== "string") return undefined;
    const stripped = stripRedundantCd(event.input.command, cwd);
    if (stripped === null) return undefined;
    if (!warned) {
      warned = true;
      return { block: true, reason: blockReason(cwd) };
    }
    event.input.command = stripped;
    return undefined;
  };
}
