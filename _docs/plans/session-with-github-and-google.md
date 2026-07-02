# Session With OAuth Providers Plan

## Goal

Implement backend-owned OAuth sign-in for configurable providers, starting with Google and GitHub, while preserving the current bearer-token auth contract. The OAuth callback will not set cookies and will not expose JWTs in URLs. Instead, it will redirect the frontend with a short-lived one-time exchange code, and the frontend will exchange that code for the existing `{ token, user }` response shape.

Source spec: `docs/specs/session-with-github-and-google.md`.

## Decisions

- `docs/specs/session-management-with-cookies.md` is paused and not part of this implementation.
- The frontend continues sending `Authorization: Bearer <token>` for validation and protected routes.
- Provider names are configurable slugs, not database enums. Google and GitHub are only the first registered provider implementations.
- Provider-specific integration code lives in `src/providers` before controllers/services use it.
- The first frontend callback URL is `http://localhost:5173/signin/callback`.
- The backend exposes `GET /api/auth/oauth/providers` so the frontend can enable only configured provider buttons.
- OAuth-created users get a configured OAuth default profile via `OAUTH_DEFAULT_PROFILE_ID`.
- Same-email password users return `oauth_account_conflict` until an explicit confirmation/linking flow is implemented later.
- JWTs, provider access tokens, and provider refresh tokens never appear in callback redirect URLs.

## Implementation Steps

### 1. Add OAuth Configuration

Files:

- `.env.example`
- `src/models/oauth.model.ts`
- `src/services/oauth/provider-registry.ts`

Tasks:

- Add env entries:
  - `OAUTH_PUBLIC_BASE_URL=http://localhost:3001`
  - `OAUTH_STATE_TTL_SECONDS=600`
  - `OAUTH_EXCHANGE_CODE_TTL_SECONDS=300`
  - `OAUTH_FRONTEND_REDIRECT_ALLOWLIST=http://localhost:5173/signin/callback`
  - `OAUTH_ENABLED_PROVIDERS=google,github`
  - `OAUTH_DEFAULT_PROFILE_ID=`
  - `GOOGLE_OAUTH_CLIENT_ID=`
  - `GOOGLE_OAUTH_CLIENT_SECRET=`
  - `GOOGLE_OAUTH_CALLBACK_PATH=/api/auth/oauth/google/callback`
  - `GITHUB_OAUTH_CLIENT_ID=`
  - `GITHUB_OAUTH_CLIENT_SECRET=`
  - `GITHUB_OAUTH_CALLBACK_PATH=/api/auth/oauth/github/callback`
- Add provider slug validation using a strict format such as lowercase letters, numbers, and hyphens.
- Add a registry that resolves only enabled and implemented providers.
- Return `provider_not_supported` for malformed, disabled, or unregistered providers.

### 2. Add Database Migrations

Files:

- `src/db/migrations/007_oauth_providers.sql` or next available migration number
- `src/models/user.model.ts`

Tasks:

- Create `oauth_states` for provider callback state.
- Create `oauth_identities` for linked provider identities.
- Create `oauth_login_exchanges` for one-time frontend handoff codes.
- Store only hashes for OAuth state and exchange codes.
- Do not add provider `CHECK` constraints that restrict values to Google/GitHub.
- Make `users.password` nullable for OAuth-only accounts.
- Replace global `users.email` uniqueness with tenant-scoped normalized email uniqueness if the global constraint is still active.
- Update `UserModel.password` to `string | null`.

### 3. Add Repositories

Files:

- `src/repositories/oauth-state.repository.ts`
- `src/repositories/oauth-identity.repository.ts`
- `src/repositories/oauth-exchange.repository.ts`
- `src/repositories/user.repository.ts`

Tasks:

- Add OAuth state create/find/consume/delete-expired methods.
- Add identity lookup by `(application_id, provider, provider_user_id)`.
- Add identity create and stored-email update methods.
- Add exchange-code create/find/consume/delete-expired methods.
- Add user helpers for OAuth user creation and tenant-scoped normalized-email lookup.
- Ensure every user and identity query includes `application_id`.

### 4. Add Provider Clients

Files:

- `src/providers/oauth.provider.ts`
- `src/providers/google.provider.ts`
- `src/providers/github.provider.ts`

Tasks:

- Define the shared provider interface:
  - `buildAuthorizationUrl`
  - `exchangeCode`
  - `getProfile`
- Implement Google scopes `openid email profile`.
- Verify Google ID token audience and require `email_verified = true`.
- Implement GitHub scopes `read:user user:email`.
- Fetch GitHub profile plus primary verified email and require a verified email.
- Use stable provider user IDs as `provider_user_id`.
- Keep provider tokens internal and out of logs/responses.

### 5. Add OAuth Service

Files:

- `src/services/oauth/oauth.service.ts`
- `src/services/oauth/oauth-state.service.ts`
- `src/services/auth.service.ts`
- `src/errors/auth.error.ts`
- `src/config/i18n/locales/en/translation.json`
- `src/config/i18n/locales/pt/translation.json`

Tasks:

