# Nyungwe Nexus QA Report

**Date:** 2 September 2026

**Submission branch:** `nyungwe-nexus-ci-qa`

**Feature branch:** `qa/ci-pipeline`

## Automated quality pipeline

The GitHub Actions workflow in `.github/workflows/ci.yml` runs on every push and pull request. It uses Node.js 22 and performs these steps in order:

1. checks out the repository;
2. installs the exact lockfile dependencies with `npm ci`;
3. runs ESLint with `--max-warnings 0`;
4. regenerates Cloudflare Worker binding types;
5. type-checks the React and Worker projects;
6. executes the Vitest unit tests;
7. creates the Vite production build; and
8. validates the Cloudflare deployment bundle with a Wrangler dry run.

This makes lint failures, type errors, broken tests, build failures, and invalid deployment configuration visible before changes are merged.

## Unit tests

The four unit tests in `tests/validation.test.ts` target the untrusted observation-input boundary and authorisation-header parser.

| Test | Behaviour verified |
| --- | --- |
| Valid observation | Accepts the allowlisted study schema and trims surrounding note whitespace. |
| Location and category validation | Rejects precise/unapproved locations and unsupported severity values. |
| Date and length validation | Rejects impossible calendar dates, short notes, and notes beyond 500 characters. |
| Bearer token parser | Accepts the case-insensitive Bearer scheme and rejects missing, raw, null, or multi-part credentials. |

Final result: **1 test file passed; 4 tests passed** in 122 ms. The tests are intentionally concentrated on trust-boundary logic rather than presentational components.

## Lint and code-style findings

ESLint 10 uses a flat configuration in `eslint.config.js`, combining the recommended ESLint, typescript-eslint, and React Hooks rules. Generated files and build output are ignored. The first lint run found two errors and no warnings:

1. `TooltipTriggerProps` was an empty interface equivalent to its parent type. It was replaced with a direct type alias, removing an unnecessary declaration.
2. The dashboard loaded data by calling a state-updating function directly from an effect. The loader was separated into an abortable fetch function; the effect now cancels the request during unmount and updates state from the asynchronous completion handler.

After correction, `npm run lint` completed with **0 errors and 0 warnings**. CI treats any future warning as a failure.

## Code-review summary

A manual correctness and security review traced the public dashboard and protected observation flow from the React form through request parsing, authentication, validation, prepared SQL, and public response projection. Earlier review findings led to exact calendar-date validation, strict Bearer-header parsing, bounded request bodies, private note exclusion from public queries, and a Content Security Policy compatible with the chart library. A repository secret scan found no credentials; only the documented `.dev.vars.example` placeholder is versioned.

The CodeRabbit CLI was installed but signed out, so an external CodeRabbit review was not claimed. This limitation is recorded rather than presenting an unavailable review as evidence.

## Final local results

| Check | Result |
| --- | --- |
| `npm run lint` | Passed — 0 warnings/errors |
| `npm run typecheck` | Passed |
| `npm test` | Passed — 4/4 tests |
| `npm run build` | Passed |
| Dependency audit | 0 known vulnerabilities reported by npm |

Vite reports a non-blocking large-chunk advisory for the chart-heavy dashboard. The JavaScript output is approximately 222 kB compressed. Code splitting should be added only if measurements on constrained devices show that initial loading is unacceptable.

## Version-control evidence

Development was performed on `qa/ci-pipeline`, branched from `nyungwe-nexus-ci-qa`. The completed feature commit was merged back with a non-fast-forward merge, preserving the branch boundary in `git log --graph`. The final submission branch is pushed to the separate `gmc_ci_qa` repository without changing its existing `main` branch.
