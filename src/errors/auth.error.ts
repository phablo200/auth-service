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
