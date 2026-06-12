# TeamSync Backup And Recovery Guide

## What To Back Up

- MongoDB database configured by `MONGO_URI`.
- Local upload storage volume mounted at `LOCAL_FILE_STORAGE_DIR`.
- Export files stored through the same local storage provider.
- Production `.env` and TLS material stored in the secret manager or server secret path.

## Mongo Backup

```bash
mongodump --uri "$MONGO_URI" --archive=teamsync-$(date +%F).archive --gzip
```

Store backups encrypted and off-host. Retain at least daily backups for beta.

## Upload Storage Backup

For Docker volume deployments:

```bash
docker run --rm \
  -v teamsync-backend-uploads:/data:ro \
  -v "$PWD/backups":/backup \
  alpine tar -czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

## Restore Procedure

1. Stop application writes:

```bash
docker compose stop backend nginx
```

2. Restore Mongo:

```bash
mongorestore --uri "$MONGO_URI" --archive=teamsync-YYYY-MM-DD.archive --gzip --drop
```

3. Restore uploads:

```bash
docker run --rm \
  -v teamsync-backend-uploads:/data \
  -v "$PWD/backups":/backup \
  alpine sh -c "rm -rf /data/* && tar -xzf /backup/uploads-YYYY-MM-DD.tar.gz -C /data"
```

4. Restart and verify:

```bash
docker compose up -d
docker compose exec backend npm run migrate
docker compose exec backend wget --spider http://localhost:8000/health/ready
```

## Export Retention

Export jobs expire after 7 days. The retention cleanup system removes expired export records/files through the existing local storage provider and records audit activity.

## Recovery Validation

- Login with an owner account.
- Open one workspace, project, task, comment thread, file preview, dashboard, productivity timesheet, and audit log.
- Confirm uploads referenced in `FileAsset` are present on disk.
