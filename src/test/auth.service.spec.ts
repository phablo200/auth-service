import { describe, it, expect, vi, beforeEach } from "vitest";

/* -------------------------------------------------------------------------- */
/*                                  MOCKS                                     */
/* -------------------------------------------------------------------------- */

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn<(
        data: string,
        encrypted: string
    ) => Promise<boolean>>(),
    hash: vi.fn(),
  },
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock("../repositories/user.repository", () => ({
  default: {
    findByEmail: vi.fn(),
    findByEmailRegistered: vi.fn(),
    create: vi.fn(),
    undeleteById: vi.fn(),
    updatePassword: vi.fn(),
  },
}));

vi.mock("../repositories/password-reset.repository", () => ({
  default: {
    create: vi.fn(),
    findValidToken: vi.fn(),
    markAsUsed: vi.fn(),
  },
}));

vi.mock("../repositories/auth-otp.repository", () => ({
  default: {
    create: vi.fn(),
    findLatestValid: vi.fn(),
    incrementAttempts: vi.fn(),
    markUsed: vi.fn(),
  },
}));

vi.mock("../mail/email.service", () => ({
  default: {
    sendForgotPasswordEmail: vi.fn(),
    sendOtpLoginEmail: vi.fn(),
  },
}));

vi.mock("../util/password.util", () => ({
  generatePasswordResetToken: vi.fn(() => ({
    rawToken: "raw-token",
    tokenHash: "hashed-token",
  })),
}));

vi.mock("../util/otp.util", () => ({
  generateOtp: vi.fn(() => "123456"),
  otpExpiresAt: vi.fn(() => new Date()),
}));

/* -------------------------------------------------------------------------- */
/*                               IMPORTS (AFTER MOCKS)                        */
/* -------------------------------------------------------------------------- */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authService from "../services/auth.service";
import userRepository from "../repositories/user.repository";
import passwordResetRepository from "../repositories/password-reset.repository";
import authOtpRepository from "../repositories/auth-otp.repository";
import emailService from "../mail/email.service";

import {
  InvalidCredentialsError,
  InvalidTokenError,
  EmailAlreadyInUseError,
} from "../errors/auth.error";

/* -------------------------------------------------------------------------- */
/*                                  FIXTURES                                  */
/* -------------------------------------------------------------------------- */

const applicationId = "app-id";

const user = {
  id: "user-id",
  email: "test@email.com",
  password: "hashed-password",
  profile_id: "profile-id",
  deleted: false,
};

/* -------------------------------------------------------------------------- */
/*                                  SETUP                                     */
/* -------------------------------------------------------------------------- */

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = "secret";
});

/* -------------------------------------------------------------------------- */
/*                                   TESTS                                    */
/* -------------------------------------------------------------------------- */

