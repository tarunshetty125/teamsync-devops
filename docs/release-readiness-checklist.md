# TeamSync Release Readiness Checklist

## Validation Gates

```bash
cd backend && npm run build
cd backend && npm run test
cd backend && npm run test:e2e
cd client && npm run lint
cd client && npm run build
git diff --check
```

## Security

- [ ] Production secrets are not committed.
- [ ] `SESSION_SECRET` is at least 32 characters.
- [ ] OAuth callback URLs use HTTPS.
- [ ] Backend is not publicly exposed outside Nginx.
- [ ] Prometheus and Grafana are internal only.
- [ ] File upload limits match workspace policy expectations.
- [ ] Export retention is enabled.

## Reliability

- [ ] `/health/live` returns 200 when the process is alive.
- [ ] `/health/ready` returns 200 only when Mongo is connected.
- [ ] Docker backend healthcheck targets `/health/ready`.
- [ ] Migrations are run exactly once during deployment.
- [ ] Retention cleanup is disabled in tests and locked in production.

## Performance

- [ ] Client build completes without new oversized unsplit app chunks.
- [ ] Search, audit, notifications, files, time entries, comments, and tasks use workspace-scoped indexes.
- [ ] Dashboard cache TTL remains 45 seconds.
- [ ] Realtime payloads remain ID-only invalidation payloads.

## Accessibility And UX

- [ ] Keyboard-only pass through auth, dashboard, tasks, comments, search, files, productivity, settings, Gantt, and timeline.
- [ ] Dialogs restore focus on close.
- [ ] Loading, empty, and error states render on major pages.
- [ ] Mobile Kanban and Gantt avoid drag-only workflows.

## Backup

- [ ] Mongo backup created and restore-tested.
- [ ] Upload volume backup created and restore-tested.
- [ ] Recovery runbook is accessible to operators.
