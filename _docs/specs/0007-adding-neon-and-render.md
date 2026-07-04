# Adding Neon And Render Deployment

## Objective

Add a lower-cost deployment path for `auth-service` using Render for the Node.js/Express API and Neon for PostgreSQL.

The first implementation should keep the current application behavior, database schema, migrations, and seed data flow intact. Neon should be treated as PostgreSQL in a different provider, and Render should run the existing Dockerized API with provider-native configuration committed under `infra/render/`.

## Background

The AWS ECS/RDS/ALB lab stack works and remains supported under `infra/aws/terraform/`, but it is too expensive to leave running for a low-traffic lab. The repository now has provider-specific infrastructure folders:

```text
infra/
  aws/
  render/
  neon/
```

The current app shape is compatible with Render + Neon with small deployment-oriented changes:

- `Dockerfile` builds the TypeScript app and starts `node dist/main.js`.
- The API exposes `GET /health`.
- The app listens on `process.env.PORT || 3001`.
- Runtime database access uses `DATABASE_POOL_URL` when present and falls back to `DATABASE_URL`.
- Migration tooling uses `node-pg-migrate`, which reads `DATABASE_URL`.
- Seed tooling uses `DATABASE_URL`.

Render web services need to bind to `0.0.0.0` and should use the `PORT` environment variable. Render Blueprints support Docker services, health check paths, `preDeployCommand`, `initialDeployHook`, and secret prompts with `sync: false`.

Neon connection strings include SSL parameters such as `sslmode=require`, and Neon supports pooled connection strings by adding `-pooler` to the hostname. The API should use a Neon pooled URL for runtime connections, while migrations should use a direct Neon URL.

References:

- Render Blueprint YAML reference: https://render.com/docs/blueprint-spec
- Render web services and port binding: https://render.com/docs/web-services
- Neon application connection strings: https://neon.com/docs/connect/connect-from-any-app
- Neon connection pooling: https://neon.com/docs/connect/connection-pooling

## Scope

### In Scope

- Add Render-native deployment config under `infra/render/`.
- Document manual Neon setup under `infra/neon/`.
- Add app database connection support for URL-based Neon connections.
- Keep existing split `DB_*` support for local Docker and AWS compatibility.
- Use Neon direct connection URL for migrations.
- Use Neon pooled connection URL for API runtime.
- Configure Render secrets without committing secret values.
- Configure Render health check to `/health`.
- Keep the existing Dockerfile as the Render build source.
- Ensure the Docker image contains migration files required by Render `preDeployCommand`.
- Keep schema and seed behavior unchanged.
- Update `.env.example` and deployment docs for new Render/Neon variables.

### Out of Scope

- Replacing the custom auth-service schema with Supabase/Auth0/Clerk auth.
- Migrating existing AWS RDS data to Neon.
- Creating Neon through Terraform or Neon API automation.
- Creating Render through Terraform.
- Adding Render Postgres.
- Adding Redis/Valkey.
- Adding paid autoscaling, private networking, dedicated IPs, or production SLAs.
- Changing OAuth provider behavior beyond updating callback/base URLs for the Render domain.
- Running seeds automatically on every Render deploy.

## Proposed Approach

Use Render-native config for the API and documented manual setup for Neon:

```text
infra/
  render/
    README.md
    render.yaml
  neon/
    README.md
```

### Database Configuration

Add a shared database configuration helper used by `src/db/pool.ts` and `src/db/client.ts`.

Resolution order:

1. `DATABASE_POOL_URL`
2. `DATABASE_URL`
3. Split `DB_*` variables

`DATABASE_POOL_URL` is the preferred runtime value on Render. It should contain the Neon pooled connection string with `sslmode=require` and `channel_binding=require` when Neon provides it.

`DATABASE_URL` is the direct Neon connection string used by:

- `npm run migrate:up`
- `npm run migrate`
- `npm run seed`
- local production migration commands

The application should remain compatible with local Docker Compose and AWS by keeping split `DB_*` fallback support.

Update files:

- `src/db/pool.ts`
- `src/db/client.ts`
- `.env.example`
- `README.md`
- `infra/neon/README.md`

### Render Configuration

Add `infra/render/render.yaml` with one Docker web service:

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
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false
      - key: DATABASE_POOL_URL
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: API_KEY
        sync: false
```

Add all required OAuth and mail variables as `envVars`. Use literal values for non-sensitive config and `sync: false` for secrets.

Do not define a Render Postgres database in `render.yaml`; Neon is the database provider.

Render's Blueprint file defaults to `render.yaml` in the repo root, but Render allows customizing the Blueprint file during setup. The implementation should document that this repo uses:

```text
infra/render/render.yaml
```

### Neon Manual Setup

Document the Neon setup flow in `infra/neon/README.md`:

1. Create a Neon project.
2. Create or use the default production branch.
3. Create a database for `auth-service`.
4. Copy both direct and pooled connection strings.
5. Store the direct string in Render as `DATABASE_URL`.
6. Store the pooled string in Render as `DATABASE_POOL_URL`.
7. Run migrations with `npm run migrate:up`.
8. Run seeds once with `npm run seed` only when seed data is desired.

For the first version, use manual Neon setup instead of Terraform/API automation to keep the deployment simple and avoid managing provider tokens.

### Runtime URLs

Use the initial Render URL first:

```text
https://<render-service-name>.onrender.com
```

Set:

- `OAUTH_PUBLIC_BASE_URL` to the Render API base URL.
- `APP_BASE_URL` to the Render API base URL unless mail links require a frontend URL.
- OAuth provider callback URLs to:
  - `https://<render-service-name>.onrender.com/api/auth/oauth/google/callback`
  - `https://<render-service-name>.onrender.com/api/auth/oauth/github/callback`

