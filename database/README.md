# Demo database data

This folder stores a portable SQL dump with the demo data used for the project.

## Restore on another computer

1. Create the PostgreSQL database:

```bash
createdb -U postgres construction_crm
```

2. Start the backend once so TypeORM creates the tables:

```bash
npm run start:dev --workspace=backend
```

3. Stop the backend and load the demo data:

```bash
psql -h localhost -U postgres -d construction_crm -f database/demo-data.sql
```

4. Start the backend, frontend and Telegram bot again.

The SQL file clears the project tables before inserting the demo rows, so use it only for a demo database.

## Export current local demo data again

```bash
npm run db:export-demo
```
