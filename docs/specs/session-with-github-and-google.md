# Session With OAuth Providers

## Objective

Enable backend-supported OAuth sign-in, starting with Google and GitHub for the login UI buttons that are currently disabled. The backend should own the OAuth authorization-code flow, create or link local users safely, preserve `x-application-id` tenant isolation, and issue the same JWT auth response used by password and OTP sign-in.

This spec intentionally does not depend on `docs/specs/session-management-with-cookies.md`. That implementation is paused, so this OAuth flow must keep the current contract where the frontend receives a JWT from the backend and sends it later as `Authorization: Bearer <token>`.

## Background / Current Behavior

Current auth behavior is password, OTP, and JWT based:

- `POST /api/auth/signin`, `POST /api/auth/signup`, and `POST /api/auth/verify-otp-login` call `AuthService.createAuthResponse()` and return `{ token, user }`.
- `GET /api/auth/validate-token` and `GET /api/auth/refresh-token` currently read a bearer token from `Authorization`.
- Auth routes require `x-application-id`, and most public auth routes also require `x-api-key`.
- There are no provider routes, provider clients, provider identity records, or OAuth callback handlers.
- `users.password` is currently required, which does not model OAuth-only users cleanly.
- The initial `users.email` constraint is global even though repositories now query users by `application_id`.

The frontend cannot complete provider sign-in until the backend can produce provider authorization URLs and handle provider callbacks.

## Scope

### In Scope

- Add backend OAuth sign-in through a configurable provider registry, with Google and GitHub as the first provider implementations.
- Add provider authorization URL endpoints that the frontend buttons can call before redirecting to the provider.
- Add provider callback endpoints that exchange authorization codes, validate provider identity, create or link local users, and create a one-time frontend handoff code.
- Add a handoff exchange endpoint that returns the existing `{ token, user }` auth response so the frontend can continue using bearer authorization.
- Add persistent provider identity records so users can sign in again even if provider email data changes later.
- Add short-lived OAuth state storage to carry `application_id`, frontend redirect target, and PKCE verifier through the provider redirect.
- Add environment configuration for OAuth providers, public backend callback URLs, and approved frontend redirect URLs.
- Add a public provider-status endpoint so the frontend can enable only configured provider buttons.
- Preserve `x-application-id` tenant isolation and avoid cross-application account linking.
- Support OAuth-created users without a password and assign the Labs login OAuth default profile instead of blindly using `DEFAULT_PROFILE_ID`.
- Add tests for provider flows, state handling, account linking, and rejection paths.

### Out Of Scope

- Frontend implementation beyond documenting the API contract needed to enable the disabled buttons.
- Linking a provider from an already-authenticated account settings page.
- Provider token refresh, long-lived provider access tokens, or calls to provider APIs after sign-in.
- Implementing provider clients beyond the initial Google and GitHub clients.
- Implementing the future same-email confirmation/linking UI for password accounts.
- Passwordless magic links.
- HTTP-only cookie sessions or database-backed first-party sessions.

## Proposed Approach

### Provider Flow

Use OAuth 2.0 authorization code flow with PKCE for every configured provider that supports it.

1. The frontend calls `POST /api/auth/oauth/:provider/authorize` with `x-api-key`, `x-application-id`, and a frontend redirect URI.
2. The backend validates the provider, tenant, API key, and redirect URI allowlist.
3. The backend creates a random state value and PKCE verifier/challenge.
4. The backend stores the state record with the application ID, provider, frontend redirect URI, code verifier, and expiry.
5. The backend returns `{ authorization_url, expires_at }`.
6. The frontend navigates the browser to `authorization_url`.
7. The provider redirects the browser to `GET /api/auth/oauth/:provider/callback?code=...&state=...`.
8. The backend validates and consumes the state record, exchanges the code, fetches and verifies the provider profile, finds or creates the local user, links the provider identity, creates a one-time OAuth login exchange code, and redirects to the frontend redirect URI with a status indicator and the exchange code.
9. The frontend calls `POST /api/auth/oauth/exchange` with the exchange code, `x-api-key`, and `x-application-id`.
10. The backend consumes the exchange code and returns the same `{ token, user }` shape used by password and OTP sign-in.

