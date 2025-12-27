import { z } from "zod";
import { AppError } from "../errors/app.error";

/**
 * Create User Schema
 */
const createUserSchema = z.object({
  name: z
    .string()
    .min(1, "user.name.required"),

  email: z
    .email("user.email.invalid"),

  password: z
    .string()
    .min(8, "user.password.minLength")
    .regex(/[A-Z]/, "user.password.uppercase")
    .regex(/[0-9]/, "user.password.number"),
});

/**
 * Validator helper
 */
export function validateCreateUserInput(data: unknown) {
  const result = createUserSchema.safeParse(data);

  if (!result.success) {
    const firstError = result.error.issues[0];

    throw new AppError(
      firstError.message, // i18n key for later
      400
    );
  }

  return result.data;
}


const updateUserSchema = z
  .object({
    name: z
      .string()
      .min(1, "user.name.required")
      .optional(),

    email: z
      .string()
      .email("user.email.invalid")
      .optional(),

    password: z
      .string()
      .min(8, "user.password.minLength")
      .regex(/[A-Z]/, "user.password.uppercase")
      .regex(/[0-9]/, "user.password.number")
      .optional(),

    profile_id: z
      .string()
      .uuid("user.profile.invalid")
      .optional(),

    updated_by: z
      .string()
      .uuid("user.updatedBy.invalid")
      .optional(),
  })
  .strict()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: "user.update.emptyPayload" }
  );


export function validateUpdateUserInput(data: unknown) {
const result = updateUserSchema.safeParse(data);

if (!result.success) {
    throw new AppError(
    result.error.issues[0].message,
    400
    );
}

return result.data;
}