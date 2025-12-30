import { describe, it, expect, vi } from "vitest";
import authService from "../services/auth.service";
import userRepository from "../repositories/user.repository";
import { InvalidCredentialsError } from "../errors/auth.error";

vi.mock("../../repositories/user.repository", () => ({
  default: {
    findByEmail: vi.fn(),
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
  },
}));

describe("AuthService.signIn", () => {
  it("should throw InvalidCredentialsError when user is not found", async () => {
    (userRepository.findByEmail as any).mockResolvedValue(null);

    await expect(
      authService.signIn("app-id", "test@email.com", "123456")
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