Callback routes should not require `x-api-key` or `x-application-id` because provider redirects cannot send those headers. The previously stored state is the source of tenant context for callback processing.

### Route Contract

Add routes in `src/routes/auth.routes.ts`:

- `POST /api/auth/oauth/:provider/authorize`
  - Middleware: `requireApiKey`, `requireApplicationId`
  - Provider path param: a configured provider slug such as `google`, `github`, `microsoft`, or another future provider
  - Body: `{ "redirect_uri": "http://localhost:5173/signin/callback" }`
  - Response: `{ "authorization_url": "...", "expires_at": "..." }`

- `GET /api/auth/oauth/:provider/callback`
  - Middleware: none of `requireApiKey` / `requireApplicationId`
  - Query: `code`, `state`, optional provider error params
  - Success behavior: create a short-lived one-time exchange code and `302` redirect to the stored frontend redirect URI with `?provider=<provider>&status=success&code=<exchange-code>`
  - Failure behavior: `302` redirect to the stored/allowed frontend redirect URI with `?provider=<provider>&status=error&reason=<safe-code>` when state is recoverable; otherwise return `400`

- `POST /api/auth/oauth/exchange`
  - Middleware: `requireApiKey`, `requireApplicationId`
  - Body: `{ "code": "<exchange-code>" }`
  - Response: `{ "token": "...", "user": { ... } }`
  - The exchange code must be consumed once, expire quickly, and match the request `x-application-id`.

- `GET /api/auth/oauth/providers`
  - Middleware: none
  - Response: `{ "providers": [{ "provider": "google", "enabled": true }, { "provider": "github", "enabled": true }] }`
  - Only return safe public metadata. Do not expose client secrets, callback internals, or tenant-specific sensitive data.

Do not put JWTs or provider access tokens in callback query strings. The only success credential allowed in the redirect URL is the short-lived one-time exchange code.

### Environment Configuration

Add to `.env.example`:

```dotenv
# OAuth
OAUTH_PUBLIC_BASE_URL=http://localhost:3001
OAUTH_STATE_TTL_SECONDS=600
OAUTH_EXCHANGE_CODE_TTL_SECONDS=300
OAUTH_FRONTEND_REDIRECT_ALLOWLIST=http://localhost:5173/signin/callback
OAUTH_ENABLED_PROVIDERS=google,github
OAUTH_DEFAULT_PROFILE_ID=

GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_CALLBACK_PATH=/api/auth/oauth/google/callback

GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
GITHUB_OAUTH_CALLBACK_PATH=/api/auth/oauth/github/callback
```

Provider app callback URLs should be built from `OAUTH_PUBLIC_BASE_URL + provider.callbackPath`.

- Local Google callback: `http://localhost:3001/api/auth/oauth/google/callback`
- Local GitHub callback: `http://localhost:3001/api/auth/oauth/github/callback`

Production callback URLs must use HTTPS.

Provider names should be free-form configured slugs, not database enums. Validate slugs at runtime with a conservative format such as lowercase letters, numbers, and hyphens, then resolve them through a provider registry. A provider is supported only when a provider client is registered and that provider appears in `OAUTH_ENABLED_PROVIDERS`.

`OAUTH_DEFAULT_PROFILE_ID` should be set to the Labs login default profile for OAuth-created users. If this becomes multi-tenant later, replace the single env var with an application-scoped profile configuration, for example a profile setting on the `applications` table or a map keyed by `application_id`.

### Provider Clients

Create a provider registry plus provider-specific clients. Provider-specific integration code should live in the new `src/providers` folder before being used by controllers and services:

