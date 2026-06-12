import { AUTH_ROUTES, BASE_ROUTE, PROTECTED_ROUTES } from "./routePaths";
import {
  Calendar,
  Gantt,
  GoogleOAuthFailure,
  InviteUser,
  Members,
  Productivity,
  Profile,
  ProjectDetails,
  Roadmap,
  Settings,
  SignIn,
  SignUp,
  Tasks,
  Timeline,
  WorkspaceDashboard,
} from "./lazy-pages";

export const authenticationRoutePaths = [
  { path: AUTH_ROUTES.SIGN_IN, element: <SignIn /> },
  { path: AUTH_ROUTES.SIGN_UP, element: <SignUp /> },
  { path: AUTH_ROUTES.GOOGLE_OAUTH_CALLBACK, element: <GoogleOAuthFailure /> },
];

export const protectedRoutePaths = [
  { path: PROTECTED_ROUTES.WORKSPACE, element: <WorkspaceDashboard /> },
  { path: PROTECTED_ROUTES.TASKS, element: <Tasks /> },
  { path: PROTECTED_ROUTES.CALENDAR, element: <Calendar /> },
  { path: PROTECTED_ROUTES.TIMELINE, element: <Timeline /> },
  { path: PROTECTED_ROUTES.ROADMAP, element: <Roadmap /> },
  { path: PROTECTED_ROUTES.GANTT, element: <Gantt /> },
  { path: PROTECTED_ROUTES.PRODUCTIVITY, element: <Productivity /> },
  { path: PROTECTED_ROUTES.MEMBERS, element: <Members /> },
  { path: PROTECTED_ROUTES.SETTINGS, element: <Settings /> },
  { path: PROTECTED_ROUTES.PROFILE, element: <Profile /> },
  { path: PROTECTED_ROUTES.PROJECT_DETAILS, element: <ProjectDetails /> },
];

export const baseRoutePaths = [
  { path: BASE_ROUTE.INVITE_URL, element: <InviteUser /> },
];
