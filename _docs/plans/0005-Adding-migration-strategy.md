# Adding node-pg-migrate Strategy Plan

## Goal

Implement `_docs/specs/0005-Adding-migration-strategy.md` by replacing the current ad hoc SQL migration runner with `node-pg-migrate`.

The implementation should start this initial product from a clean consolidated schema migration, fix seed execution, and keep production migrations as a manual local operation for now.

## Source Spec

- `_docs/specs/0005-Adding-migration-strategy.md`

## Decisions

- Use `node-pg-migrate`.
- Keep using `pg`; do not introduce an ORM.
- Use one consolidated initial schema migration instead of one migration per old SQL file.
- Keep migration files under `src/db/migrations/`.
- Move old `.sql` migration files out of the active migration directory after conversion.
- Use `DATABASE_URL` for `node-pg-migrate` CLI database connection.
- Keep seeds separate from schema migrations.
- Fix `npm run seed` so it runs all seed SQL files in sorted order.
- Run production migrations manually from the local machine for now.
- Defer ECS one-off migration tasks.
- Never run migrations automatically on API startup.

## Current State

- `package.json` has:

```json
"migrate": "node-pg-migrate up -m src/db/migrations",
"seed": "ts-node src/scripts/runSeed.ts"
```

- `node-pg-migrate` is not installed.
- `ts-node` is used by scripts but is not declared in `devDependencies`.
- `src/scripts/runSeed.ts` reads `.sql` files directly and currently filters to only:

```text
002_seed_initial_application.sql
```

- Active SQL migrations are:

```text
src/db/migrations/001_create_user_and_profile.sql
src/db/migrations/002_create_application_table.sql
src/db/migrations/003_add_application_id.sql
src/db/migrations/004_drop_and_add_application_id.sql
src/db/migrations/005_password_resets.sql
src/db/migrations/006_auth_otps.sql
src/db/migrations/007_oauth_providers.sql
```

- `004_drop_and_add_application_id.sql` should not be preserved as migration behavior.
- Seeds currently live in:

```text
src/db/seeds/
```

## Implementation Steps

### 1. Install Migration Tooling

Files:

- `package.json`
- `package-lock.json`

Commands:

```bash
npm install -D node-pg-migrate ts-node
```

Tasks:

- Add `node-pg-migrate` as a dev dependency.
- Add `ts-node` as a dev dependency because repo scripts already call it.
- Keep the existing `pg` runtime dependency.

### 2. Update Package Scripts

Files:

- `package.json`

Tasks:

- Replace migration scripts with:

```json
{
  "migrate": "node-pg-migrate up -m src/db/migrations",
  "migrate:up": "node-pg-migrate up -m src/db/migrations",
  "migrate:down": "node-pg-migrate down -m src/db/migrations",
  "migrate:create": "node-pg-migrate create -j ts -m src/db/migrations"
}
```

- Keep:

```json
"seed": "ts-node src/scripts/runSeed.ts"
```

Expected result:

- `npm run migrate` means "apply pending migrations".
- `npm run migrate:down` rolls back the latest migration.
- `npm run migrate:create -- <name>` creates a TypeScript migration.

### 3. Remove The Custom Migration Runner

Files:

- `src/scripts/runMigration.ts`

Tasks:

- Delete the custom migration runner.
- Use direct `node-pg-migrate` CLI commands from `package.json`.
- Document that the migration CLI uses `DATABASE_URL`.

Expected result:

- No project-owned script applies schema migrations.
- `node-pg-migrate` owns migration execution and tracking through `pgmigrations`.

### 4. Create Consolidated Initial Migration

Files:

- `src/db/migrations/<timestamp>_create_initial_auth_schema.ts`

Tasks:

- Create one TypeScript migration using `MigrationBuilder`.
- Implement `up` to create the current intended schema:

```text
users
profiles
applications
password_reset_tokens
auth_otps
oauth_states
oauth_identities
oauth_login_exchanges
```

- Preserve intended columns, indexes, and foreign keys from the existing SQL files.
- Create `users.application_id` directly in the intended terminal shape.
- Add `fk_users_application_id` directly.
- Include the OAuth-era intended behavior:
  - `users.password` nullable.
  - no global unique constraint on `users.email`.
  - unique index on `(application_id, lower(email))` where `application_id IS NOT NULL`.
- Use explicit names for constraints and indexes where practical.
- Use `pgm.sql()` for PostgreSQL-specific statements that are clearer as SQL.
- Implement `down` to drop schema objects in dependency order.

Important:

