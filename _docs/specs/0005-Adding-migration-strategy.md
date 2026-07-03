# Add node-pg-migrate Database Migration Strategy

## Objective

Adopt `node-pg-migrate` as the database migration system for this Express + PostgreSQL service, replacing the current ad hoc SQL runner with versioned, tracked, rollback-aware migrations.

The end state should let the team:

- Create new migrations with a standard command.
- Apply only pending migrations in local, Docker, and production-like environments.
- Roll back recent schema changes when a migration supports it.
- Start fresh databases from one clean initial schema migration.
- Keep the service on `pg` without introducing an ORM.

## Background

The research in `.workspace/researchs/0005-migration_strategy.md` recommends `node-pg-migrate` for this project because it is PostgreSQL-specific, works well with `pg`, supports versioned `up`/`down` migrations, provides a CLI, and does not require an ORM.

The current project has SQL files in `src/db/migrations/` and a custom runner in `src/scripts/runMigration.ts`. That runner is not reliable enough for ongoing schema management:

- It reads raw `.sql` files directly instead of using a migration metadata table.
- It currently filters to only `007_oauth_providers.sql`, so earlier pending files are skipped.
- It has no record of which migrations already ran, so repeated execution can fail or accidentally reapply destructive statements.
- It has no first-class rollback path.
- It depends on file contents being manually idempotent.
- Existing SQL history includes an unsafe migration, `004_drop_and_add_application_id.sql`, that drops `users.application_id` before dropping its foreign key constraint and should not be preserved as a normal forward migration.

Current schema files include:

- `001_create_user_and_profile.sql`
- `002_create_application_table.sql`
- `003_add_application_id.sql`
- `004_drop_and_add_application_id.sql`
- `005_password_resets.sql`
- `006_auth_otps.sql`
- `007_oauth_providers.sql`

The project does not have a production database yet, so the old SQL files are implementation references, not historical contracts. The target schema should be preserved, but the old migration history should not be carried forward. The new `node-pg-migrate` setup should start with a clean consolidated initial schema migration.

## Scope

### In Scope

- Install `node-pg-migrate` as a development dependency.
- Replace the current `npm run migrate` behavior with `node-pg-migrate`-backed execution.
- Add package scripts for creating, applying, and rolling back migrations.
- Convert the current intended schema from the existing SQL files into a consolidated tracked `node-pg-migrate` migration.
- Keep migration files under `src/db/migrations/` unless implementation discovers a strong reason to move them.
- Use TypeScript migration files and `MigrationBuilder`.
- Use raw `pgm.sql()` only for PostgreSQL operations that are clearer or safer as SQL, such as the OAuth unique constraint cleanup block.
- Add explicit `down` migrations where rollback is practical.
- Document that local/dev databases should be reset and migrated from scratch during adoption.
- Update README or database docs so local and Docker migration commands point at the new flow.
- Improve seed execution as part of this implementation while keeping seeds separate from schema migrations.
- Document the current production operation choice: run migrations manually from the local machine with production database environment values.

### Out of Scope

- Introducing an ORM.
- Switching to Knex, Umzug, Prisma, TypeORM, or Sequelize.
- Redesigning the database schema beyond what is required to preserve the current intended schema.
- Automatically running migrations on API startup.
- Automatically running migrations during ECS deploy.
- Resetting or dropping existing shared databases as part of the migration library rollout.
- Backfilling production data unless a later schema migration explicitly requires it.
- Preserving one-to-one history from the old SQL files.
- Running migrations as an ECS one-off task before API rollout.

## Proposed Approach

### Dependency And Scripts

Install the migration library:

```bash
npm install -D node-pg-migrate
```

Keep the application runtime dependency on `pg` unchanged.

Add or update package scripts so migration operations call the `node-pg-migrate` CLI directly:

```json
{
  "scripts": {
    "migrate": "node-pg-migrate up -m src/db/migrations",
    "migrate:up": "node-pg-migrate up -m src/db/migrations",
    "migrate:down": "node-pg-migrate down -m src/db/migrations",
    "migrate:create": "node-pg-migrate create -j ts -m src/db/migrations"
  }
}
```

Use `DATABASE_URL` as the migration CLI connection string. The application can continue using `DB_*`; migration execution does not need a custom TypeScript runner.

The CLI should use:

- migration directory: `src/db/migrations`
- migrations table: `pgmigrations`
- default `node-pg-migrate` single-transaction behavior
- default `node-pg-migrate` order checking
- default advisory locking

### Migration File Strategy

Use TypeScript migration files generated through `npm run migrate:create -- <name>`.

Recommended initial sequence:

```text
src/db/migrations/
  <timestamp>_create_initial_auth_schema.ts
```

