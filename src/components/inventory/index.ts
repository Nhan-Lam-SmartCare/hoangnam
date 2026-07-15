// Main entry point for inventory module
// This file re-exports all components for easy importing

// Types
export * from './types';

// Constants
export * from './constants';

// Modals
export * from './modals';

// Hooks (logic layer)
export * from './hooks';

// Sub-components (bảng, card mobile, toolbar, tabs, phân trang...)
export * from './components';

// Main component (orchestrator — refactor hoàn tất P1-P4)
export { default as InventoryManager } from './InventoryManager';
