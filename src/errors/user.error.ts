import { AppError } from "./app.error";

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

export class UserAlreadyDeletedError extends AppError {
  constructor() {
    super("errors.userAlreadyDeleted", 400);
  }
}

export class UserUpdateNotAllowedError extends AppError {
  constructor() {
    super("errors.userUpdateNotAllowed", 403);
  }
}
