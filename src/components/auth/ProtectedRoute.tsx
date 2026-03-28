import { Navigate } from "react-router-dom";
import { Ban } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import LoadingSpinner from "../common/LoadingSpinner";
import { showToast } from "../../utils/toast";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: ("owner" | "manager" | "staff" | "accountant")[];
}

export const ProtectedRoute = ({
  children,
  requiredRoles,
}: ProtectedRouteProps) => {
  const { user, profile, loading, error } = useAuth();

  // Show toast if auth/profile errored
  if (error) {
    showToast.error(error);
  }
  // Loading state while fetching initial auth/session or profile
  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <LoadingSpinner />
      </div>
    );
  }

  // Only redirect if there is truly no authenticated user
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && profile && !requiredRoles.includes(profile.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4 flex items-center justify-center gap-3">
            <Ban className="w-8 h-8 text-red-600 dark:text-red-400" />
            Không có quyền truy cập
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Bạn không có quyền truy cập trang này.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
