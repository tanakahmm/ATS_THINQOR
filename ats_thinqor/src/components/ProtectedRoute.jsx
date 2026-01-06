import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

export default function ProtectedRoute({ allowedRoles, children }) {
    const { user, isVerifying } = useSelector((state) => state.auth);

    // Use isVerifying to block rendering until initial session check is done.
    // Do NOT block on generic 'loading' which might be triggered by fetches inside the page.

    if (isVerifying) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) {
        // Not logged in or session expired
        return <Navigate to="/" replace />;
    }

    if (allowedRoles && allowedRoles.length > 0) {
        if (!allowedRoles.includes(user.role)) {
            // User logged in but wrong role. 
            // Redirect to their appropriate dashboard?
            // Or show a 403 page.
            return (
                <div className="flex flex-col items-center justify-center p-10 h-full">
                    <h2 className="text-2xl font-bold text-red-600">Access Denied</h2>
                    <p className="text-gray-600">You do not have permission to view this page.</p>
                </div>
            );
        }
    }

    // Authorized
    return children ? children : <Outlet />;
}
