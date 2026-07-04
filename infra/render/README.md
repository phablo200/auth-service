# Render Infrastructure

Render is the planned lower-cost web service runtime for `auth-service`.

The first Render implementation should use Render-native configuration in the repo, expected at:

```text
infra/render/render.yaml
```

Do not commit Render secrets. Configure actual secret values in Render.

Expected secret/config values include:

- `DATABASE_URL` or split database variables
- `JWT_SECRET`
- `API_KEY`
- OAuth client IDs and secrets
- Mail credentials
