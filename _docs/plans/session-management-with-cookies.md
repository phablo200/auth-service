# Session Management With HTTP-Only Cookies Plan

## Goal

Implement backend-owned session cookies for `auth-service` so browser clients no longer need to store JWTs in JavaScript-readable cookies. The backend will set, read, refresh, and clear an `HttpOnly` JWT cookie while temporarily preserving token-in-body and Authorization-header compatibility for existing clients.

Source spec: `docs/specs/session-management-with-cookies.md`.

## Decisions

- First rollout supports only `http://localhost:5173` in the CORS allowlist.
- `AUTH_RETURN_TOKEN_IN_BODY` defaults to `true` during migration.
- Logout is idempotent: it clears the backend session cookie even when the token is missing, expired, or invalid.
- Cookies are host-only by default. `SESSION_COOKIE_DOMAIN` stays empty unless a future deployment requires shared backend subdomains.
- Default cookie mode is `SameSite=Lax`; use `SameSite=None; Secure` only for approved cross-site deployments.
- The session remains stateless: no database session table or refresh-token rotation in this plan.

## Implementation Steps

### 1. Add Cookie Infrastructure

Files:

- `package.json`
- `package-lock.json`
- `.env.example`
- `src/main.ts`
- `src/util/session-cookie.util.ts`

Tasks:

- Install `cookie-parser` and `@types/cookie-parser`, or implement an equivalent typed parser if avoiding a dependency.
- Register cookie parsing before routes in `src/main.ts`.
- Add `.env.example` entries:
  - `SESSION_COOKIE_NAME=auth210_session`
  - `SESSION_COOKIE_SECURE=false`
  - `SESSION_COOKIE_SAME_SITE=lax`
  - `SESSION_COOKIE_DOMAIN=`
  - `AUTH_RETURN_TOKEN_IN_BODY=true`
- Create `session-cookie.util.ts` with `setSessionCookie`, `clearSessionCookie`, and `getSessionToken`.
- Centralize all cookie options in that helper so set and clear behavior cannot drift.

### 2. Enable Credentialed CORS

Files:

- `src/config/cors/index.ts`

Tasks:

- Keep `allowedOrigins = ["http://localhost:5173"]`.
- Add `credentials: true`.
- Do not use wildcard origins.
- Keep future production origins as explicit configuration work, not part of this rollout.

### 3. Set Cookies on Auth Success

Files:

- `src/controllers/auth.controller.ts`
- `src/services/auth.service.ts` if response shaping needs a small helper

Tasks:

- On successful sign-in, call `setSessionCookie(res, result.token)`.
- On successful sign-up, call `setSessionCookie(res, result.token)`.
- On successful OTP verification, call `setSessionCookie(res, result.token)`.
- Keep `{ token, user }` in JSON while `AUTH_RETURN_TOKEN_IN_BODY=true`.
- When `AUTH_RETURN_TOKEN_IN_BODY=false`, return only the redacted user or a stable auth success shape without the token.

### 4. Read Cookie Tokens for Authenticated Routes

Files:

- `src/middleware/authorization.middleware.ts`
- `src/models/request_me.model.ts` if needed

Tasks:

- Update `getAuthToken(req)` to prefer the session cookie.
- Fall back to `Authorization: Bearer <token>` during migration.
- Update `requireAuthToken` to use `getAuthToken(req)`.
- Preserve current `401` behavior when no token is available.

### 5. Update Validation and Refresh

Files:

- `src/controllers/auth.controller.ts`
- `src/routes/auth.routes.ts`
- `src/services/auth.service.ts`

Tasks:

- Ensure `GET /api/auth/validate-token` validates the cookie token without requiring an Authorization header.
- Keep `POST /api/auth/validate-token` compatible with frontend calls.
- Ensure missing or invalid tokens return `401` through the existing error path.
- On refresh success, set a replacement session cookie.
- Keep `{ refreshedToken }` while migration compatibility is required; later replace it with `{ refreshed: true }` or similar.

### 6. Add Logout Endpoint

Files:

- `src/controllers/auth.controller.ts`
- `src/routes/auth.routes.ts`

Tasks:

- Add `POST /api/auth/logout`.
- Require `requireApiKey` and `requireApplicationId`.
- Do not require a valid session token.
- Always call `clearSessionCookie(res)`.
- Return `204 No Content` unless existing API conventions require a translated JSON message.

### 7. Add Tests

Files:

- `src/test/session-cookie.util.spec.ts`
- `src/test/authorization.middleware.spec.ts`
- Controller or route tests if the project has an established HTTP test helper

Tasks:

- Test cookie set attributes: name, value, `HttpOnly`, `Path=/`, max age, `SameSite`, and environment-driven `Secure`.
- Test cookie clearing expires the same cookie name/path/options.
- Test cookie token lookup, Authorization fallback, and cookie precedence.
- Test auth success responses set `Set-Cookie`.
- Test validation and refresh using only a `Cookie` header.
- Test logout clears cookies for valid, expired, invalid, and missing tokens.

## Validation Checklist

- Run `npm run build`.
- Run `npm run test`.
- Run `npm run test:coverage` if auth controller or middleware coverage is available.
- Start the backend locally and confirm CORS responses include credentials for `http://localhost:5173`.
- Sign in from the frontend with `credentials: "include"` and confirm the browser receives `auth210_session`.
- Confirm `document.cookie` cannot read the session cookie.
- Refresh a protected frontend route and confirm validation works through the cookie.
- Log out and confirm the cookie is expired.

## Rollout Plan

1. Ship backend support with `AUTH_RETURN_TOKEN_IN_BODY=true`.
2. Update `me-login` to call auth endpoints with `credentials: "include"` and stop reading JWTs directly.
3. Verify local behavior using only `http://localhost:5173`.
4. Migrate any other approved frontend clients to cookie-backed requests.
5. After all approved clients migrate, set `AUTH_RETURN_TOKEN_IN_BODY=false`.
6. Remove legacy Authorization-header fallback in a later cleanup only after confirming no clients depend on it.

## Risks

- Cross-site frontends will need `SameSite=None; Secure`; this rollout intentionally avoids that until production origins are known.
- Cookie-backed JWTs can introduce CSRF risk on state-changing routes; strict CORS, `SameSite=Lax`, API key checks, and `x-application-id` remain required.
- Cookie deletion fails if attributes differ; all set/clear options must stay centralized.
- Old clients may break if token-in-body is disabled too early; keep the migration flag enabled until client usage is verified.