- `src/services/oauth/oauth.service.ts`
- `src/services/oauth/oauth-state.service.ts`
- `src/services/oauth/provider-registry.ts`
- `src/providers/oauth.provider.ts`
- `src/providers/google.provider.ts`
- `src/providers/github.provider.ts`
- `src/repositories/oauth-state.repository.ts`
- `src/repositories/oauth-exchange.repository.ts`
- `src/repositories/oauth-identity.repository.ts`
- `src/models/oauth.model.ts`

The provider registry should expose a common interface, for example:

```ts
export type OAuthProviderSlug = string;

export interface OAuthProviderClient {
  slug: OAuthProviderSlug;
  buildAuthorizationUrl(input: OAuthAuthorizationInput): string;
  exchangeCode(input: OAuthCodeExchangeInput): Promise<OAuthTokenResult>;
  getProfile(input: OAuthTokenResult): Promise<OAuthProviderProfile>;
}

export interface OAuthProviderProfile {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
}
```

Initial provider behavior:

- Google:
  - Request scopes: `openid email profile`.
  - Exchange the authorization code for tokens.
  - Verify the ID token audience against `GOOGLE_OAUTH_CLIENT_ID`.
  - Require `email_verified = true`.
  - Use Google `sub` as `provider_user_id`.

- GitHub:
  - Request scopes: `read:user user:email`.
  - Exchange the authorization code for an access token.
  - Fetch the user profile and verified primary email from GitHub.
  - Require a verified email.
  - Use GitHub numeric `id` as `provider_user_id`.

Use Node's built-in `fetch` for GitHub calls. For Google ID token verification, prefer `google-auth-library` rather than hand-rolling JWT certificate validation. Future providers should implement the same registry interface and should not require database schema changes merely to add a new provider slug.

### Database Changes

Add a migration after the existing auth migrations.

Create `oauth_states` for short-lived callback state:

```sql
CREATE TABLE oauth_states (
  state_hash TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  application_id UUID NOT NULL REFERENCES applications(id),
  redirect_uri TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oauth_states_expires_at ON oauth_states(expires_at);
```

Store only a hash of the state value. The raw state should appear only in the provider redirect URL and callback query.

Create `oauth_identities`:

```sql
CREATE TABLE oauth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id),
  user_id UUID NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, provider, provider_user_id)
);

CREATE INDEX idx_oauth_identities_user_id ON oauth_identities(user_id);
CREATE INDEX idx_oauth_identities_application_email
  ON oauth_identities(application_id, lower(email));
```

Do not add a `CHECK` constraint that limits providers to Google and GitHub. Provider validity belongs in the runtime registry/config, because new providers should be addable without a migration.

Create `oauth_login_exchanges` for short-lived frontend handoff after provider callback:

```sql
CREATE TABLE oauth_login_exchanges (
  code_hash TEXT PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES applications(id),
  user_id UUID NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oauth_login_exchanges_expires_at
  ON oauth_login_exchanges(expires_at);
```

Store only a hash of the exchange code. The raw exchange code should appear only in the frontend redirect URL and the frontend's immediate exchange request.

Adjust `users` for OAuth-only accounts:

- Make `users.password` nullable.
- Update `UserModel.password` to `string | null`.
- Update password sign-in to reject users with a null/empty password before `bcrypt.compare`.
- Keep auth responses redacting password as `""` or omitting it consistently.

Fix tenant-scoped email uniqueness before creating OAuth users:

- Drop the global `users.email` unique constraint if it still exists.
- Add a tenant-scoped unique index on `(application_id, lower(email))`.
- Keep repository lookups scoped by `application_id`.

### Account Linking Rules

OAuth sign-in should be deterministic and tenant-scoped:

