# Neon Infrastructure

Neon is the planned lower-cost PostgreSQL provider for `auth-service`.

The first Neon implementation should be documented manual setup. Do not add Terraform or provider API tokens for Neon in the initial version.

Keep the current app behavior and database schema unchanged:

- Deploy the same auth-service code.
- Run the same migrations.
- Treat Neon as PostgreSQL in a different provider.

Store the Neon connection string in Render secrets, not in the repository.
