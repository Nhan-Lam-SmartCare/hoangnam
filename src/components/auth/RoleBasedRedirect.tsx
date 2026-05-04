import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import LoadingSpinner from "../common/LoadingSpinner";

export const RoleBasedRedirect: React.FC = () => {
    const { profile, loading, user } = useAuth();
    const redirectMode = (import.meta.env.VITE_ROLE_REDIRECT_MODE || "legacy").toLowerCase();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <LoadingSpinner />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (redirectMode === "role") {
        if (profile?.role === "owner" || profile?.role === "manager") {
            return <Navigate to="/dashboard" replace />;
        }
        return <Navigate to="/service" replace />;
    }

    // Legacy default landing page
    return <Navigate to="/service" replace />;
};