1. If `(application_id, provider, provider_user_id)` exists, sign in that linked user.
2. If no identity exists and provider email is verified, look for a user with the same normalized email in the same `application_id`.
3. If a matching active user exists and already has a password, return `oauth_account_conflict` until the future explicit confirmation/linking flow is implemented.
4. If a matching active user exists without a password, link the provider identity to that user and sign in.
5. If a matching deleted user exists, follow existing sign-up behavior: undelete the user, update the profile data if appropriate, link the provider identity, and sign in.
6. If no user exists, create a new user with `password = null`, the configured OAuth default profile, the provider display name, and the verified email.
7. Never link across `application_id`.
8. Never create or link an account when the provider email is missing or unverified.

Provider email changes should not break existing sign-in because repeat sign-ins use `provider_user_id`. Refresh the stored provider email after successful sign-in for audit/debug value, but do not use it as the primary identity key after linking.

### Token Issuance

After resolving the local user and exchanging the one-time handoff code, reuse the existing JWT creation behavior so OAuth users receive the same token claims:

- `sub`
- `email`
- `profile_id`
- `application_id`

The exchange endpoint should return the same `{ token, user }` shape as `POST /api/auth/signin` and `POST /api/auth/verify-otp-login`. The frontend then stores/uses that token exactly as it does today and sends it as `Authorization: Bearer <token>` to validation and protected endpoints.

### Error Handling

Add safe error codes for frontend callback handling:

- `provider_not_supported`
- `oauth_state_invalid`
- `oauth_state_expired`
- `oauth_code_exchange_failed`
- `provider_email_unverified`
- `oauth_account_conflict`
- `oauth_exchange_invalid`
- `oauth_exchange_expired`
- `oauth_provider_error`

Translate internal exceptions through existing `AppError` / i18n behavior for JSON endpoints. For callback redirects, send only safe reason codes in query params and log internal details server-side without provider tokens.

### Frontend Button Contract

The frontend can enable each disabled button when the matching provider is configured and the authorize endpoint succeeds.

Button click flow:

1. Call `GET /api/auth/oauth/providers` and enable only returned enabled providers.
2. Call `POST /api/auth/oauth/:provider/authorize`, where `:provider` is a configured slug such as `google` or `github`.
3. Include the same `x-api-key` and `x-application-id` headers used by password sign-in.
4. Include `http://localhost:5173/signin/callback` in `redirect_uri` for the first local rollout.
5. Navigate to the returned `authorization_url`.
6. On frontend callback success, read the one-time `code` query param and call `POST /api/auth/oauth/exchange` with `x-api-key`, `x-application-id`, and `{ "code": "..." }`.
7. Store/use the returned JWT through the existing frontend bearer-token flow.
8. Validate future requests with `Authorization: Bearer <token>`.

## Milestones / Implementation Plan

1. Add configuration and provider support checks
   - Add OAuth env vars to `.env.example`.
   - Add provider registry, config parsing, and startup-safe validation helpers.
   - Expose configured providers through backend config, not hardcoded frontend assumptions.
   - Add a public provider-status endpoint for safe frontend button enablement.

2. Add database migrations
   - Add `oauth_states`.
   - Add `oauth_identities`.
   - Add `oauth_login_exchanges`.
   - Make `users.password` nullable.
   - Replace global email uniqueness with tenant-scoped email uniqueness if needed.

3. Add repositories and models
   - Add state create/find/consume/delete-expired methods.
   - Add exchange create/find/consume/delete-expired methods.
   - Add identity find-by-provider, create, and update-email methods.
   - Add user repository helpers for OAuth user creation and tenant-scoped normalized-email lookup.

4. Add provider clients
   - Implement authorization URL creation with PKCE.
   - Implement code exchange.
   - Implement normalized provider profile extraction.
   - Enforce verified email requirements.

5. Add OAuth service
   - Implement authorize flow.
   - Implement callback flow.
   - Implement exchange-code creation and exchange-code consumption.
   - Implement account linking and user creation rules.
   - Use the configured OAuth default profile when creating OAuth-only users.
   - Return `oauth_account_conflict` for same-email password accounts until explicit confirmation linking exists.
   - Reuse auth response and JWT creation behavior.

