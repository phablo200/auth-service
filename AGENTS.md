# Repository Guidelines

## Project Structure & Module Organization

This is a Node.js, Express, and TypeScript auth service. Application code lives in `src/`, split by layer: `controllers/` handle HTTP, `routes/` register endpoints, `services/` hold business logic, `repositories/` access PostgreSQL, `validators/` define Zod validation, and `middleware/` contains Express middleware. Shared shapes are in `models/` and `types/`. SQL lives in `src/db/migrations/` and `src/db/seeds/`; CLI runners are in `src/scripts/`. Tests are in `src/test/`, mail templates in `src/mail/templates/`, and longer docs in `docs/`.

## Build, Test, and Development Commands

- `npm install`: install dependencies; Node `>=24.12.0` is expected.
- `cp .env.example .env`: create local configuration before running the API.
- `docker-compose up -d`: start the API, PostgreSQL 16, and Redis 7 containers.
- `npm run dev`: run nodemon with inspector on `9229`.
- `npm run build`: compile TypeScript to `dist/`.
- `npm run start`: run the compiled server from `dist/main.js`.
- `npm run migrate` / `npm run seed`: apply SQL migrations or load seed data.
- `npm run test`, `npm run test:watch`, `npm run test:coverage`: run Vitest once, watch, or with coverage.

## Coding Style & Naming Conventions

Use TypeScript with `strict` mode. Follow existing formatting: two-space indentation, double quotes, semicolons, and named imports where practical. Keep filenames lowercase and layer-qualified, such as `auth.service.ts`, `user.repository.ts`, and `application.middleware.ts`. Classes use `PascalCase`; constants use `UPPER_SNAKE_CASE`; functions, variables, and methods use `camelCase`. Keep controllers thin, business rules in services, and database work in repositories or migrations.

## Testing Guidelines

Vitest is configured in `vitest.config.ts` with Node environment, globals, mock reset, and V8 coverage. Name test files `*.spec.ts` and place them under `src/test/`. Mock repositories, JWT, bcrypt, and email delivery in unit tests. Run `npm run test` before opening a PR, and use coverage for authentication, password reset, OTP, or authorization changes.

## Commit & Pull Request Guidelines

Git history uses short prefixes such as `feat:`, `fix -`, `config(CORS) -`, `test:`, and `seed:`. Prefer concise, imperative subjects with a clear area, for example `feat(auth): add OTP expiry checks`. Pull requests should include a problem statement, implementation summary, migration or seed notes, test results, and environment changes. Add screenshots only for visible API docs or email templates.

## Security & Configuration Tips

Never commit `.env`, JWT keys, SMTP credentials, API keys, or production database URLs. Tenant-scoped API requests require `x-application-id`; preserve that isolation in services, queries, and tests. Redact passwords and tokens from logs and responses.
