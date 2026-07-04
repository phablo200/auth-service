# Neon Infrastructure

Neon is the planned lower-cost PostgreSQL provider for `auth-service`.

The first Neon implementation is manual setup. Do not add Terraform or provider API tokens for Neon in the initial version.

Keep the current app behavior and database schema unchanged:

- Deploy the same auth-service code.
- Run the same migrations.
- Treat Neon as PostgreSQL in a different provider.

## Setup

1. Create a Neon project.
2. Use the default production branch or create a production branch.
3. Create an `auth-service` database, or use the default database if that is preferred.
4. Copy both connection strings:
   - Direct connection string.
   - Pooled connection string.
5. Confirm the URLs include Neon SSL options such as `sslmode=require`.

Store Neon connection strings in Render secrets, not in the repository:

- `DATABASE_URL`: direct connection string for `npm run migrate:up` and `npm run seed`.
- `DATABASE_POOL_URL`: pooled connection string for API runtime.

## Migrations

Run migrations with the direct Neon URL:

```bash
DATABASE_URL='<neon-direct-url>' npm run migrate:up
```

## Seeds

Seeds are optional and should be run manually only when fixture data is desired:

```bash
DATABASE_URL='<neon-direct-url>' npm run seed
```