describe("AuthService.signIn", () => {
  it("throws when user is not found", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

    await expect(
      authService.signIn(applicationId, user.email, "123456")
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("throws when password is invalid", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(user as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(void 0);

    await expect(
      authService.signIn(applicationId, user.email, "wrong")
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("returns token and user when credentials are valid", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(user as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(Promise.resolve(true) as any);
    vi.mocked(jwt.sign).mockReturnValue("jwt-token" as any);

    const result = await authService.signIn(
      applicationId,
      user.email,
      "123456"
    );
  
    expect(result.token).toBe("jwt-token");
    expect(result.user.password).toBe("");
  });  
});

describe("AuthService.signUp", () => {
  it("throws when email already exists", async () => {
    vi.mocked(userRepository.findByEmailRegistered).mockResolvedValue(user as any);

    await expect(
      authService.signUp(applicationId, "Test", user.email, "123456")
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError);
  });

  it("undeletes user when existing user is deleted", async () => {
    const deletedUser = { ...user, deleted: true };

    vi.mocked(userRepository.findByEmailRegistered).mockResolvedValue(
      deletedUser as any
    );
    vi.mocked(bcrypt.hash).mockResolvedValue(void 0);

    const result = await authService.signUp(
      applicationId,
      "Test",
      user.email,
      "123456"
    );

    expect(userRepository.undeleteById).toHaveBeenCalled();
    expect(userRepository.updatePassword).toHaveBeenCalled();
    expect(result.deleted).toBe(false);
  });

  it("creates new user when email is free", async () => {
    vi.mocked(userRepository.findByEmailRegistered).mockResolvedValue(null);
    vi.mocked(bcrypt.hash).mockResolvedValue(void 0);
    vi.mocked(userRepository.create).mockResolvedValue(user as any);

    const result = await authService.signUp(
      applicationId,
      "Test",
      user.email,
      "123456"
    );

    expect(userRepository.create).toHaveBeenCalled();
    expect(result).toBe(user);
  });
});

describe("AuthService.validateToken", () => {
  it("returns valid true for valid token", async () => {
    vi.mocked(jwt.verify).mockReturnValue(void 0 as any);

    const result = await authService.validateToken("token");

    expect(result.valid).toBe(true);
  });

  it("throws InvalidTokenError for invalid token", async () => {
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error();
    });

    await expect(authService.validateToken("bad")).rejects.toBeInstanceOf(
      InvalidTokenError
    );
  });
});

describe("AuthService.refreshToken", () => {
  it("refreshes token when valid", async () => {
    vi.mocked(jwt.verify).mockReturnValue({
      sub: "user-id",
      email: user.email,
      profile_id: user.profile_id,
      application_id: applicationId,
    } as any);

    vi.mocked(jwt.sign).mockReturnValue("new-token" as any);

    const result = await authService.refreshToken("token");

    expect(result.refreshedToken).toBe("new-token");
  });

  it("throws when token is invalid", async () => {
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw new Error();
    });

    await expect(authService.refreshToken("bad")).rejects.toBeInstanceOf(
      InvalidTokenError
    );
  });
});

describe("AuthService.forgotPassword", () => {
  it("does not leak when user does not exist", async () => {
    vi.mocked(userRepository.findByEmailRegistered).mockResolvedValue(null);

    const result = await authService.forgotPassword(user.email);

    expect(result.messageKey).toBe("auth.forgotPasswordEmailSent");
    expect(emailService.sendForgotPasswordEmail).not.toHaveBeenCalled();
  });

  it("sends email when user exists", async () => {
    vi.mocked(userRepository.findByEmailRegistered).mockResolvedValue(user as any);

    const result = await authService.forgotPassword(user.email);

    expect(passwordResetRepository.create).toHaveBeenCalled();
    expect(emailService.sendForgotPasswordEmail).toHaveBeenCalled();
    expect(result.messageKey).toBe("auth.forgotPasswordEmailSent");
  });
});

describe("AuthService.resetPassword", () => {
  it("throws when token is invalid", async () => {
    vi.mocked(passwordResetRepository.findValidToken).mockResolvedValue(null);

    await expect(
      authService.resetPassword("bad", "new-pass")
    ).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("resets password when token is valid", async () => {
    vi.mocked(passwordResetRepository.findValidToken).mockResolvedValue({
      id: "reset-id",
      user_id: "user-id",
    } as any);

    vi.mocked(bcrypt.hash).mockResolvedValue(void 0);

    const result = await authService.resetPassword("token", "new-pass");

    expect(userRepository.updatePassword).toHaveBeenCalled();
    expect(passwordResetRepository.markAsUsed).toHaveBeenCalled();
    expect(result.messageKey).toBe("auth.passwordResetSuccess");
  });
});

describe("AuthService.requestOtpLogin", () => {
  it("does not leak when user does not exist", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

    const result = await authService.requestOtpLogin(applicationId, user.email);

    expect(result.messageKey).toBe("auth.otpLoginEmailSent");
    expect(emailService.sendOtpLoginEmail).not.toHaveBeenCalled();
  });

  it("creates OTP and sends email when user exists", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(user as any);
    vi.mocked(bcrypt.hash).mockResolvedValue(void 0);

    const result = await authService.requestOtpLogin(applicationId, user.email);

    expect(authOtpRepository.create).toHaveBeenCalled();
    expect(emailService.sendOtpLoginEmail).toHaveBeenCalled();
    expect(result.messageKey).toBe("auth.otpLoginEmailSent");
  });
});

describe("AuthService.verifyOtpLogin", () => {
  it("throws when OTP is invalid", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(user as any);
    vi.mocked(authOtpRepository.findLatestValid).mockResolvedValue(null);

    await expect(
      authService.verifyOtpLogin(applicationId, user.email, "123456")
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("increments attempts when code is wrong", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(user as any);
    vi.mocked(authOtpRepository.findLatestValid).mockResolvedValue({
      id: "otp-id",
      attempts: 0,
      code_hash: "hash",
    } as any);

    vi.mocked(bcrypt.compare).mockResolvedValue(void 0);

    await expect(
      authService.verifyOtpLogin(applicationId, user.email, "000000")
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(authOtpRepository.incrementAttempts).toHaveBeenCalled();
  });

  it("returns token when OTP is valid", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(user as any);
    vi.mocked(authOtpRepository.findLatestValid).mockResolvedValue({
      id: "otp-id",
      attempts: 0,
      code_hash: "hash",
    } as any);

    vi.mocked(bcrypt.compare).mockResolvedValue(true as any);
    vi.mocked(jwt.sign).mockReturnValue("jwt-token" as any);

    const result = await authService.verifyOtpLogin(
      applicationId,
      user.email,
      "123456"
    );

    expect(authOtpRepository.markUsed).toHaveBeenCalled();
    expect(result.token).toBe("jwt-token");
    expect(result.user.password).toBe("");
  });
});
