import { AppError } from "./app.error";

export class InvalidCredentialsError extends AppError {
  constructor() {
    super("errors.invalidCredentials", 401);
  }
}

export class EmailAlreadyInUseError extends AppError {
  constructor() {
    super("errors.emailAlreadyInUse", 400);
  }
}

export class UserNotFoundError extends AppError {
  constructor() {
    super("errors.userNotFound", 404);
  }
}

export class InvalidTokenError extends AppError {
  constructor() {
    super("errors.invalidToken", 401);
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super("errors.unauthorized", 401);
  }
}

export class ProviderNotSupportedError extends AppError {
  constructor() {
    super("errors.providerNotSupported", 400);
  }
}

export class OAuthStateInvalidError extends AppError {
  constructor() {
    super("errors.oauthStateInvalid", 400);
  }
}

export class OAuthStateExpiredError extends AppError {
  constructor() {
    super("errors.oauthStateExpired", 400);
  }
}

export class OAuthCodeExchangeFailedError extends AppError {
  constructor() {
    super("errors.oauthCodeExchangeFailed", 502);
  }
}

export class ProviderEmailUnverifiedError extends AppError {
  constructor() {
    super("errors.providerEmailUnverified", 400);
  }
}

export class OAuthAccountConflictError extends AppError {
  constructor() {
    super("errors.oauthAccountConflict", 409);
  }
}

export class OAuthExchangeInvalidError extends AppError {
  constructor() {
    super("errors.oauthExchangeInvalid", 400);
  }
}

export class OAuthExchangeExpiredError extends AppError {
  constructor() {
    super("errors.oauthExchangeExpired", 400);
  }
}

export class OAuthProviderError extends AppError {
  constructor() {
    super("errors.oauthProviderError", 502);
  }
}