Custom domains can be added later. Do not block the first deployment on DNS. For the first deployment, use Render's HTTPS `onrender.com` URL only. Do not move `api.auth.phablovilasboas.tech` from AWS to Render in this implementation.

### Migration And Seed Policy

Run migrations through Render `preDeployCommand` so schema changes are applied before a new service revision starts.

Do not run seeds automatically in `preDeployCommand`. Seeds should be manual for the first setup because they create fixture applications/users and should not rerun unexpectedly in production.

## Milestones

1. Prepare app database URL support.
   - Add shared DB config logic for `DATABASE_POOL_URL`, `DATABASE_URL`, and split `DB_*`.
   - Update `src/db/pool.ts` and `src/db/client.ts`.
   - Remove noisy DB env logging from production database clients if present.

2. Add Render Blueprint.
   - Ensure the production Docker image includes migration files needed by Render deploy commands.
   - Create `infra/render/render.yaml`.
   - Configure Docker runtime, health check, `PORT=10000`, and `preDeployCommand`.
   - Declare all required runtime env vars.
   - Mark secrets as `sync: false`.

3. Document Neon setup.
   - Update `infra/neon/README.md`.
   - Document direct vs pooled connection strings.
   - Document migration and optional seed commands.

4. Update deployment documentation.
   - Update `infra/render/README.md`.
   - Update root `README.md` only with concise Render + Neon deployment pointers.
   - Update `.env.example` with `DATABASE_POOL_URL`.

5. Validate locally.
   - Run `npm run build`.
   - Run `npm run test`.
   - If a Neon test database is available, run migrations and seeds against Neon.

6. Validate on Render.
   - Create/sync the Render Blueprint using `infra/render/render.yaml`.
   - Add required secret values in Render.
   - Confirm first deploy completes.
   - Confirm `/health` returns success.

## Edge Cases

- Render free services may sleep and have cold starts.
- Neon free projects may pause after inactivity, causing the first request after idle time to be slower.
- `sync: false` secrets are prompted during initial Blueprint creation; new secrets added later may need manual dashboard updates.
- If `DATABASE_POOL_URL` is missing, the API should fall back to `DATABASE_URL`.
- If both URL variables are missing, local split `DB_*` variables should continue to work.
- If OAuth providers are configured before the final Render URL is known, callbacks may fail until provider dashboards are updated.
- If `preDeployCommand` migrations fail, Render should not promote the new deployment.

## Acceptance Criteria

- [ ] `infra/render/render.yaml` defines one Docker web service for `auth-service`.
- [ ] Render service config uses `/health` as the health check path.
- [ ] Render service config sets `PORT=10000`.
- [ ] Render service config runs `npm run migrate:up` as a pre-deploy command.
- [ ] Render service config declares required secrets with `sync: false`.
- [ ] No Neon or Render secret values are committed.
- [ ] `infra/neon/README.md` documents manual Neon setup and direct vs pooled connection strings.
- [ ] Runtime DB clients support `DATABASE_POOL_URL`, `DATABASE_URL`, and split `DB_*` fallback.
- [ ] Existing local Docker/AWS split `DB_*` configuration remains compatible.
- [ ] `npm run build` succeeds.
- [ ] `npm run test` succeeds.
- [ ] Render deployment reaches a healthy state.
- [ ] `GET /health` succeeds on the Render URL.
- [ ] Migrations apply successfully to Neon.

## Test Plan

- Unit:
  - Add or update tests for database config resolution if a config helper is introduced.
  - Confirm fallback order: `DATABASE_POOL_URL`, `DATABASE_URL`, then split `DB_*`.

- Integration:
  - Run `npm run build`.
  - Run `npm run test`.
  - Run `DATABASE_URL=<neon-direct-url> npm run migrate:up` against a Neon test branch when available.
  - Run `DATABASE_URL=<neon-direct-url> npm run seed` once against a disposable Neon branch when seed validation is needed.

- Manual verification:
  - Sync the Render Blueprint from `infra/render/render.yaml`.
  - Populate Render secrets.
  - Confirm Render deploy logs show migrations completed.
  - Call `GET /health` on the Render URL.
  - Run one authenticated API flow with `x-application-id` after seed data is present.
  - Confirm Neon dashboard shows active connections and the `pgmigrations` table.

## Risks and Mitigations

- Risk: Neon requires SSL and the app currently uses split DB config without explicit SSL.
  - Mitigation: Prefer URL-based connections with Neon-provided SSL query parameters.

- Risk: Render pre-deploy migrations apply to the wrong database.
  - Mitigation: Store only the intended Neon direct URL in Render `DATABASE_URL` and verify the target project before first deploy.

- Risk: Running seeds automatically creates or overwrites fixture data unexpectedly.
  - Mitigation: Keep seeds manual for the first Render + Neon setup.

- Risk: Free-tier services pause or sleep, causing slow first requests.
  - Mitigation: Accept this for lab usage and document it; upgrade plans only if uptime matters.

- Risk: OAuth callback URLs change after adding a custom domain.
  - Mitigation: Deploy first on `onrender.com`, then update OAuth provider dashboards and Render env vars when a custom domain is introduced.

- Risk: Render Blueprint secrets with `sync: false` are ignored on later updates.
  - Mitigation: Document manual dashboard updates for newly added secrets.

## Open Questions

- Resolved: The first Render service name should be `auth-service`.
- Resolved: The first Render deployment should use the free plan.
- Resolved: The first public API URL should use Render's HTTPS `onrender.com` domain only. Moving `api.auth.phablovilasboas.tech` to Render is deferred until after the first deployment is validated.
