# Adding Neon And Render Deployment Plan

## Goal

Implement `_docs/specs/0007-adding-neon-and-render.md` by adding a lower-cost Render + Neon deployment path for `auth-service`.

The implementation should keep the current app behavior and database schema unchanged while making the runtime database connection Neon-friendly and adding Render-native deployment configuration.

## Source Spec

- `_docs/specs/0007-adding-neon-and-render.md`

## Decisions

- Use Render for the API runtime.
- Use Neon for PostgreSQL.
- Keep AWS infrastructure supported under `infra/aws/terraform`.
- Use the Render free plan for the first deployment.
- Use the Render service name `auth-service`.
- Use Render's HTTPS `onrender.com` domain for the first public API URL.
- Do not move `api.auth.phablovilasboas.tech` to Render in this implementation.
- Use Render-native config at `infra/render/render.yaml`.
- Use documented manual setup for Neon.
- Do not create Neon through Terraform or API automation.
- Do not create Render through Terraform.
- Do not add Render Postgres.
- Use a Neon direct connection URL for migrations and seeds through `DATABASE_URL`.
- Use a Neon pooled connection URL for API runtime through `DATABASE_POOL_URL`.
- Preserve split `DB_*` fallback for local Docker and AWS compatibility.
- Run migrations in Render `preDeployCommand`.
- Do not run seeds automatically in Render deploys.

## Current State

Relevant files:

```text
Dockerfile
package.json
.env.example
README.md
src/main.ts
src/db/pool.ts
src/db/client.ts
src/scripts/runSeed.ts
infra/render/README.md
infra/neon/README.md
```

Current runtime behavior:

- `Dockerfile` builds TypeScript and starts `node dist/main.js`.
- `src/main.ts` listens on `process.env.PORT || 3001`.
- `GET /health` exists and is suitable for Render health checks.
- `src/db/pool.ts` and `src/db/client.ts` use split `DB_*` variables.
- `npm run migrate:up` uses `node-pg-migrate` and expects `DATABASE_URL`.
- `npm run seed` can use `DATABASE_URL` or split `DB_*`.

Current provider folders:

```text
infra/
  aws/
  render/
    README.md
  neon/
    README.md
```

## Implementation Steps

### 1. Add Shared Database Config

Files:

- `src/db/config.ts` or `src/db/database.config.ts`
- `src/db/pool.ts`
- `src/db/client.ts`

Tasks:

- Add a shared helper that builds `pg` connection config.
- Use this resolution order:

```text
DATABASE_POOL_URL
DATABASE_URL
```

- When using a URL, pass it to `pg` as `connectionString`.
- Rely on Neon-provided URL query parameters such as `sslmode=require` and `channel_binding=require`.
- Preserve split `DB_*` fallback for local Docker and AWS.
- Remove noisy database environment logging from runtime DB clients if present.

Expected result:

- API runtime can connect to Neon with `DATABASE_POOL_URL`.
- Migration and seed tooling can keep using `DATABASE_URL`.
- Existing local Docker/AWS config using split `DB_*` still works.

### 2. Add Database Config Tests

Files:

- `src/test/db-config.spec.ts` or another existing test location under `src/test/`

Tasks:

- Test that `DATABASE_POOL_URL` wins over `DATABASE_URL`.
- Test that `DATABASE_URL` is used when `DATABASE_POOL_URL` is absent.
- Test that split `DB_*` values are used when URL variables are absent.
- Avoid connecting to a real database in these tests.

Expected result:

- The fallback behavior is covered without requiring Neon credentials.

### 3. Add Render Blueprint

Files:

- `Dockerfile`
- `infra/render/render.yaml`

Tasks:

- Ensure the production Docker image includes files required by Render deploy operations:
  - `src/db/migrations`
  - `src/db/seeds`
  - `src/scripts`
  - `tsconfig.json`
- Define one web service:

```yaml
services:
  - type: web
    name: auth-service
    runtime: docker
    plan: free
    region: virginia
    branch: main
    dockerfilePath: ./Dockerfile
    dockerContext: .
    healthCheckPath: /health
    preDeployCommand: npm run migrate:up
    autoDeployTrigger: commit
```

- Set non-sensitive values directly:

```text
NODE_ENV=production
PORT=10000
JWT_EXPIRES_IN=15m
OAUTH_STATE_TTL_SECONDS=600
OAUTH_EXCHANGE_CODE_TTL_SECONDS=300
OAUTH_ENABLED_PROVIDERS=google,github
GOOGLE_OAUTH_CALLBACK_PATH=/api/auth/oauth/google/callback
GITHUB_OAUTH_CALLBACK_PATH=/api/auth/oauth/github/callback
MAIL_PROVIDER=smtp
MAIL_PORT=587
MAIL_SECURE=false
```

- Add URL values using the initial Render URL placeholder:

```text
OAUTH_PUBLIC_BASE_URL=https://auth-service.onrender.com
APP_BASE_URL=https://auth-service.onrender.com
```

- Mark secrets with `sync: false`:

```text
DATABASE_URL
DATABASE_POOL_URL
JWT_SECRET
API_KEY
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GITHUB_OAUTH_CLIENT_ID
GITHUB_OAUTH_CLIENT_SECRET
MAIL_USER
MAIL_PASSWORD
MAIL_HOST
MAIL_FROM_EMAIL
```

