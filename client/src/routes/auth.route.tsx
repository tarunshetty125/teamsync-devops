// src/routes/auth.route.tsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { DashboardSkeleton } from "@/components/skeleton-loaders/dashboard-skeleton";
import useAuth from "@/hooks/api/use-auth";
import Landing from "@/page/Landing";
import { isAuthRoute, AUTH_ROUTES } from "./common/routePaths";

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
    } catch (e) {
      // ignore localStorage errors (e.g., SSR or blocked)
    }
    return <Navigate to={`workspace/${user.currentWorkspace?._id}`} replace />;
  }

  // Not logged in: show Landing *only* when user is at the Sign-In root ("/")
  // and hasn't expressed intent to view the auth UI for this session.
  const showAuth = sessionStorage.getItem("showAuth") === "true";
  const isSignInRoute = location.pathname === AUTH_ROUTES.SIGN_IN;

  if (isSignInRoute && !showAuth) {
    return <Landing />;
  }

  // Otherwise render nested auth routes (SignIn / SignUp / OAuth callback)
  return <Outlet />;
};

export default AuthRoute;
