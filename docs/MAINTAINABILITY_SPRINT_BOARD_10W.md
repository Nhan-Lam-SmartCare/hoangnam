# Maintainability Sprint Board (10 Weeks)

Date: 2026-04-10
Scope: Motocare app stabilization, maintainability, upgrade readiness

## 1) Target Outcomes

- Keep CI green continuously on lint, typecheck, build, and critical integration.
- Restore test reliability to 100% pass on critical paths.
- Reduce lint warnings from 388 to < 250 by week 6.
- Remove large chunk warning from production build by week 10.
- Lower bug fix lead time and keep rollback rate near 0.

## 2) Priority Definitions

- P0: Must-do in current sprint; release risk if missed.
- P1: Important and planned for current/next sprint.
- P2: Improvement, can be deferred if capacity is tight.

## 3) Team Rhythm

- Monday: Sprint planning and hotspot selection.
- Wednesday: Mid-week KPI checkpoint and blocker handling.
- Friday: Demo, KPI update, and next sprint lock.

## 4) Guardrails (Apply Every Week)

- PR must pass CI gates before merge.
- No increase in total lint warnings week-over-week.
- Any touched hotspot file must not add new complexity warnings.
- Every dependency update must be isolated in a dedicated PR.

## 5) Sprint Plan

## Weeks 1-2: Stabilize Foundation

### Sprint W1

- P0-S1-001: Fix current failing unit test in tax calculation.
  - Owner: FE + Domain logic
  - Output: All current test files pass except explicitly skipped tests.
  - DoD: `npm test` has 0 failed tests.
- P0-S1-002: Classify skipped tests into `critical` and `non-critical`.
  - Owner: QA + FE
  - Output: A list of skipped tests with business impact tags.
  - DoD: Critical skipped tests identified and estimated.
- P0-S1-003: Enforce branch protection to require CI checks.
  - Owner: Tech Lead
  - Output: Main branch cannot merge without required checks.
  - DoD: At least lint, typecheck, build are mandatory.
- P1-S1-004: Add PR checklist for quality and rollback risk.
  - Owner: Tech Lead
  - Output: Checklist used in all PR descriptions.
  - DoD: 100% new PRs include checklist.

### Sprint W2

- P0-S2-001: Re-enable critical skipped tests for sales, service, inventory, permissions.
  - Owner: FE + QA
  - Output: Critical test set active in CI/local run.
  - DoD: Critical test suite pass rate 100%.
- P0-S2-002: Add smoke test script for top business flows.
  - Owner: QA Automation
  - Output: One command to validate high-risk flows.
  - DoD: Smoke script runs in CI and local.
- P1-S2-003: Define weekly dependency update policy (patch/minor only).
  - Owner: Tech Lead
  - Output: Written policy and review owner.
  - DoD: First weekly dependency PR merged safely.

## Weeks 3-6: Reduce Hotspot Technical Debt

### Sprint W3

- P0-S3-001: Clean low-risk lint warnings in top 5 hotspot files.
  - Focus: `@typescript-eslint/no-unused-vars`, `no-case-declarations`.
  - Output: Warning count drop by at least 40.
  - DoD: No behavior changes, tests still green.
- P1-S3-002: Add baseline trend report update script.
  - Output: Weekly delta report (warnings by file, by rule).
  - DoD: Report generated every Friday.

### Sprint W4

- P0-S4-001: Refactor one large service module into domain slices.
  - Suggested target: service manager mobile/desktop shared logic.
  - Output: Business logic extracted to hooks/services.
  - DoD: Complexity and max-lines warnings reduced in target file.
- P1-S4-002: Add focused regression tests around payment/refund/state transitions.
  - Output: Guard tests for service edge cases.
  - DoD: New tests pass and catch at least one prior edge path.

### Sprint W5

- P0-S5-001: Refactor one large inventory module into smaller components.
  - Suggested target: goods receipt or inventory history area.
  - Output: UI section split into testable modules.
  - DoD: Target file line count reduced significantly.
- P1-S5-002: Fix hook dependency warnings in top dashboard/service hooks.
  - Output: Reduced `react-hooks/exhaustive-deps` warnings.
  - DoD: No stale state regressions in smoke tests.

### Sprint W6

- P0-S6-001: Reach lint milestone under 250 warnings.
  - Output: Lint report below threshold.
  - DoD: `warnings < 250`, `errors = 0`.
- P1-S6-002: Freeze hotspots and document module boundaries.
  - Output: Short architecture notes for refactored domains.
  - DoD: New code follows documented boundaries.

## Weeks 7-10: Platform Upgrades and Performance

### Sprint W7

- P0-S7-001: Upgrade test stack cluster.
  - Includes: vitest, testing-library, playwright (minor-first).
  - Output: Updated lockfile and compatibility fixes.
  - DoD: Full test command set green.
- P1-S7-002: Remove deprecated test API usage (`ReactDOMTestUtils.act`).
  - Output: Test warnings reduced.
  - DoD: No act deprecation warning in core tests.

### Sprint W8

- P0-S8-001: Upgrade lint stack cluster.
  - Includes: eslint, typescript-eslint, react-hooks plugin (safe sequence).
  - Output: Updated lint config and rule compatibility.
  - DoD: Lint pipeline stable with no new blocking errors.
- P1-S8-002: Tune rule severities for progressive adoption.
  - Output: Agreed strictness map for P0/P1/P2 rules.
  - DoD: Team adoption without CI instability.

### Sprint W9

- P0-S9-001: Upgrade runtime/UI stack cluster.
  - Includes: react-router-dom, react-query, supabase-js, vite (minor-first).
  - Output: Compatibility fixes and migration notes.
  - DoD: Smoke + regression tests pass.
- P1-S9-002: Add rollback playbook for dependency upgrades.
  - Output: Fast rollback steps for failed releases.
  - DoD: Drill completed once.

### Sprint W10

- P0-S10-001: Implement chunk optimization for heavy modules.
  - Methods: dynamic import and manual chunks.
  - Output: Build without large chunk warning.
  - DoD: No chunk > warning threshold in production build output.
- P1-S10-002: Performance verification and final release candidate.
  - Output: Before/after bundle and load summary.
  - DoD: Improved initial load and no core flow regression.

## 6) KPI Dashboard (Weekly)

- Lint: total warnings, new warnings this week, files with >10 warnings.
- Tests: pass rate, skipped test count, flaky count.
- Build: build success rate, large chunk warnings, build duration.
- Delivery: median bug fix lead time, rollback count, hotfix count.

## 7) Weekly Reporting Template

- Week: YYYY-WW
- Planned tasks: [ticket IDs]
- Completed tasks: [ticket IDs]
- KPI snapshot:
  - lint warnings:
  - test pass rate:
  - skipped tests:
  - large chunk warnings:
  - lead time:
- Risks/blockers:
- Actions next week:

## 8) Suggested First Ticket Order (Immediate)

1. P0-S1-001
2. P0-S1-002
3. P0-S1-003
4. P0-S2-001
5. P0-S2-002
6. P0-S3-001
