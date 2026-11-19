# Security

This extension rewrites the `command` of a `bash` tool call before pi runs it.
That is the only thing it does, and a bug there could change what a shell
executes.

It only ever acts on a command whose first segment is `cd <the session working
directory> &&` (or `;`), and only after resolving that path to the same
directory, symlinks included. A command that is not that is left byte-for-byte
unchanged. `extensions/rule.ts` holds all the logic and is covered by
`npm test`; read it before trusting it.

Report a case where a command is rewritten and should not have been — or the
reverse — through
[the issue form](https://github.com/jwalendowsky/pi-no-redundant-cd/issues/new?template=bug.yml).
Include the command, the session working directory and the pi version.
