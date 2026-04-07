import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import LoadingSpinner from "../common/LoadingSpinner";

export const RoleBasedRedirect: React.FC = () => {
    const { profile, loading, user } = useAuth();

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

    // Default landing page is Service
    if (profile?.role === "staff") {
        return <Navigate to="/service" replace />;
    }

    // Default for owner, manager, and others
    return <Navigate to="/service" replace />;
};
