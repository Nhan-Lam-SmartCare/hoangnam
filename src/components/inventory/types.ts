// Types for Inventory Manager
import type { Part, InventoryTransaction } from '../../../types';

export interface ReceiptItem {
    partId: string;
    partName: string;
    sku: string;
    quantity: number;
    importPrice: number;
    sellingPrice: number;
    wholesalePrice: number;
    _isNewProduct?: boolean;
    _productData?: {
        name: string;
        sku: string;
        barcode: string;
        category: string;
        description: string;
        importPrice: number;
        retailPrice: number;
        wholesalePrice: number;
    };
}

export interface PaymentInfo {
    paymentMethod: 'cash' | 'bank';
    paymentType: 'full' | 'partial' | 'note';
    paidAmount: number;
    discount: number;
}

export interface AddProductFormData {
    name: string;
    description: string;
    barcode: string;
    category: string;
    quantity: number;
    importPrice: number;
    retailPrice: number;
    warranty: number;
    warrantyUnit: string;
}

export interface InventoryStats {
    totalItems: number;
    totalValue: number;
    totalCost: number;
    lowStockCount: number;
    outOfStockCount: number;
    inStockCount: number;
}

export type StockFilter = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock';

export type FilterTheme = 'neutral' | 'success' | 'warning' | 'danger';

export interface FilterThemeStyles {
    buttonActive: string;
    buttonInactive: string;
    badgeActive: string;
    badgeInactive: string;
}

// Re-export for convenience
export type { Part, InventoryTransaction };