This project is still an initial product with no production database to preserve. Prefer one consolidated initial migration that creates the current intended schema directly. Do not create one new migration per old SQL file, because that would preserve broken or noisy history without giving production safety benefits.

Do not keep the old `.sql` files in the active migration directory after conversion, because `node-pg-migrate` can load SQL files and may treat them as runnable migrations. Since this project has no production history to preserve, delete the old SQL migration files after the consolidated migration is created.

The consolidated migration should preserve the current intended schema:

- `users`
- `profiles`
- `applications`
- `password_reset_tokens`
- `auth_otps`
- `oauth_states`
- `oauth_identities`
- `oauth_login_exchanges`
- Existing indexes and foreign keys
- The OAuth change that allows users without passwords and scopes email uniqueness by `application_id`

The unsafe old `004_drop_and_add_application_id.sql` should not become a standalone new migration. The consolidated initial migration should create the terminal intended state directly:

1. Create `applications`.
2. Add nullable `users.application_id`.
3. Add `fk_users_application_id`.

Future schema changes after this initial migration should be added as separate migrations. Once a migration has been applied to a shared environment, do not edit it; create a new migration instead.

### Rollback Rules

Every migration should export both `up` and `down` unless rollback is genuinely impossible.

Rollback implementation expectations:

- Table creation migrations should drop dependent tables or constraints in reverse order.
- Index creation migrations should drop their indexes by explicit name.
- Constraint migrations should drop explicit constraint names.
- The initial migration `down` should drop the schema objects it creates in dependency order. This is acceptable for disposable local databases, but it should not be treated as a production rollback plan once real data exists.

Do not rely on automatic down inference for high-risk auth schema changes.

### Fresh Database Strategy

Because the project has no production database yet, the default adoption path is to start from a clean database.

Recommended path:

1. Start with an empty database.
2. Run `npm run migrate:up`.
3. Run `npm run seed` if seed data is needed.

If a local or developer database contains useful data, handle it case by case:

1. Back up the database if the data matters.
2. Prefer resetting the database and reseeding it.
3. If reset is not acceptable, handle that database manually outside the default migration rollout.

Do not optimize the main implementation around preserving untracked local database states.

### Seeds

Seeds remain data setup, not schema migration, but the current seed runner should be fixed during this implementation.

Keep `src/db/seeds/` and `npm run seed` separate from `node-pg-migrate`. Update `src/scripts/runSeed.ts` so it no longer filters to only `002_seed_initial_application.sql`. It should read all `.sql` seed files in `src/db/seeds/`, sort them by filename, and execute them in order.

Seed files should be idempotent where practical, using `ON CONFLICT`, stable identifiers, or existence checks so rerunning `npm run seed` does not duplicate data or fail unnecessarily.

Do not store schema changes in seed files. If seed data depends on a schema change, the migration must run first and the seed should assume the migrated schema exists.

### Production Migration Operation

For now, production migrations will be run manually from the local machine by pointing the migration environment variables at the production database and executing:

```bash
npm run migrate:up
```

This is acceptable for the current stage of the product, but it needs explicit guardrails:

- Production database credentials must not be committed.
- Before running production migrations, confirm the active `.env` or shell environment points to the intended production database.
- Back up production data before destructive or non-reversible migrations.
- Run `npm run build` and local migration validation before applying production migrations.
- Do not run migrations automatically from API startup.

Running migrations as a separate ECS one-off task is deferred until deployment automation matures.

### Documentation

Update project docs to describe:

- How to create a migration.
- How to run pending migrations.
- How to roll back the last migration.
- How to reset and migrate a fresh local database.
- How to run seeds after migrations.
- How to run production migrations manually from local environment values.
- That migration files already applied to shared environments must not be edited; create a new migration instead.
- That destructive schema changes require explicit rollback notes and data backup instructions.

## Milestones

1. Install and wire migration tooling
   - Add `node-pg-migrate`.
   - Replace the old migration script command with direct `node-pg-migrate` CLI commands.
   - Add `migrate:*` scripts in `package.json`.
   - Keep `npm run migrate` as the normal "apply pending migrations" command.

2. Create the consolidated initial schema migration
   - Create one TypeScript `node-pg-migrate` migration under `src/db/migrations/`.
   - Preserve the intended terminal schema from the existing SQL files.
   - Exclude the broken operational behavior from `004_drop_and_add_application_id.sql`.
   - Move or remove legacy `.sql` files from the active migration directory.

3. Add rollback guidance
   - Add an explicit `down` migration or documented non-reversible sections.
   - Document that the initial rollout assumes a fresh database because there is no production database yet.

4. Fix seed execution
   - Update `src/scripts/runSeed.ts` to run all seed SQL files in sorted order.
   - Keep seed execution separate from schema migration execution.
   - Make seed files idempotent where practical.