- Implement authorize flow:
  - validate redirect URI allowlist
  - create state and PKCE values
  - store hashed state with application context
  - return provider authorization URL
- Implement callback flow:
  - validate provider and state
  - consume state once
  - exchange provider code
  - fetch verified provider profile
  - resolve/create/link local user
  - create one-time exchange code
  - redirect to `http://localhost:5173/signin/callback`
- Implement exchange flow:
  - require `x-api-key` and `x-application-id`
  - validate and consume exchange code once
  - ensure exchange `application_id` matches the request
  - return `{ token, user }`
- Reuse existing JWT claim shape: `sub`, `email`, `profile_id`, `application_id`.
- Update password sign-in to reject null/empty password before `bcrypt.compare`.
- Add safe errors:
  - `provider_not_supported`
  - `oauth_state_invalid`
  - `oauth_state_expired`
  - `oauth_code_exchange_failed`
  - `provider_email_unverified`
  - `oauth_account_conflict`
  - `oauth_exchange_invalid`
  - `oauth_exchange_expired`
  - `oauth_provider_error`

### 6. Add Controller And Routes

Files:

- `src/controllers/auth.controller.ts`
- `src/routes/auth.routes.ts`
- `src/validators/auth.validator.ts`

Tasks:

- Add `AuthController.getOAuthProviders`.
- Add `AuthController.authorizeOAuth`.
- Add `AuthController.handleOAuthCallback`.
- Add `AuthController.exchangeOAuthCode`.
- Register:
  - `GET /api/auth/oauth/providers`
  - `POST /api/auth/oauth/:provider/authorize`
  - `GET /api/auth/oauth/:provider/callback`
  - `POST /api/auth/oauth/exchange`
- Keep `requireApiKey` and `requireApplicationId` on authorize and exchange.
- Do not require API key or application header on provider callbacks.
- Validate request bodies and params with Zod where practical.

### 7. Add Tests

Files:

- `src/test/oauth.service.spec.ts`
- `src/test/oauth.providers.spec.ts`
- `src/test/oauth.repositories.spec.ts` if repository tests are practical
- `src/test/auth.service.spec.ts`
- Controller/route tests if an HTTP helper is available

Tasks:

- Test provider config parsing for configured and missing providers.
- Test malformed, disabled, and unregistered provider slugs.
- Test provider-status response excludes secrets.
- Test authorize creates state and returns URL with state, scopes, and PKCE challenge.
- Test callback rejects missing, expired, reused, or mismatched state.
- Test exchange rejects missing, expired, reused, or mismatched-application codes.
- Test Google rejects unverified email.
- Test GitHub chooses the primary verified email.
- Test linked identity signs in the same local user.
- Test same-tenant passwordless email user can be linked.
- Test same-tenant password user returns `oauth_account_conflict`.
- Test cross-tenant same email does not link.
- Test new verified provider user is created with `password = null` and `OAUTH_DEFAULT_PROFILE_ID`.
- Test OAuth exchange returns the same redacted user shape as password sign-in.
- Test password sign-in rejects null passwords before calling bcrypt.

## Validation Checklist

- Run `npm run build`.
- Run `npm run test`.
- Run focused OAuth service/controller tests once added.
- Start the backend locally.
- Confirm `GET /api/auth/oauth/providers` returns enabled Google/GitHub metadata without secrets.
- Confirm `POST /api/auth/oauth/google/authorize` returns an authorization URL.
- Confirm `POST /api/auth/oauth/github/authorize` returns an authorization URL.
- Confirm callback redirects to `http://localhost:5173/signin/callback` with a one-time `code`.
- Confirm `POST /api/auth/oauth/exchange` returns `{ token, user }`.
- Confirm the returned token works with existing `Authorization: Bearer <token>` validation.
- Confirm no JWT or provider token appears in callback URLs, logs, or responses other than the exchange response JWT.

## Rollout Plan

1. Add migrations and run them locally.
2. Add OAuth env vars with only local callback and frontend redirect values.
3. Register local Google and GitHub OAuth applications.
4. Implement backend provider-status and authorize endpoints first so frontend buttons can be enabled conditionally.
5. Implement callback and exchange flows.
6. Validate Google sign-in locally end to end.
7. Validate GitHub sign-in locally end to end.
8. Keep bearer-token auth as the only active session model.
9. Add production callback URLs and frontend redirect URLs explicitly per environment before deployment.

## Risks

- Provider callbacks cannot send `x-api-key` or `x-application-id`; state must be created only from authorized start requests and consumed once.
- Exchange codes appear in frontend callback URLs; they must be short-lived, hashed at rest, bound to `application_id`, and one-time use.
- Automatically linking a provider to an existing password account can surprise users; return `oauth_account_conflict` until explicit confirmation exists.
- OAuth-only users require nullable passwords; password sign-in must handle null without calling bcrypt.
- The current global email unique constraint can conflict with tenant-scoped OAuth users; fix tenant-scoped uniqueness before creating OAuth users.
- Provider slugs are free-form; validate format and resolve only enabled registry entries.
- The exact Labs OAuth default profile ID is still required before final local validation.
