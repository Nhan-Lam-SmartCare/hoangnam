# Maintainability 30-Day Execution Plan

Date: 2026-04-09
Target score: 6.5 -> 8.0

## Current Status

- [x] Step 1: Lock quality gate in CI (lint + typecheck + build + critical integration test when secrets exist).
- [x] Step 2: Create warning baseline and tracking artifacts.
- [~] Step 3: Start safe refactor in Service domain (in progress).

## Weekly Plan

### Week 1 (Stabilize Quality Gates)

1. Keep CI gate green on every PR:
   - npm run lint
   - npm run typecheck
   - npm run build
   - npm run ci:test:critical (when Supabase secrets are available)
2. Establish baseline metrics from lint reports.
3. Publish top hotspot files and top warning rules.

Success criteria:
- PR cannot pass without lint/typecheck/build.
- Baseline report is generated and committed.

### Week 2 (Service Domain Refactor)

1. Continue slicing WorkOrder modal logic into domain modules/components.
2. Extract repeated validation/payment/save pieces to shared helpers.
3. Add or strengthen tests for payment/status edge-cases.

Success criteria:
- Reduce warnings in service components.
- Keep typecheck/test/build green after each slice.

### Week 3 (Inventory Domain Refactor)

1. Split large inventory history and receipt modules into subcomponents.
2. Remove low-value warnings (unused vars, case declaration issues).
3. Address hook dependency warnings in hot files.

Success criteria:
- Significant reduction in max-lines and complexity warnings for inventory modules.
- No regression in build or integration tests.

### Week 4 (Performance + Guardrails)

1. Introduce chunking strategy for heavy bundles (domain-based chunks).
2. Expand integration safety net for RLS + service payment + inventory movement.
3. Refresh docs/playbook for maintenance and debugging.

Success criteria:
- Fewer oversized chunks in build output.
- Core integration tests run reliably.

## Tracking Commands

- Generate baseline: npm run lint:baseline
- Typecheck: npm run typecheck
- Critical test: npm run ci:test:critical
- Build: npm run build

## Baseline Source

- docs/MAINTAINABILITY_BASELINE_2026-04-09.md
- reports/lint-baseline.json
