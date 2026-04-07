import React from "react";
import {
  LayoutDashboard,
  Wrench,
  ShoppingCart,
  Boxes,
  Users,
  BriefcaseBusiness,
  Landmark,
  HandCoins,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  Sun,
  Moon,
  Crown,
  UserCog,
  User,
  DollarSign,
  TrendingUp,
  Wallet,
  Package,
  Trash2,
  AlertTriangle,
  Trophy,
} from "lucide-react";

export type AppIconName =
  | "dashboard"
  | "service"
  | "sales"
  | "inventory"
  | "customers"
  | "employees"
  | "finance"
  | "debt"
  | "analytics"
  | "reports"
  | "settings"
  | "logout"
  | "sun"
  | "moon"
  | "owner"
  | "manager"
  | "staff"
  | "revenue"
  | "profit"
  | "cash"
  | "bank"
  | "package"
  | "trash"
  | "alert"
  | "trophy"
  | "handcoins";

const ICON_MAP: Record<AppIconName, React.ComponentType<any>> = {
  dashboard: LayoutDashboard,
  service: Wrench,
  sales: ShoppingCart,
  inventory: Boxes,
  customers: Users,
  employees: BriefcaseBusiness,
  finance: Landmark,
  debt: HandCoins,
  analytics: BarChart3,
  reports: FileText,
  settings: Settings,
  logout: LogOut,
  sun: Sun,
  moon: Moon,
  owner: Crown,
  manager: UserCog,
  staff: User,
  revenue: DollarSign,
  profit: TrendingUp,
  cash: Wallet,
  bank: Landmark,
  package: Package,
  trash: Trash2,
  alert: AlertTriangle,
  trophy: Trophy,
  handcoins: HandCoins,
};

export interface AppIconProps {
  name: AppIconName;
  className?: string;
}

export const AppIcon: React.FC<AppIconProps> = ({ name, className }) => {
  const Cmp = ICON_MAP[name];
  return <Cmp className={className} />;
};
