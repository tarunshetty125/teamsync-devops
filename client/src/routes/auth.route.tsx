// src/routes/auth.route.tsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { DashboardSkeleton } from "@/components/skeleton-loaders/dashboard-skeleton";
import useAuth from "@/hooks/api/use-auth";
import { isAuthRoute } from "./common/routePaths";

const AuthRoute: React.FC = () => {
  const location = useLocation();
  const { data: authData, isLoading } = useAuth();
  const user = authData?.user;

  const _isAuthRoute = isAuthRoute(location.pathname);

  // Show skeleton while auth state is loading — but not when we're already on auth pages
  if (isLoading && !_isAuthRoute) return <DashboardSkeleton />;

  // If logged in -> persist id and redirect to user's current workspace
  if (user) {
    try {
      localStorage.setItem("userid", user._id);
    } catch {
      return <Navigate to={`workspace/${user.currentWorkspace?._id}`} replace />;
    }
    return <Navigate to={`workspace/${user.currentWorkspace?._id}`} replace />;
  }

  return <Outlet />;
};

export default AuthRoute;
