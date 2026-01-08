# Backup & Restore Notes

Keep regular backups of Postgres and any AI model artifacts.

## Postgres (PostGIS)

Backup:

```
pg_dump -Fc -h localhost -p 54320 -U georisem georisem_db > georise_backup.dump
```

Restore:

```
pg_restore -h localhost -p 54320 -U georisem -d georisem_db --clean georise_backup.dump
```

## Redis

Redis is cache-only. If you want persistence:

- Ensure `appendonly yes` or snapshotting is enabled in production.
- For restore, restart Redis with the saved `dump.rdb`/AOF.

## AI Model Artifacts

- Store `ai-service/models/afroxlmr_incident_classifier/` in durable storage.
- Keep `metadata.json` with the model to track versions.
