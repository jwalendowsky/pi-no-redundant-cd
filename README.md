# pi-no-redundant-cd

A [pi](https://pi.dev) extension that stops coding agents from prefixing bash
calls with `cd <the directory they are already in> &&`.

pi runs every bash call in a fresh shell started in the session's working
directory, so the prefix does nothing. It still costs output tokens and stays
in the context for the rest of the session. Telling the model not to do it
helps only partly. Across about 18,000 bash calls in one project's sessions,
48% started with a redundant `cd`; after an `AGENTS.md` rule against it, 30%
still did, and one agent run used it on 54 of 54 calls.

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
npm test    # node --test, no dependencies
```

## License

MIT
