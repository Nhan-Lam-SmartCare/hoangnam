# Maintainability Baseline

Date: 2026-04-09

## Summary

- Total lint warnings: 411
- Total lint errors: 0
- Files with warnings: 61

## Top Warning Rules

| Rule | Count |
| --- | ---: |
| @typescript-eslint/no-unused-vars | 197 |
| max-lines-per-function | 61 |
| complexity | 50 |
| no-case-declarations | 27 |
| react-hooks/exhaustive-deps | 25 |
| max-lines | 17 |
| no-useless-escape | 15 |
| @typescript-eslint/ban-ts-comment | 9 |
| no-empty | 4 |
| react-refresh/only-export-components | 3 |

## Top Files By Warning Count

| File | Count |
| --- | ---: |
| src\components\common\ScannerModal.tsx | 36 |
| src\components\service\ServiceManagerMobile.tsx | 31 |
| src\components\service\ServiceManager.legacy.tsx | 29 |
| src\components\service\WorkOrderMobileModal.tsx | 27 |
| src\components\dashboard\hooks\useDashboardData.ts | 24 |
| src\components\inventory\modals\GoodsReceiptModal.tsx | 24 |
| src\components\service\ServiceHistory.tsx | 23 |
| src\components\settings\SettingsManager.tsx | 21 |
| src\components\customer\CustomerManager.tsx | 18 |
| src\components\inventory\modals\InventoryHistoryModal.tsx | 15 |
| src\components\service\components\WorkOrderModal.tsx | 13 |
| src\components\admin\MigrationTool.tsx | 11 |
| src\components\inventory\components\GoodsReceiptModal.tsx | 11 |
| src\components\inventory\InventoryHistorySection.tsx | 9 |
| src\components\purchase-orders\PODetailView.tsx | 9 |

## Notes

- This baseline is used to track weekly warning reduction.
- Focus first on complexity, max-lines, and hook dependency warnings in core domains.