5. Document manual production migration operation
   - Document how to point local environment values at production.
   - Add guardrails for credentials, confirmation, backups, and validation.
   - Explicitly defer ECS one-off migration tasks.

6. Validate locally
   - Run migrations against a clean local PostgreSQL database.
   - Confirm `pgmigrations` records the initial schema migration.
   - Confirm a second `npm run migrate:up` is a no-op.
   - Run at least one `npm run migrate:down` on a disposable database.
   - Run `npm run seed` and confirm all seed files execute in order.

7. Update docs
   - Update README command examples.
   - Add any required `.env.example` notes.
   - Include the migration rules for future schema changes.

## Edge Cases

- A database has only some old SQL files applied.
- A migration was manually edited after being applied in a shared database.
- The OAuth email uniqueness migration cannot restore the old global unique email constraint because tenant-scoped duplicates exist.
- `gen_random_uuid()` is unavailable because the required PostgreSQL extension is missing.
- Two deploy or developer processes try to run migrations at the same time.
- A SQL file remains in `src/db/migrations/` and is accidentally picked up by `node-pg-migrate`.
- A destructive migration runs successfully in `up` but cannot be safely reversed in `down`.
- Local environment variables point to production when the developer intended to migrate a local database, or vice versa.
- Seed files are rerun and create duplicate records.

## Acceptance Criteria

- [ ] `node-pg-migrate` is installed and committed in `package.json` and `package-lock.json`.
- [ ] `npm run migrate` applies pending migrations through `node-pg-migrate`.
- [ ] `npm run migrate:create -- <name>` creates a TypeScript migration in `src/db/migrations/`.
- [ ] The old custom SQL-file loop is no longer responsible for applying schema migrations.
- [ ] One consolidated initial migration creates the intended tables, columns, constraints, and indexes from the current SQL schema.
- [ ] `004_drop_and_add_application_id.sql` is not preserved as a destructive forward migration.
- [ ] Legacy `.sql` migration files are not left active in the `node-pg-migrate` migrations directory.
- [ ] Running migrations twice on the same database does not reapply already completed migrations.
- [ ] `pgmigrations` records applied migrations.
- [ ] README or database docs explain create, up, down, and fresh database reset/migration commands.
- [ ] `npm run seed` executes all `.sql` files in `src/db/seeds/` in sorted order.
- [ ] Seed files are idempotent where practical.
- [ ] README or database docs explain the current manual local-to-production migration workflow and required guardrails.
- [ ] The spec explicitly defers ECS one-off migration tasks.

## Test Plan

Unit:

- Add focused tests for seed file discovery if seed selection is extracted into a helper.

Integration:

- Against an empty PostgreSQL database, run `npm run migrate:up` and verify all expected tables exist.
- Run `npm run migrate:up` a second time and verify no migration is re-executed.
- Run `npm run migrate:down` on a disposable database and verify the latest migration rolls back as expected.
- Run `npm run seed` and verify all seed files run in sorted order.
- Run `npm run seed` a second time where seed files are idempotent and verify it does not duplicate records.

Manual verification:

- Inspect `pgmigrations` after a successful run.
- Compare schema objects from the old SQL terminal state to the consolidated initial migration result.
- Run `npm run build`.
- Run `npm run test`.
- Run the local API after migrating and confirm auth flows still reach the database normally.
- Dry-run the production migration checklist using non-production database values before the first real production migration.

## Risks and Mitigations

- Risk: A local database with useful data is reset during adoption.
  - Mitigation: Document backup expectations and treat local preservation as a manual exception, not the default path.

- Risk: The consolidated migration differs from a database that was partially changed by the old runner.
  - Mitigation: Prefer clean database reset; if data must be preserved, reconcile manually before running migrations.

- Risk: Rollback for OAuth email uniqueness is not always safe.
  - Mitigation: Document non-reversible parts in the migration and require backup before applying tenant-scoped uniqueness changes to shared environments.

- Risk: Old `.sql` files remain in the active migration directory and run unexpectedly.
  - Mitigation: Archive or remove them from `src/db/migrations/` after TypeScript conversion.

- Risk: The application uses `DB_*` while migration commands use `DATABASE_URL`.
  - Mitigation: Document `DATABASE_URL` clearly in `.env.example` and README as the migration CLI connection string.

- Risk: Concurrent migration runs conflict.
  - Mitigation: Keep `node-pg-migrate` advisory locking enabled by leaving `noLock` set to `false`.

- Risk: Production migrations are run from local with the wrong environment values.
  - Mitigation: Document a mandatory pre-run confirmation step and keep production credentials outside committed files.

- Risk: Seed reruns create duplicate data.
  - Mitigation: Make seed SQL idempotent where practical and verify reruns during testing.

## Open Questions

- None.
