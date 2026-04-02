import React, { useEffect, useState, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "./components/common/ErrorBoundary";
import TopProgressBar from "./components/common/TopProgressBar";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AppProvider } from "./contexts/AppContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import "./index.css";
import { LoginPage } from "./components/auth/LoginPage";
import { ResetPasswordPage } from "./components/auth/ResetPasswordPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { RoleBasedRedirect } from "./components/auth/RoleBasedRedirect";
import { useAppContext } from "./contexts/AppContext";
import { BottomNav, Nav } from "./components/layout";
import { ShopLayout } from "./components/layout/ShopLayout";
import Dashboard from "./components/dashboard/Dashboard";
import RepoErrorPanel from "./components/common/RepoErrorPanel";
import { lazyImport } from "./utils/lazyImport";
import { canAccessInventorySection } from "./utils/inventoryAccess";

// Lazy load large components for code splitting
// Lazy load large components for code splitting
const InventoryManager = lazyImport(
  () => import("./components/inventory/InventoryManager")
);

const ServiceManager = lazyImport(
  () => import("./components/service/ServiceManager")
);
const WarrantyManager = lazyImport(
  () => import("./components/warranty/WarrantyManager").then((m) => ({
    default: m.WarrantyManager,
  }))
);
const ServiceHistory = lazyImport(() =>
  import("./components/service/ServiceHistory").then((m) => ({
    default: m.ServiceHistory,
  }))
);
const CustomerManager = lazyImport(
  () => import("./components/customer/CustomerManager")
);

const CategoriesManager = lazyImport(
  () => import("./components/categories/CategoriesManager")
);
const LookupManager = lazyImport(() => import("./components/lookup/LookupManager"));
const MigrationTool = lazyImport(() => import("./components/admin/MigrationTool"));
const ReportsOverview = lazyImport(() => import("./components/reports/ReportsOverview"));
const SettingsManager = lazyImport(() =>
  import("./components/settings/SettingsManager").then((m) => ({
    default: m.SettingsManager,
  }))
);
const EmployeesManager = lazyImport(
  () => import("./components/employees/EmployeesManager")
);
const StaffDashboard = lazyImport(() =>
  import("./components/dashboard/StaffDashboard").then((m) => ({
    default: m.StaffDashboard,
  }))
);

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

// Finance, Sales, Reports components removed

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
      retry: 2,
    },
  },
});

// Attach global error handlers using built-in callbacks by extending QueryCache/MutationCache
// Simplified: we rely on per-query onError via a wrapper helper if needed; fallback here is noop.

// MainLayout components
const Inventory = () => (
  <Suspense fallback={<PageLoader />}>
    <InventoryManager />
  </Suspense>
);
const Service = () => (
  <Suspense fallback={<PageLoader />}>
    <ServiceManager />
  </Suspense>
);
const ServiceHistoryPage = () => {
  const { currentBranchId } = useAppContext();
  return (
    <Suspense fallback={<PageLoader />}>
      <ServiceHistory currentBranchId={currentBranchId} />
    </Suspense>
  );
};
const Customers = () => (
  <Suspense fallback={<PageLoader />}>
    <CustomerManager />
  </Suspense>
);
const CategoriesPage = () => (
  <Suspense fallback={<PageLoader />}>
    <CategoriesManager />
  </Suspense>
);
const LookupPage = () => (
  <Suspense fallback={<PageLoader />}>
    <LookupManager />
  </Suspense>
);
const SettingsPage = () => (
  <Suspense fallback={<PageLoader />}>
    <SettingsManager />
  </Suspense>
);
const StaffDashboardPage = () => (
  <Suspense fallback={<PageLoader />}>
    <StaffDashboard />
  </Suspense>
);
const ReportsPage = () => (
  <Suspense fallback={<PageLoader />}>
    <ReportsOverview />
  </Suspense>
);
const EmployeesPage = () => (
  <Suspense fallback={<PageLoader />}>
    <EmployeesManager />
  </Suspense>
);
const MigrationPage = () => (
  <Suspense fallback={<PageLoader />}>
    <MigrationTool />
  </Suspense>
);
const WarrantyPage = () => (
  <Suspense fallback={<PageLoader />}>
    <WarrantyManager />
  </Suspense>
);


const MainLayout: React.FC = () => {
  const location = useLocation();
  const isShopPage = false; // Public shop pages removed
  const isWidePage = [
    "/service",
    "/service-history",
    "/inventory",
    "/customers",
    "/employees",
    "/settings",
    "/warranty",
    "/categories",
    "/lookup",
  ].some((path) => location.pathname.startsWith(path));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors pb-20 md:pb-0 relative overflow-hidden">
      {!isShopPage && <Nav />}
      <main
        className={
          isWidePage
            ? "w-full px-0 md:px-4 lg:px-5"
            : "max-w-[1600px] mx-auto p-0 md:p-6"
        }
      >
        <Routes>
          <Route path="/" element={<RoleBasedRedirect />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requiredRoles={["owner", "manager"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff-dashboard"
            element={
              <ProtectedRoute requiredRoles={["staff"]}>
                <StaffDashboardPage />
              </ProtectedRoute>
            }
          />
          {/* Sales, Delivery routes removed */}
          <Route
            path="/inventory"
            element={
              <ProtectedRoute
                allow={({ profile, user }) =>
                  canAccessInventorySection(profile, user)
                }
                denyMessage="Chỉ quản lý kho, nhân viên bán hàng, quản lý hoặc chủ cửa hàng mới được vào Kho."
              >
                <Inventory />
              </ProtectedRoute>
            }
          />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/lookup" element={<LookupPage />} />
          <Route path="/service" element={<Service />} />
          <Route path="/service-history" element={<ServiceHistoryPage />} />
          <Route path="/warranty" element={<WarrantyPage />} />
          <Route path="/customers" element={<Customers />} />
          <Route
            path="/employees"
            element={
              <ProtectedRoute requiredRoles={["owner", "manager"]}>
                <EmployeesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute requiredRoles={["owner", "manager"]}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/migration"
            element={
              <ProtectedRoute requiredRoles={["owner"]}>
                <Suspense fallback={<PageLoader />}>
                  <MigrationTool />
                </Suspense>
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      {/* Bottom Navigation for Mobile */}
      {!isShopPage && <BottomNav />}
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AppProvider>
            <BrowserRouter>
              <ErrorBoundary>
                <TopProgressBar />
                <Routes>
                  {/* Public Routes - No authentication */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route
                    path="/reset-password"
                    element={<ResetPasswordPage />}
                  />

                  {/* Public Shop Pages - No authentication required */}
                  {/* Public Shop Pages removed */}

                  {/* Protected Routes - Require authentication */}
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <MainLayout />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
                <ReactQueryDevtools initialIsOpen={false} />
                {/* Dev-only repository error panel */}
                {import.meta.env.DEV && <RepoErrorPanel />}
              </ErrorBoundary>
            </BrowserRouter>
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
