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

Nobody edits the version by hand. `CHANGELOG.md` is generated; release-please's
heading format (`## [1.2.0](compare-link) (date)`) is parsed by pi to show
"Extension Updates" after an upgrade, so keep it.

### One-time npm setup

Publishing uses
[trusted publishing](https://docs.npmjs.com/trusted-publishers): npm exchanges
the workflow's OIDC token for publish rights, so no long-lived token exists and
every release gets a provenance attestation. Run this once from a machine
logged in to npm as a package owner:

```sh
npm trust github pi-no-redundant-cd \
  --file release.yml \
  --repo jwalendowsky/pi-no-redundant-cd \
  --allow-publish
npm trust list pi-no-redundant-cd   # verify
```

The workflow file name must be the bare `release.yml`, not a path. If it is
missing or misnamed, the publish job fails with an authentication error while
everything else stays green.

### When a publish fails

A release PR can be merged while publishing is broken (no trusted publisher
configured, npm outage, a revoked credential). That leaves a git tag and a
GitHub release with no matching npm version. Do not add an empty commit — the
version is already tagged, so release-please has nothing new to release.

Re-run the workflow from the Actions tab with **publish** checked, or:

```sh
gh workflow run release.yml --ref main -f publish=true
```

The publish job skips itself when npm already has `package.json`'s version, so
this is safe to re-run. After publishing, give npm up to a minute before
`npm view` reports the new version; the registry read replicas lag.

## What gets shipped

`package.json` → `files` decides the tarball. `npm pack --dry-run` shows it, and
CI runs the same command on every PR so a stale entry fails there instead of
for users.
