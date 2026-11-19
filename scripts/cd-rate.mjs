#!/usr/bin/env node
// Per-session redundant-cd rate, with the date, so before/after install can be
// compared. Reuses the detection from estimate-savings.mjs.
//
// Usage: node scripts/cd-rate.mjs [--json] [session.jsonl|dir]...
import { readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { redundantPrefix } from "./estimate-savings.mjs";

const BLOCK_MARK = "Your shell already runs in";

function walk(p, out = []) {
  const st = statSync(p);
  if (st.isDirectory()) for (const n of readdirSync(p)) walk(join(p, n), out);
  else if (p.endsWith(".jsonl")) out.push(p);
  return out;
}

export function session(text) {
  let cwd = null, started = null, blocks = 0, bash = 0, redundant = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.type === "session") { cwd = e.cwd ?? null; started = e.timestamp ?? started; continue; }
    const m = e.message;
    if (!m) continue;
    if (m.role === "toolResult" && m.isError) {
      const t = Array.isArray(m.content) ? m.content[0]?.text ?? "" : "";
      if (t.includes(BLOCK_MARK)) blocks++;
      continue;
    }
    if (m.role !== "assistant") continue;
    for (const part of Array.isArray(m.content) ? m.content : []) {
      if (part.type !== "toolCall" || part.name !== "bash") continue;
      bash++;
      const cmd = part.arguments?.command;
      if (typeof cmd === "string" && cwd && redundantPrefix(cmd, cwd)) redundant++;
    }
  }
  return { started, bash, redundant, blocks };
}

function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--json");
  const roots = args.length ? args : [join(homedir(), ".pi", "agent", "sessions")];
  const rows = [];
  for (const r of roots) for (const f of walk(r)) {
    const s = session(readFileSync(f, "utf8"));
    if (s.bash === 0) continue;
    rows.push({ file: f, ...s });
  }
  rows.sort((a, b) => String(a.started ?? "").localeCompare(String(b.started ?? "")));
  if (process.argv.includes("--json")) return console.log(JSON.stringify(rows, null, 1));
  const day = (r) => new Date(r.started).toISOString().slice(0, 10);
  const byDay = new Map();
  for (const r of rows) {
    const d = byDay.get(day(r)) ?? { bash: 0, redundant: 0, sessions: 0, blocks: 0 };
    d.bash += r.bash; d.redundant += r.redundant; d.sessions++; d.blocks += r.blocks;
    byDay.set(day(r), d);
  }
  console.log("date         sessions  bash  redundant   rate  blocks");
  for (const [d, v] of byDay) {
    console.log(`${d}  ${String(v.sessions).padStart(8)} ${String(v.bash).padStart(5)} ${String(v.redundant).padStart(9)}  ${(100 * v.redundant / v.bash).toFixed(1).padStart(5)}%  ${v.blocks}`);
  }
  console.log("\nsessions with a block marker:");
  for (const r of rows.filter((r) => r.blocks)) {
    console.log(`  ${new Date(r.started).toISOString()}  blocks=${r.blocks} bash=${r.bash} redundant=${r.redundant}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
