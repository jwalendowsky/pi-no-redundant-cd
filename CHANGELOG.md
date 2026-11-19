# Changelog

## [0.2.0](https://github.com/jwalendowsky/pi-no-redundant-cd/compare/v0.1.1...v0.2.0) (2026-11-19)


### Features

* **scripts:** add cd-rate.mjs to measure redundant cd rate per session ([73b1ecf](https://github.com/jwalendowsky/pi-no-redundant-cd/commit/73b1ecf633541428d9e5b39b46befaa625d2e45b))

## [0.1.1](https://github.com/jwalendowsky/pi-no-redundant-cd/compare/v0.1.0...v0.1.1) (2026-11-19)


### Bug Fixes

* **release:** publish via npm trusted publishing, use action v7 ([60a0686](https://github.com/jwalendowsky/pi-no-redundant-cd/commit/60a0686f590400cb59887cd562aa09320e2cd386))

## [0.1.0] - 2026-11-18

- First release: block the first redundant `cd <cwd> &&` in a session with a reason, strip later ones.
