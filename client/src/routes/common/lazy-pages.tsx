import { lazy } from "react";

export const GoogleOAuthFailure = lazy(
  () => import("@/page/auth/GoogleOAuthFailure")
);
export const SignIn = lazy(() => import("@/page/auth/Sign-in"));
export const SignUp = lazy(() => import("@/page/auth/Sign-up"));
export const WorkspaceDashboard = lazy(() => import("@/page/workspace/Dashboard"));
export const Members = lazy(() => import("@/page/workspace/Members"));
export const ProjectDetails = lazy(
  () => import("@/page/workspace/ProjectDetails")
);
export const Settings = lazy(() => import("@/page/workspace/Settings"));
export const Profile = lazy(() => import("@/page/workspace/Profile"));
export const Tasks = lazy(() => import("@/page/workspace/Tasks"));
export const Calendar = lazy(() => import("@/page/workspace/Calendar"));
export const Timeline = lazy(() => import("@/page/workspace/timeline-page"));
export const Roadmap = lazy(() => import("@/page/workspace/roadmap-page"));
export const Gantt = lazy(() => import("@/page/workspace/gantt-page"));
export const Productivity = lazy(() => import("@/page/workspace/productivity-page"));
export const InviteUser = lazy(() => import("@/page/invite/InviteUser"));