- Do not recreate the behavior from `004_drop_and_add_application_id.sql`.
- Do not split the initial schema into one file per old SQL migration.

### 5. Remove Legacy SQL Migrations

Files:

- `src/db/migrations/*.sql`
Tasks:

- Delete the old `.sql` migration files after the consolidated migration is created.
- Keep `src/db/migrations/` limited to `node-pg-migrate` files.

Expected result:

- `node-pg-migrate` cannot accidentally load old `.sql` files as active migrations.

### 6. Fix Seed Execution

Files:

- `src/scripts/runSeed.ts`
- `src/db/seeds/*.sql`

Tasks:

- Remove the hardcoded filter for `002_seed_initial_application.sql`.
- Read all `.sql` files in `src/db/seeds/`.
- Sort seed files by filename.
- Execute seed files in order.
- Ensure `pool.end()` runs in `finally`.
- Exit with non-zero code on seed failure.
- Make existing seed SQL idempotent where practical with `ON CONFLICT`, stable identifiers, or existence checks.

Expected result:

- `npm run seed` executes all seed files in deterministic order.
- Rerunning seeds does not duplicate records where idempotency is practical.

### 7. Update Documentation

Files:

- `README.md`
- `.env.example`
- Optional: a focused database doc under `_docs/` if README would become too large.

Tasks:

- Document migration commands:

```bash
npm run migrate
npm run migrate:up
npm run migrate:down
npm run migrate:create -- add-something
```

- Document fresh local database adoption:

```bash
npm run migrate:up
npm run seed
```

- Document that old `.sql` migrations were removed and are no longer active.
- Document that already-applied migrations must not be edited in shared environments.
- Document that destructive migrations need backup and rollback notes.
- Document that seeds are separate from migrations.
- Document manual production migration workflow:
  - point local env vars at production database;
  - verify the target database before running;
  - run build/tests/local migration validation first;
  - back up data before destructive changes;
  - run `npm run migrate:up`.
- Document that ECS one-off migration tasks are deferred.

### 8. Add Focused Tests Where Useful

Files:

- `src/test/*.spec.ts`
- Optional helper module if migration/seed parsing is extracted.

Tasks:

- If seed discovery is extracted, test:
  - only `.sql` files are selected;
  - files are sorted by filename;
  - non-SQL files are ignored.

Implementation note:

- Do not overbuild tests around `node-pg-migrate` internals.
- Prefer testing local helper behavior and validating actual migrations through integration/manual checks.

### 9. Validate Locally

Commands:

```bash
npm run build
npm run test
```

Fresh database validation:

```bash
npm run migrate:up
npm run migrate:up
npm run seed
npm run seed
```

Rollback validation on a disposable database:

```bash
npm run migrate:down
```

Database checks:

- Confirm `pgmigrations` exists.
- Confirm the initial migration is recorded.
- Confirm expected tables exist.
- Confirm a second `npm run migrate:up` does not reapply schema changes.
- Confirm all seed files execute in sorted order.
- Confirm seed rerun does not duplicate data where seed idempotency was implemented.

## Production Migration Checklist

Use this only when intentionally migrating production from a local machine.

Before running:

- Confirm production database credentials are not committed.
- Confirm the active `.env` or shell environment points to the intended production database.
- Run `npm run build`.
- Run `npm run test`.
- Validate the migration against a non-production database.
- Back up production data before destructive or non-reversible changes.

Run:

```bash
npm run migrate:up
```

After running:

- Inspect `pgmigrations`.
- Confirm the API can connect normally.
- Record which migration was applied and when.

## Acceptance Checklist

- [ ] `node-pg-migrate` is installed.
- [ ] `ts-node` is declared in `devDependencies`.
- [ ] `npm run migrate` applies pending migrations through `node-pg-migrate`.
- [ ] `npm run migrate:create -- <name>` creates TypeScript migrations in `src/db/migrations/`.
- [ ] The old SQL-file migration loop is removed.
- [ ] One consolidated initial migration creates the intended current schema.
- [ ] `004_drop_and_add_application_id.sql` behavior is not preserved.
- [ ] Old `.sql` migration files are no longer active under `src/db/migrations/`.
- [ ] Running migrations twice does not reapply completed migrations.
- [ ] `pgmigrations` records applied migrations.
- [ ] `npm run seed` executes all seed SQL files in sorted order.
- [ ] Seed files are idempotent where practical.
- [ ] Docs explain local fresh database migration and seeding.
- [ ] Docs explain manual local-to-production migration guardrails.
- [ ] Docs explicitly defer ECS one-off migration tasks.
