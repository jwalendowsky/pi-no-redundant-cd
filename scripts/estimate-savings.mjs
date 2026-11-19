#!/usr/bin/env node
// Estimate the tokens a redundant `cd <cwd> &&` prefix costs in recorded pi
// sessions, which is what pi-no-redundant-cd can save.
//
// Usage: node scripts/estimate-savings.mjs [--json] [session.jsonl | dir]...
//        (default: ~/.pi/agent/sessions)
//
// How it estimates, per model request (assistant message with `usage`):
// - output: the prefix text the model wrote in that request's bash calls.
// - input: every prefix written by earlier requests in the same context is
//   re-sent with this request. pi records how the provider billed it, as fresh
//   input, cache read or cache write; the prefix tokens are split across those
//   three in the same proportion as the request's own prompt.
// - A compaction or context edit resets the running total, because it drops
//   or rewrites earlier messages.
// Tokens are approximated as characters / 4 (CHARS_PER_TOKEN). The text
// counted is the prefix exactly as written, e.g. `cd /long/path && `.
//
// This is an upper bound on what the extension saves: the first redundant cd
// of a session is still written once (it is refused), and the refusal adds
// one short tool result.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { realpathSync } from "node:fs";

const CHARS_PER_TOKEN = 4;
const LEADING_CD = /^\s*cd\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|"']+))\s*(&&|;)\s*/;

function canonical(path) {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path).replace(/\/+$/, "");
  }
}

export function redundantPrefix(command, cwd) {
  const m = command.match(LEADING_CD);
  if (!m) return "";
  let target = m[1] ?? m[2] ?? m[3];
  if (target === "~") target = homedir();
  else if (target.startsWith("~/")) target = homedir() + target.slice(1);
  if (!target.startsWith("/")) target = resolve(cwd, target);
  if (canonical(target) !== canonical(cwd)) return "";
  if (!command.slice(m[0].length).trim()) return "";
  return m[0];
}

function sessionFiles(args) {
  const roots = args.length ? args : [join(homedir(), ".pi", "agent", "sessions")];
  const out = [];
  const walk = (p) => {
    const st = statSync(p);
    if (st.isDirectory()) for (const name of readdirSync(p)) walk(join(p, name));
    else if (p.endsWith(".jsonl")) out.push(p);
  };
  for (const r of roots) walk(r);
  return out;
}

export function analyse(text) {
  const totals = { requests: 0, bashCalls: 0, prefixedCalls: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0, saveInput: 0, saveCacheRead: 0, saveCacheWrite: 0, saveOutput: 0, cost: 0, saveCost: 0 };
  let cwd = null;
  let carried = 0; // prefix tokens already in the context
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.type === "session") { cwd = e.cwd ?? null; carried = 0; continue; }
    if (e.type === "compaction" || e.type === "context_edit") { carried = 0; continue; }
    const m = e.message;
    if (!m || m.role !== "assistant" || !m.usage) continue;
    const u = m.usage;
    const prompt = (u.input ?? 0) + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0);
    totals.requests++;
    totals.input += u.input ?? 0;
    totals.cacheRead += u.cacheRead ?? 0;
    totals.cacheWrite += u.cacheWrite ?? 0;
    totals.output += u.output ?? 0;
    // Each token kind's price for this request, from pi's recorded cost.
    const k = u.cost ?? {};
    const rate = (cost, tokens) => (tokens > 0 && typeof cost === "number" ? cost / tokens : 0);
    totals.cost += typeof k.total === "number" ? k.total : 0;
    // Earlier prefixes re-sent with this request, split like the prompt itself.
    if (carried > 0 && prompt > 0) {
      const c = Math.min(carried, prompt);
      const si = c * (u.input ?? 0) / prompt, sr = c * (u.cacheRead ?? 0) / prompt, sw = c * (u.cacheWrite ?? 0) / prompt;
      totals.saveInput += si;
      totals.saveCacheRead += sr;
      totals.saveCacheWrite += sw;
      totals.saveCost += si * rate(k.input, u.input) + sr * rate(k.cacheRead, u.cacheRead) + sw * rate(k.cacheWrite, u.cacheWrite);
    }
    let written = 0;
    for (const part of Array.isArray(m.content) ? m.content : []) {
      if (part.type !== "toolCall" || part.name !== "bash") continue;
      totals.bashCalls++;
      const cmd = part.arguments?.command;
      if (typeof cmd !== "string" || !cwd) continue;
      const prefix = redundantPrefix(cmd, cwd);
      if (prefix) { totals.prefixedCalls++; written += prefix.length / CHARS_PER_TOKEN; }
    }
    const so = Math.min(written, u.output ?? written);
    totals.saveOutput += so;
    totals.saveCost += so * rate(k.output, u.output);
    carried += written;
  }
  return totals;
}

function pct(part, whole) {
  return whole > 0 ? (100 * part) / whole : 0;
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const files = sessionFiles(args.filter((a) => a !== "--json"));
  const sum = { sessions: 0, sessionsWithPrefix: 0 };
  for (const f of files) {
    const t = analyse(readFileSync(f, "utf8"));
    if (!t.requests) continue;
    sum.sessions++;
    if (t.prefixedCalls) sum.sessionsWithPrefix++;
    for (const [k, v] of Object.entries(t)) sum[k] = (sum[k] ?? 0) + v;
  }
  const report = {
    sessions: sum.sessions,
    sessionsWithPrefix: sum.sessionsWithPrefix,
    requests: sum.requests ?? 0,
    bashCalls: sum.bashCalls ?? 0,
    prefixedCalls: sum.prefixedCalls ?? 0,
    prefixedCallsPct: pct(sum.prefixedCalls, sum.bashCalls),
    tokens: {
      input: { total: sum.input ?? 0, saved: sum.saveInput ?? 0, pct: pct(sum.saveInput, sum.input) },
      cacheRead: { total: sum.cacheRead ?? 0, saved: sum.saveCacheRead ?? 0, pct: pct(sum.saveCacheRead, sum.cacheRead) },
      cacheWrite: { total: sum.cacheWrite ?? 0, saved: sum.saveCacheWrite ?? 0, pct: pct(sum.saveCacheWrite, sum.cacheWrite) },
      output: { total: sum.output ?? 0, saved: sum.saveOutput ?? 0, pct: pct(sum.saveOutput, sum.output) },
    },
    cost: { total: sum.cost ?? 0, saved: sum.saveCost ?? 0, pct: pct(sum.saveCost, sum.cost) },
  };
  if (json) { console.log(JSON.stringify(report, null, 2)); return; }
  const n = (x) => Math.round(x).toLocaleString("en-US");
  console.log(`Sessions: ${report.sessions} (${report.sessionsWithPrefix} with a redundant cd), model requests: ${n(report.requests)}`);
  console.log(`Bash calls: ${n(report.bashCalls)}, with a redundant cd: ${n(report.prefixedCalls)} (${report.prefixedCallsPct.toFixed(1)}%)`);
  console.log("");
  console.log("Token kind     Recorded         Prefix (est.)   Share");
  for (const [name, t] of Object.entries(report.tokens)) {
    console.log(`${name.padEnd(14)} ${n(t.total).padStart(16)} ${n(t.saved).padStart(15)}   ${t.pct.toFixed(2)}%`);
  }
  const c = report.cost;
  if (c.total > 0) console.log(`${"cost (USD)".padEnd(14)} ${c.total.toFixed(2).padStart(16)} ${c.saved.toFixed(2).padStart(15)}   ${c.pct.toFixed(2)}%`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
