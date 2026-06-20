export interface StoreSettings {
  id: string;
  store_name: string;
  store_name_en?: string;
  slogan?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  tax_code?: string;
  logo_url?: string;
  bank_qr_url?: string;
  primary_color?: string;
  business_hours?: string;
  established_year?: number;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  bank_branch?: string;
  invoice_prefix?: string;
  receipt_prefix?: string;
  work_order_prefix?: string;
  invoice_footer_note?: string;
  currency?: string;
  date_format?: string;
  timezone?: string;
  facebook?: string;
  print_paper_size_receipt?: string;
  print_paper_size_sales?: string;
  print_paper_size_warranty?: string;
  print_label_size_default?: string;
}

export interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: "owner" | "manager" | "staff";
  permissions?: PermissionMap;
  custom_permissions?: PermissionMap;
  permission_overrides?: PermissionMap;
  branch_id: string;
  department?: string;
  position?: string;
  base_salary?: number;
  created_at: string;
}

export interface Branch {
  id: string;
  name: string;
}

export type PermissionMap = Record<string, boolean>;
