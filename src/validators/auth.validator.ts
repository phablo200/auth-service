import { z } from "zod";
import { AppError } from "../errors/app.error";

/**
 * Login / SignIn
 */
export const signInSchema = z.object({
  email: z
    .email("auth.email.invalid")
    .min(1, "auth.email.required"),

  password: z
    .string()
    .min(1, "auth.password.required"),
});

/**
 * SignUp
 */
export const signUpSchema = z.object({
  name: z
    .string()
    .min(1, "auth.name.required"),

  email: z
  .email("auth.email.invalid")
  .min(1, "auth.email.required"),

  password: z
    .string()
    .min(1, "auth.password.required"),
});

const forgotPasswordSchema = z.object({
    email: z
      .email("auth.email.invalid")
      .min(1, "auth.email.required"),
  });

/**
 * Helpers
 */
export function validateSignInInput(data: unknown) {
  const result = signInSchema.safeParse(data);

  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }

  return result.data;
}

export function validateSignUpInput(data: unknown) {
  const result = signUpSchema.safeParse(data);

  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }

  return result.data;
}

export function validateForgotPasswordInput(data: unknown) {
  const result = forgotPasswordSchema.safeParse(data);

  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }

  return result.data;
}

export const requestOtpSchema = z.object({
  email: z.email(),
});

export function validateRequestOtpInput(data: unknown) {
  const result = requestOtpSchema.safeParse(data);
  if (!result.success) {
    throw new AppError(`email: ${result.error.issues[0].message}`, 400);
  }
  return result.data;
}

export const verifyOtpSchema = z.object({
  email: z.email(),
  code: z.string().length(6),
});

export function validateVerifyOtpInput(data: unknown) {
  const result = verifyOtpSchema.safeParse(data);
  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }
  return result.data;
}

export const oauthProviderSchema = z.object({
  provider: z
    .string()
    .regex(/^[a-z0-9-]+$/, "errors.providerNotSupported"),
});

export const oauthAuthorizeSchema = z.object({
  redirect_uri: z.string().url(),
});

export const oauthExchangeSchema = z.object({
  code: z.string().min(1),
});

export function validateOAuthProvider(data: unknown) {
  const result = oauthProviderSchema.safeParse(data);
  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }
  return result.data;
}

export function validateOAuthAuthorizeInput(data: unknown) {
  const result = oauthAuthorizeSchema.safeParse(data);
  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }
  return result.data;
}

export function validateOAuthExchangeInput(data: unknown) {
  const result = oauthExchangeSchema.safeParse(data);
  if (!result.success) {
    throw new AppError(result.error.issues[0].message, 400);
  }
  return result.data;
}
