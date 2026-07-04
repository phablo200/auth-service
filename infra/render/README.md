# Render Infrastructure

Render is the planned lower-cost web service runtime for `auth-service`.

The Render Blueprint lives at:

```text
infra/render/render.yaml
```

The first deployment uses:

- Service name: `auth-service`
- Plan: free
- Runtime: Docker
- Public URL: `https://auth-service.onrender.com`
- Health check: `/health`
- Pre-deploy command: `npm run migrate:up`

Create or sync the Render service from `infra/render/render.yaml`. Render defaults to a root `render.yaml`, so select this file path when creating the Blueprint.

Do not commit Render secrets. Configure actual secret values in Render. Values marked with `sync: false` may need manual updates in the Render dashboard after the first Blueprint creation.

Neon connection values:

- `DATABASE_URL`: Neon direct connection string, used by migrations and seeds.
- `DATABASE_POOL_URL`: Neon pooled connection string, used by API runtime.

Expected secret/config values include:

- `DATABASE_URL`
- `DATABASE_POOL_URL`
- `JWT_SECRET`
- `API_KEY`
- OAuth client IDs and secrets
- Mail credentials

Seeds are not run automatically during deploy. Run `npm run seed` manually against Neon only when fixture data is desired.