6. Add controllers and routes
   - Add `AuthController.authorizeOAuth`.
   - Add `AuthController.handleOAuthCallback`.
   - Register provider routes in `auth.routes.ts`.

7. Integrate bearer-token handoff behavior
   - Redirect successful OAuth callbacks with only a one-time exchange code.
   - Return `{ token, user }` from the exchange endpoint.
   - Keep JWTs and provider tokens out of redirect URLs.

8. Add tests and docs
   - Add unit tests for OAuth service, provider profile mapping, state repository, and account linking.
   - Add controller tests for authorize and callback route behavior.
   - Document provider setup values for local and production environments.

## Acceptance Criteria

- [ ] `POST /api/auth/oauth/:provider/authorize` resolves any enabled provider slug through the provider registry.
- [ ] `POST /api/auth/oauth/google/authorize` returns a Google authorization URL when Google env vars are configured and `google` is enabled.
- [ ] `POST /api/auth/oauth/github/authorize` returns a GitHub authorization URL when GitHub env vars are configured and `github` is enabled.
- [ ] Unsupported, disabled, or malformed provider slugs return a safe `provider_not_supported` error.
- [ ] `GET /api/auth/oauth/providers` returns only safe public enabled-provider metadata.
- [ ] Authorize endpoints require `x-api-key` and `x-application-id`.
- [ ] Callback endpoints do not require headers from the provider redirect.
- [ ] OAuth state is random, hashed at rest, expires, and can be consumed only once.
- [ ] OAuth exchange codes are random, hashed at rest, expire, match `application_id`, and can be consumed only once.
- [ ] PKCE is used for every registered provider that supports authorization-code PKCE.
- [ ] Google sign-in rejects unverified emails.
- [ ] GitHub sign-in rejects missing or unverified emails.
- [ ] Existing linked provider identities sign in the same local user.
- [ ] New verified provider identities link to an existing same-tenant email user only when that user does not already have a password.
- [ ] Same-email password users receive `oauth_account_conflict` until the explicit confirmation flow is implemented.
- [ ] New verified provider identities create a passwordless local user with the configured OAuth default profile when no user exists.
- [ ] OAuth linking never crosses `application_id`.
- [ ] OAuth callback redirects to an allowlisted frontend URI with a one-time exchange code, not a JWT.
- [ ] `POST /api/auth/oauth/exchange` returns the existing `{ token, user }` auth response.
- [ ] Callback redirects never include JWTs, provider access tokens, or provider refresh tokens.
- [ ] Existing bearer-token validation continues to work with OAuth-issued JWTs.
- [ ] Password sign-in still works for password users.
- [ ] Password sign-in fails cleanly for OAuth-only users with `password = null`.
- [ ] The disabled frontend buttons have a backend route contract that can enable them provider by provider.
- [ ] Adding a future provider does not require changing the `oauth_states` or `oauth_identities` schema.

## Test Plan

### Unit

- Test provider config parsing for configured and missing providers.
- Test malformed, disabled, and unregistered provider slugs are rejected.
- Test provider-status returns enabled providers without secrets.
- Test authorize flow creates state and returns an authorization URL with `state`, PKCE challenge, and expected scopes.
- Test callback rejects missing, expired, reused, or mismatched state.
- Test exchange rejects missing, expired, reused, or mismatched application codes.
- Test Google provider mapping requires `email_verified`.
- Test GitHub provider mapping chooses the primary verified email.
- Test identity lookup signs in an already-linked user.
- Test verified same-tenant email links to an existing passwordless user.
- Test verified same-tenant email returns `oauth_account_conflict` for an existing password user.
- Test same email in a different `application_id` does not link.
- Test new verified email creates a user with `password = null` and the configured OAuth default profile.
- Test password sign-in rejects null passwords before calling `bcrypt.compare`.
- Test OAuth exchange returns the same redacted user shape as password sign-in.

### Integration / Controller

