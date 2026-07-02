# Session Management With HTTP-Only Cookies

## Objective

Move browser session ownership from the frontend to `auth-service` by storing the existing JWT in a backend-managed `HttpOnly` cookie. Successful sign-in, sign-up, and OTP verification should set the cookie. Token validation, refresh, and logout should read or clear that cookie without requiring the frontend to read JWTs from JavaScript.

This spec is the backend counterpart to `/home/danii/myProjects/me-login/docs/specs/0008-session-management-with-cookies.md`.

## Background / Current Behavior

The frontend spec defines a temporary frontend-managed cookie because this backend currently returns JWTs in JSON responses. Today:

- `AuthService.createAuthResponse()` signs a JWT and returns `{ token, user }`.
- `POST /api/auth/signin`, `POST /api/auth/signup`, and `POST /api/auth/verify-otp-login` return the token in the response body.
- `GET /api/auth/validate-token` and `GET /api/auth/refresh-token` require an `Authorization: Bearer <token>` header.
- `POST /api/auth/validate-token` currently calls the same controller but has no reliable token source unless the client sends an Authorization header.
- CORS allows `http://localhost:5173` but does not enable credentials.
- No backend logout endpoint exists.

The target behavior is a stateless JWT session carried by a secure cookie, not a database-backed session table.

## Scope

### In Scope

- Add backend-managed session cookie support for the existing JWT.
- Mark the cookie `HttpOnly`, `Path=/`, and `Secure` outside local HTTP development.
- Use `SameSite=Lax` for same-site frontends and `SameSite=None; Secure` for approved cross-site frontends.
- Align cookie lifetime with `JWT_EXPIRES_IN`, currently `1h`.
- Set the cookie on successful sign-in, sign-up, and OTP verification.
- Read the token from the cookie for validation and refresh.
- Add a logout endpoint that clears the cookie.
- Keep tenant isolation through `x-application-id`.
- Enable credentialed CORS for approved frontend origins.
- Keep a short migration window where JSON token responses may remain available for frontend clients that still read `response.token`.

### Out of Scope

- Refresh-token rotation or persistent session storage.
- OAuth provider sessions.
- CSRF token infrastructure beyond cookie and CORS hardening.
- Frontend implementation changes.
- Changing user/profile/application schemas.

## Proposed Approach

### Cookie Contract

Introduce one private cookie name, for example `auth210_session`, owned only by the backend. Add a small helper module, such as `src/util/session-cookie.util.ts`, with:

- `setSessionCookie(res: Response, token: string): void`
- `clearSessionCookie(res: Response): void`
- `getSessionToken(req: Request): string | null`

Cookie attributes:

- `httpOnly: true`
- `secure: true` in production or when `SESSION_COOKIE_SECURE=true`; `false` for local `http://localhost`
- `sameSite: "lax"` by default, or `"none"` with `secure: true` for cross-site frontend deployments
- `path: "/"`
- `maxAge: 60 * 60 * 1000` while `JWT_EXPIRES_IN = "1h"`
- no `domain` by default, which creates a host-only cookie for the auth backend host

Add environment variables to `.env.example`:

- `SESSION_COOKIE_NAME=auth210_session`
- `SESSION_COOKIE_SECURE=false`
- `SESSION_COOKIE_SAME_SITE=lax`
- `SESSION_COOKIE_DOMAIN=` optional; leave empty unless multiple backend subdomains must receive the same cookie

Use `cookie-parser` or a typed internal parser so controllers and middleware do not parse the `Cookie` header manually.

### Auth Success Responses

Keep `AuthService` responsible for creating JWTs and redacting user passwords. Controllers should set the cookie after successful:

- `POST /api/auth/signin`
- `POST /api/auth/signup`
- `POST /api/auth/verify-otp-login`

Recommended migration behavior:

- Phase 1: set the cookie and continue returning `{ token, user }` to avoid breaking current frontend clients.
- Phase 2: stop returning `token` by default once every approved frontend client uses `credentials: "include"` and no longer reads JWTs from response bodies.

If a feature flag is preferred, use `AUTH_RETURN_TOKEN_IN_BODY=true` for temporary compatibility.

### Token Reading

Update `authorization.middleware.ts` so authenticated routes can read the token from either:

1. The `auth210_session` cookie.
2. The legacy `Authorization: Bearer <token>` header during migration.

Prefer the cookie when both are present. `getAuthToken(req)` should use the same logic so controllers do not duplicate token lookup.

### Validation, Refresh, and Logout

Update validation endpoints to support cookie-backed sessions:

- `GET /api/auth/validate-token`: validate the cookie token and return `{ valid: true }`.
- `POST /api/auth/validate-token`: same behavior, retained for frontend compatibility.
- Missing or invalid cookies should return `401` through the existing auth error flow.

Update refresh:

- `GET /api/auth/refresh-token` reads the current cookie/header token.
- On success, set a new `auth210_session` cookie with the refreshed JWT.
- Return `{ valid: true }` or `{ refreshed: true }`; keep `{ refreshedToken }` only during migration if needed.

Add logout:

- `POST /api/auth/logout`
- Requires `requireApiKey` and `requireApplicationId`.
- Idempotently clears the known auth session cookie, even when the token is expired or invalid.
- Clears `auth210_session` with the same `path`, `sameSite`, `secure`, and optional `domain` settings used when setting it.
- Returns `204 No Content` or `{ message: "Logged out" }`.

### CORS and Client Compatibility

Update `src/config/cors/index.ts`:

- Keep an allowlist of trusted frontend origins.
- Set `credentials: true`.
- Do not use wildcard origins with credentials.

The frontend must call cookie-backed auth endpoints with `credentials: "include"`. Backend tests should verify the `Access-Control-Allow-Credentials` behavior through CORS config, not by weakening origin checks.

