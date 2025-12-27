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