- Call `POST /api/auth/oauth/google/authorize` without `x-api-key` and assert the existing API-key error.
- Call `POST /api/auth/oauth/google/authorize` without `x-application-id` and assert the existing application error.
- Call `GET /api/auth/oauth/providers` and assert it returns enabled provider slugs without secrets.
- Call `POST /api/auth/oauth/unknown-provider/authorize` and assert `provider_not_supported`.
- Call authorize with an unallowlisted `redirect_uri` and assert `400`.
- Mock provider exchange and call callback with valid state; assert `302` redirect contains only a one-time exchange code.
- Call `POST /api/auth/oauth/exchange` with a valid code and assert `{ token, user }`.
- Call `POST /api/auth/oauth/exchange` with an already-used code and assert an invalid/expired exchange error.
- Call callback with provider error params; assert safe redirect reason.
- Call callback with invalid state; assert no exchange code or token is issued.
- Verify created JWT claims include the stored `application_id`.

### Manual

- Register local Google and GitHub OAuth apps with callback URLs pointing to `http://localhost:3001/api/auth/oauth/<provider>/callback`.
- Configure `.env` with provider IDs/secrets and the frontend redirect allowlist.
- Start the backend and frontend locally.
- Click Google sign-in and confirm the browser returns to the frontend authenticated.
- Click GitHub sign-in and confirm the browser returns to the frontend authenticated.
- Confirm the frontend exchanges the callback code for `{ token, user }`.
- Confirm protected requests continue to send `Authorization: Bearer <token>`.
- Confirm repeat provider sign-in reuses the same local user.
- Confirm same-email password users receive the expected conflict state until explicit linking is added.
- Confirm password sign-in still works for existing password users.

## Risks And Mitigations

- Risk: OAuth callback cannot carry existing API headers.
  - Mitigation: create state only from an authenticated authorize request and recover tenant context from that state on callback.

- Risk: Tokens leak through callback URLs.
  - Mitigation: redirect only with a short-lived one-time exchange code, then return the JWT from a backend exchange endpoint.

- Risk: Exchange codes can be replayed if copied from the callback URL.
  - Mitigation: store only a hash, expire codes quickly, bind them to `application_id`, and consume each code once.

- Risk: Cross-tenant account linking.
  - Mitigation: every user and identity lookup includes `application_id`, and identity uniqueness includes `application_id`.

- Risk: Provider email changes.
  - Mitigation: use provider stable IDs as the primary linked identity after first sign-in.

- Risk: Free-form provider names allow invalid or confusing provider values.
  - Mitigation: validate provider slugs with a strict format and resolve only enabled providers from the runtime registry.

- Risk: Unverified provider emails allow account takeover.
  - Mitigation: require verified emails before linking or creating users.

- Risk: Automatically linking a provider to an existing password account surprises users.
  - Mitigation: return `oauth_account_conflict` now and add explicit confirmation/linking in a later feature.

- Risk: OAuth-only users break password auth because `password` becomes nullable.
  - Mitigation: update `UserModel`, repository types, and `AuthService.signIn` to reject null/empty passwords before bcrypt.

- Risk: Existing global email uniqueness conflicts with multi-tenant OAuth users.
  - Mitigation: replace global uniqueness with tenant-scoped normalized email uniqueness.

- Risk: Stale OAuth states accumulate.
  - Mitigation: delete consumed states immediately and periodically delete expired rows in the authorize/callback service path or a maintenance script.

## Resolved Decisions

- The first frontend callback path to allowlist is `http://localhost:5173/signin/callback`.
- The backend should expose a public provider-status endpoint so the frontend can enable only configured providers.
- OAuth-created users should receive the Labs login OAuth default profile, configured separately from the generic `DEFAULT_PROFILE_ID`.
- Same-email linking for existing password accounts should require an explicit confirmation step in a future feature; until that exists, return `oauth_account_conflict`.

## Open Questions

- Which exact profile ID should be configured as `OAUTH_DEFAULT_PROFILE_ID` for the Labs login application?
