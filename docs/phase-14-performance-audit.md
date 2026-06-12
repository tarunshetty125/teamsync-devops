# Phase 14 Performance Audit

## Scope

Audited frontend bundle shape, route-level lazy loading, backend query indexes, realtime payloads, dashboard caching, and load-test targets for beta readiness.

## Code Evidence

- Frontend route lazy loading: `client/src/routes/common/lazy-pages.tsx`
- Search command lazy mount: `client/src/components/header.tsx`
- Kanban lazy mount: `client/src/page/workspace/Tasks.tsx`, `client/src/page/workspace/ProjectDetails.tsx`
- Task details lazy mount: `client/src/page/workspace/timeline-page.tsx`, `client/src/page/workspace/gantt-page.tsx`, `client/src/components/workspace/task/table/table-row-actions.tsx`, `client/src/components/workspace/task/board/kanban-board.tsx`
- Attachment panel lazy boundaries: `client/src/components/workspace/task/task-details-dialog.tsx`, `client/src/page/workspace/ProjectDetails.tsx`
- Vite vendor chunks: `client/vite.config.ts`
- Dashboard TTL cache: `backend/src/services/dashboard-cache.service.ts`
- Realtime minimal payloads: `backend/src/realtime/realtime.service.ts`
- Release indexes: `backend/src/migrations/202606120400_phase14_release_hardening_indexes.ts`

## Findings

| Area | Status | Notes |
| --- | --- | --- |
| Initial bundle | Improved | Heavy vendor families are split into `react`, `tanstack`, `radix-ui`, `icons`, `date`, `rich-text`, `drag-drop`, `emoji-picker`, and `realtime` chunks. |
| Route-level splitting | Pass | Workspace feature pages are lazy-loaded through route definitions; task details, Kanban, search, and attachment panels are no longer eager in the main path. |
| Duplicate requests | Pass with monitoring | React Query keys are scoped by workspace/view. No intentional duplicate fetch loops found during code review. |
| Large tables | Warning | Audit logs, notifications, members, timesheets, and productivity views paginate server-side. DOM virtualization is not required for beta page sizes but should be revisited if page sizes increase. |
| Dashboard performance | Pass | Dashboard aggregates use a 45-second in-memory TTL cache and workspace/user/range cache keys. |
| Realtime payload size | Pass | Socket events emit minimal IDs and timestamps; clients refetch through existing REST APIs. |
| Mongo index coverage | Improved | Added release indexes for audit filters, activity filters, and file target listing. Existing task, comment, notification, search, time entry, and governance models have workspace-scoped indexes. |

## Load Test Plan

Run against a production-like Docker deployment with seeded workspaces:

```bash
# Example using any HTTP load tool that can keep cookies.
# Target authenticated API routes for tasks, comments, notifications, search,
# dashboard, Gantt, and productivity.
```

Minimum beta acceptance targets:

- p95 API latency below 500 ms for cached dashboards and simple list reads.
- p95 API latency below 1000 ms for search, Gantt, and uncached dashboard aggregates.
- No process memory growth after 15 minutes of steady websocket connections.
- No Mongo collection scans in explain output for workspace-scoped beta paths.

## Remaining Risks

- Horizontal websocket/presence scaling is intentionally out of scope because Redis was excluded.
- Large XLSX exports run synchronously; export scope and retention are bounded, but very large workspaces should be tested before public launch.