For multiple frontends, each allowed origin must be configured explicitly. If a frontend is on the same site as the backend, such as `app.example.com` calling `auth.example.com`, `SameSite=Lax` is usually sufficient. If a frontend is on a different site, such as `other-product.com` calling `auth.example.com`, browser cookie rules require `SameSite=None; Secure`.

## Milestones / Implementation Plan

1. Add cookie infrastructure
   - Install and configure `cookie-parser` if using that package.
   - Add the session-cookie helper.
   - Add environment defaults to `.env.example`.
2. Set cookies on login flows
   - Update `AuthController.signIn`, `signUp`, and `verifyOtpLogin`.
   - Preserve existing token body responses during migration.
3. Read cookies for protected auth endpoints
   - Update `requireAuthToken` and `getAuthToken`.
   - Preserve Authorization header support temporarily.
4. Add logout
   - Add `AuthController.logout`.
   - Register `POST /api/auth/logout` in `src/routes/auth.routes.ts`.
   - Clear the session cookie consistently without requiring a valid token.
5. Update refresh behavior
   - Set a replacement cookie when refresh succeeds.
   - Define migration-compatible response shape.
6. Harden CORS
   - Add `credentials: true`.
   - Keep explicit allowed origins.
7. Update tests and docs
   - Add unit tests for cookie helper behavior.
   - Extend `src/test/auth.service.spec.ts` or add controller/middleware tests.
   - Document frontend requirement to use `credentials: "include"`.

## Acceptance Criteria

- [ ] Successful sign-in sets an `HttpOnly` session cookie.
- [ ] Successful sign-up sets an `HttpOnly` session cookie.
- [ ] Successful OTP verification sets an `HttpOnly` session cookie.
- [ ] The session cookie uses `HttpOnly`, `Path=/`, bounded max age, configured `SameSite`, and `Secure` according to environment.
- [ ] Token validation succeeds using only the cookie and no Authorization header.
- [ ] Refresh succeeds using the cookie and replaces the cookie with a fresh JWT.
- [ ] Logout clears the cookie using matching attributes and succeeds even when the token is missing, expired, or invalid.
- [ ] Credentialed CORS is enabled only for allowlisted origins.
- [ ] Legacy Authorization header clients still work during the migration window.
- [ ] Passwords are never returned in auth responses.
- [ ] `x-application-id` remains required for tenant-scoped auth requests.

## Test Plan

### Unit

- Test `setSessionCookie` emits the expected cookie name, value, max age, path, `HttpOnly`, `SameSite`, and `Secure` attributes.
- Test `clearSessionCookie` expires the same cookie name and path.
- Test `getSessionToken` returns the cookie token when present.
- Test `getAuthToken` prefers cookie token over Authorization header.
- Test `getAuthToken` falls back to Authorization header during migration.
- Test missing token returns `401`.

### Controller / Integration

- Mock `AuthService.signIn`, call `POST /api/auth/signin`, and assert `Set-Cookie` exists.
- Repeat for sign-up and OTP verification.
- Call validation with only a `Cookie` header and assert `{ valid: true }`.
- Call refresh with only a `Cookie` header and assert a replacement `Set-Cookie`.
- Call logout with valid, expired, invalid, and missing cookies; assert the cookie is expired.
- Verify CORS config allows credentials for `http://localhost:5173`.

### Manual

- Start backend and frontend locally.
- Sign in and confirm the browser stores the session cookie.
- Confirm JavaScript cannot read the cookie because it is `HttpOnly`.
- Refresh a protected frontend route and confirm the session persists.
- Log out and confirm the cookie is removed or expired.
- Confirm requests include cookies only when the frontend uses `credentials: "include"`.

## Risks and Mitigations

- Risk: `SameSite=Lax` will not work for some cross-site frontend deployments.
  - Mitigation: Configure those deployments with `SameSite=None`, `Secure=true`, and strict CORS.
- Risk: Cookie-backed JWTs are vulnerable to CSRF on state-changing endpoints.
  - Mitigation: Keep `SameSite=Lax`, avoid wildcard CORS, require `x-application-id` and API key where applicable, and add CSRF tokens if cross-site cookies are required.
- Risk: Existing clients depend on token-in-body responses.
  - Mitigation: keep token body responses during Phase 1 or guard removal behind `AUTH_RETURN_TOKEN_IN_BODY`.
- Risk: Cookie clearing can fail if attributes differ.
  - Mitigation: centralize set and clear options in one helper.
- Risk: Frontend forgets `credentials: "include"`.
  - Mitigation: document this requirement and verify with integration/manual tests.

## Resolved Decisions

- `AUTH_RETURN_TOKEN_IN_BODY` should default to `true` during migration. Here, "all clients migrate" means every approved frontend using this backend has stopped reading JWTs from response bodies and sends cookie-backed requests with `credentials: "include"`.
- Logout should be idempotent and clear the backend session cookie without requiring a valid token. The backend cannot clear tokens stored manually by a client outside this cookie, such as an Authorization header value in frontend state.
- This backend supports multiple frontends. Use per-environment `SESSION_COOKIE_SAME_SITE`: `lax` for same-site frontend/backend deployments and `none` with `Secure=true` for cross-site deployments.
- Use host-only cookies by default. Set `SESSION_COOKIE_DOMAIN` only if multiple backend subdomains must receive the same auth cookie; it is not needed merely because multiple frontends call the same auth backend.

## Open Questions

- Which production frontend origins should be added to the CORS allowlist for the first cookie-backed rollout? Keep only our localhost:5173 for now.
- Which deployed frontend/backend pairs are same-site, and which are cross-site? for now, let's keep localhost:5173.