- Include `OAUTH_FRONTEND_REDIRECT_ALLOWLIST` and `OAUTH_DEFAULT_PROFILE_ID` as explicit variables. Use `sync: false` if the value is deployment-specific.
- Do not add a Render Postgres database block.

Expected result:

- Render can create/sync the service from `infra/render/render.yaml`.
- Render `preDeployCommand` can find and run the migration files inside the Docker image.
- No secret values are committed.

### 4. Update Render Documentation

Files:

- `infra/render/README.md`

Tasks:

- Explain that `infra/render/render.yaml` is the Render Blueprint.
- Document that the service name is `auth-service`.
- Document that the first deployment uses the free plan.
- Document that the first URL is:

```text
https://auth-service.onrender.com
```

- Document required Render secrets and which Neon URL each one receives:
  - `DATABASE_URL`: direct Neon connection string.
  - `DATABASE_POOL_URL`: pooled Neon connection string.
- Document that Render secrets using `sync: false` may need manual dashboard updates after initial Blueprint creation.
- Document that seeds are not run automatically.

Expected result:

- A developer can create the Render service without guessing env var meanings.

### 5. Update Neon Documentation

Files:

- `infra/neon/README.md`

Tasks:

- Document manual Neon setup:
  - Create a Neon project.
  - Use or create the production branch.
  - Create the `auth-service` database or use the default database if preferred.
  - Copy direct and pooled connection strings.
  - Confirm the URLs include SSL options such as `sslmode=require`.
- Document where each URL goes:
  - Direct URL -> Render `DATABASE_URL`.
  - Pooled URL -> Render `DATABASE_POOL_URL`.
- Document manual migration:

```bash
DATABASE_URL='<neon-direct-url>' npm run migrate:up
```

- Document optional one-time seed:

```bash
DATABASE_URL='<neon-direct-url>' npm run seed
```

- State that the current schema and migrations remain unchanged.

Expected result:

- Neon setup is repeatable without Terraform or provider tokens.

### 6. Update Environment Documentation

Files:

- `.env.example`
- `README.md`

Tasks:

- Add `DATABASE_POOL_URL` to `.env.example`.
- Clarify:
  - `DATABASE_POOL_URL` is preferred for deployed app runtime.
  - `DATABASE_URL` is used by migrations and seed tooling.
  - Split `DB_*` variables remain supported for local Docker and AWS.
- Add a concise Render + Neon deployment section to `README.md` or point to `infra/render/README.md` and `infra/neon/README.md`.

Expected result:

- Local and deployed database configuration are documented without leaking secrets.

### 7. Validate Locally

Commands:

```bash
npm run build
npm run test
```

Optional, with a disposable Neon database or branch:

```bash
DATABASE_URL='<neon-direct-url>' npm run migrate:up
DATABASE_URL='<neon-direct-url>' npm run seed
```

Expected result:

- Build succeeds.
- Tests succeed.
- Optional Neon migration/seed validation succeeds when credentials are available.

### 8. Validate Render Deployment

Manual steps:

- Create or sync a Render Blueprint using `infra/render/render.yaml`.
- Populate all `sync: false` values in Render.
- Confirm Render deploy runs `npm run migrate:up`.
- Confirm service becomes healthy.
- Call:

```bash
curl https://auth-service.onrender.com/health
```

Expected result:

- Render deploy succeeds.
- `/health` returns the API health response.
- Neon contains the `pgmigrations` table after deploy.

## Validation Checklist

- [ ] Runtime DB helper supports `DATABASE_POOL_URL`.
- [ ] Runtime DB helper supports `DATABASE_URL`.
- [ ] Runtime DB helper preserves split `DB_*` fallback.
- [ ] DB config tests cover the resolution order.
- [ ] `infra/render/render.yaml` defines the `auth-service` Docker web service.
- [ ] Render Blueprint uses plan `free`.
- [ ] Render Blueprint uses `healthCheckPath: /health`.
- [ ] Render Blueprint uses `preDeployCommand: npm run migrate:up`.
- [ ] Render Blueprint sets `PORT=10000`.
- [ ] Render Blueprint uses `sync: false` for secrets.
- [ ] Render Blueprint does not define Render Postgres.
- [ ] `infra/render/README.md` documents Render setup and secrets.
- [ ] `infra/neon/README.md` documents manual Neon setup.
- [ ] `.env.example` documents `DATABASE_POOL_URL`.
- [ ] `README.md` points to Render + Neon setup docs.
- [ ] `npm run build` passes.
- [ ] `npm run test` passes.
- [ ] No Render or Neon secret values are committed.

## Rollback Plan

If the Render + Neon implementation causes local regressions before deployment:

1. Remove `infra/render/render.yaml`.
2. Revert DB client changes to split `DB_*` only.
3. Remove `DATABASE_POOL_URL` docs.
4. Keep AWS infrastructure untouched under `infra/aws/terraform`.

If Render deployment fails after syncing:

1. Fix env vars or Blueprint config in Render and redeploy.
2. If migrations failed against the wrong database, stop deploys and rotate the affected Neon credentials.
3. Keep AWS as the supported fallback deployment path.

## Follow-Up Work

- Move `api.auth.phablovilasboas.tech` to Render after `onrender.com` validation.
- Add custom-domain DNS docs for Render.
- Decide whether to add a paid Render plan to avoid cold starts.
- Add a one-off operational runbook for production seeds, if seeds remain necessary.
- Consider Neon branch-based staging once the first production deployment is stable.
