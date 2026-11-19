# pi-no-redundant-cd

[![ci](https://github.com/jwalendowsky/pi-no-redundant-cd/actions/workflows/ci.yml/badge.svg)](https://github.com/jwalendowsky/pi-no-redundant-cd/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/pi-no-redundant-cd.svg)](https://www.npmjs.com/package/pi-no-redundant-cd)

A [pi](https://pi.dev) extension that stops coding agents from prefixing bash
calls with `cd <the directory they are already in> &&`.

pi runs every bash call in a fresh shell started in the session's working
directory, so the prefix does nothing. It still costs output tokens and stays
in the context for the rest of the session. Telling the model not to do it
helps only partly. Across about 18,000 bash calls in one project's sessions,
48% started with a redundant `cd`; after an `AGENTS.md` rule against it, 30%
still did, and one agent run used it on 54 of 54 calls.

## What it saves

Measured with `scripts/estimate-savings.mjs` (below) on 492 recorded pi
sessions: 39,006 model requests and 29,808 bash calls, over three months and
about 20 models.

| | Recorded | Redundant `cd` (est.) | Share |
|---|---:|---:|---:|
| Bash calls | 29,808 | 13,318 | **44.7%** |
| Output tokens | 20.9 M | 254 k | **1.21%** |
| Input tokens (uncached) | 1,594 M | 12.1 M | **0.76%** |
| Cache-read tokens | 4,184 M | 18.5 M | **0.44%** |
| Cache-write tokens | 49.9 M | 88 k | **0.18%** |
| Cost (USD, at each request's own prices) | $728.27 | $1.19 | **0.16%** |

The share is similar in each project: 1.0–1.3% of output tokens, 0.1–0.7% of
input.

In short, nearly half of all bash calls carried the prefix, but it is a small
share of tokens and cost. The main gains are commands you can read at a glance
and an agent that stops repeating itself, not a lower bill. With the extension
installed, a session pays for at most one prefixed call (the refused one) plus
a one-line refusal.

### Measure your own sessions

```sh
node scripts/estimate-savings.mjs                 # all of ~/.pi/agent/sessions
node scripts/estimate-savings.mjs <dir|file>...   # specific sessions
node scripts/estimate-savings.mjs --json          # machine-readable
```

For each model request, the script counts the prefix text the model wrote
(output). It then adds every earlier prefix in the same context to each later
request's prompt, split across fresh input, cache read and cache write in the
same proportion that request was billed. A compaction or context edit resets
that running total. Tokens are estimated as characters ÷ 4. Run it on sessions
from before you installed the extension; afterwards there is little left to
count.

## What it does

- The **first** bash call in a session that starts with a redundant `cd` is
  blocked with one line: *"Your shell already runs in /path; drop the leading
  `cd /path &&` and run the command as written."* Models usually stop after
  this.
- **Later** calls with the prefix are not blocked again. The prefix is removed
  and the command runs, so a model that keeps doing it costs no extra round
  trips.
- Everything else runs unchanged: a `cd` into a subdirectory or another
  directory, a `cd` that is not the first command, `cd dir || exit`, and a
  bare `cd dir`.

Paths are compared after resolving symlinks (on macOS the session directory is
`/private/tmp/x` while agents write `/tmp/x`), with `~`, `.`, quotes and a
trailing `/` handled.

## Install

```sh
pi install npm:pi-no-redundant-cd
```

Or from git:

```sh
pi install git:github.com/jwalendowsky/pi-no-redundant-cd
```

It applies to new sessions. There is nothing to configure.

## Is stripping safe?

Yes. pi's bash tool starts each call in a new shell in the session's working
directory, so a `cd` never carries over to the next call. When the target of a
leading `cd` already is that directory, removing it cannot change what the
command does.

## Develop

```sh
npm test    # node --test, no dependencies (extension and estimator)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for how changes are released. In short:
commits follow Conventional Commits, and release-please opens the version-bump
PR; merging it tags the repo and publishes to npm.

## License

MIT
