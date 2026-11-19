# Contributing

Thanks for looking. This is a small extension; most changes are a few lines in
`extensions/rule.ts` plus a test.

## Develop

```sh
git clone https://github.com/jwalendowsky/pi-no-redundant-cd
cd pi-no-redundant-cd
npm test    # node --test, no dependencies to install
```

To try a change inside pi, point pi at the checkout instead of the published
package:

```sh
pi -e ./pi-no-redundant-cd        # one-off run, not saved to settings
```

`extensions/rule.ts` is pure (built-in modules only) and holds all the logic, so
tests run under plain `node --test`. `extensions/index.ts` is the thin pi
adapter and is not unit-tested.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/). The prefix drives
the next version number, so it is not cosmetic:

| Prefix | Version bump |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` or `BREAKING CHANGE:` in the body | major |
| `docs:`, `test:`, `chore:`, `ci:` | none (still released in the next bump) |

## Releases

Releases are automated with
[release-please](https://github.com/googleapis/release-please):

1. Conventional commits land on `main` through a PR.
2. release-please opens (and keeps updating) a `chore: release x.y.z` PR with
   the version bump in `package.json` and the entry in `CHANGELOG.md`.
3. Merging that PR tags `vX.Y.Z`, creates the GitHub release, and the same
   workflow publishes to npm.

Nobody edits the version by hand. `CHANGELOG.md` is generated; the version
heading format (`## [0.1.0] - date`) is what pi reads to show "Extension
Updates" after an upgrade, so keep it.

### One-time npm setup

Publishing needs a credential. Prefer
[trusted publishing](https://docs.npmjs.com/trusted-publishers) (no long-lived
token):

```sh
# after the package exists on npm (first publish is manual):
# npmjs.com → package → Settings → Trusted publishing → GitHub Actions
#   repo: jwalendowsky/pi-no-redundant-cd, workflow: release.yml
```

Then delete the `NPM_TOKEN` secret and the `NODE_AUTH_TOKEN` env from
`.github/workflows/release.yml`. Until then, add a granular npm token with
publish rights as the `NPM_TOKEN` repository secret.

First publish of a brand-new name has to happen once from a machine:

```sh
npm login
npm publish
```

## What gets shipped

`package.json` → `files` decides the tarball. `npm pack --dry-run` shows it, and
CI runs the same command on every PR so a stale entry fails there instead of
for users.
