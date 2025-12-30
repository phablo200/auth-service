import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import userRepository from "../repositories/user.repository";
import { BCRYPT_SALT_ROUNDS, JWT_EXPIRES_IN } from "../constants/auth.constants";
import { UserModel } from "../models/user.model";
import { DEFAULT_USER_ID } from "../constants/user.constants";
import { DEFAULT_PROFILE_ID } from "../constants/profile.constants";
import { DecodedToken } from "../models/auth.model";
import passwordResetRepository from "../repositories/password-reset.repository";
import { validateRequestOtpInput, validateSignInInput, validateSignUpInput, validateVerifyOtpInput } from "../validators/auth.validator";
import {
  InvalidCredentialsError,
  InvalidTokenError,
  EmailAlreadyInUseError,
} from "../errors/auth.error";
import emailService from "../mail/email.service";
import { DEFAULT_APPLICATION_ID } from "../constants/application.constants";
import { generatePasswordResetToken } from "../util/password.util";
import { generateOtp, otpExpiresAt } from "../util/otp.util";
import authOtpRepository from "../repositories/auth-otp.repository";

class AuthService {
  async signIn(
    applicationId: string,
    email: string,
    password: string
  ): Promise<{ token: string; user: UserModel }> {
    validateSignInInput({ email, password });
    const user = await userRepository.findByEmail(applicationId, email);

    if (!user || user.deleted) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        profile_id: user.profile_id,
        application_id: applicationId,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      token,
      user: {
        ...user,
        password: "",
      },
    };
  }

  async signUp(
    applicationId: string,
    name: string,
    email: string,
    password: string,
    profile_id: string = DEFAULT_PROFILE_ID,
    created_by: string = DEFAULT_USER_ID
  ): Promise<UserModel> {
    validateSignUpInput({ name, email, password });
    const existingUser = await userRepository.findByEmailRegistered(
      applicationId,
      email
    );

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    if (existingUser && existingUser.deleted) {
      await userRepository.undeleteById(applicationId, existingUser.id);
      await userRepository.updatePassword(
        applicationId,
        existingUser.id,
        hashedPassword
      );

      return {
        ...existingUser,
        deleted: false,
        password: hashedPassword,
        updated_at: new Date(),
      };
    }

    if (existingUser) {
      throw new EmailAlreadyInUseError();
    }

    return userRepository.create({
      application_id: applicationId,
      name,
      email,
      password: hashedPassword,
      profile_id,
      created_by,
      updated_by: created_by,
    });
  }

  async validateToken(token: string): Promise<{ valid: boolean }> {
    try {
      jwt.verify(token, process.env.JWT_SECRET as string);
      return { valid: true };
    } catch {
      throw new InvalidTokenError();
    }
  }

  async refreshToken(token: string): Promise<{ refreshedToken: string }> {
    let decodedToken: DecodedToken;

    try {
      decodedToken = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as DecodedToken;
    } catch {
      throw new InvalidTokenError();
    }

    const refreshedToken = jwt.sign(
      {
        sub: decodedToken.sub,
        email: decodedToken.email,
        profile_id: decodedToken.profile_id,
        application_id: decodedToken.application_id,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return { refreshedToken };
  }

  async forgotPassword(email: string): Promise<{ messageKey: string }> {
    const user = await userRepository.findByEmailRegistered(
      DEFAULT_APPLICATION_ID,
      email
    );

    // 🔒 Prevent email enumeration
    if (!user || user.deleted) {
      return { messageKey: 'auth.forgotPasswordEmailSent' };
    }

    const { rawToken, tokenHash } = generatePasswordResetToken();

    const expiresAt = new Date(
      Date.now() + 1000 * 60 * 15 // 15 minutes
    );

    await passwordResetRepository.create(
      user.id,
      tokenHash,
      expiresAt
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
    console.log(resetLink);

    await emailService.sendForgotPasswordEmail(
      user.email,
      resetLink
    );

    return {
      messageKey: 'auth.forgotPasswordEmailSent',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ messageKey: string }> {
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
  
    const resetToken =
      await passwordResetRepository.findValidToken(tokenHash);
  
    if (!resetToken) {
      throw new InvalidTokenError();
    }
  
    const hashedPassword = await bcrypt.hash(
      newPassword,
      BCRYPT_SALT_ROUNDS
    );
  
    await userRepository.updatePassword(
      DEFAULT_APPLICATION_ID,
      resetToken.user_id,
      hashedPassword
    );
  
    await passwordResetRepository.markAsUsed(resetToken.id);
  
    return {
      messageKey: 'auth.passwordResetSuccess',
    };
  }


  async requestOtpLogin(
    applicationId: string,
    email: string
  ): Promise<{ messageKey: string }> {
    validateRequestOtpInput({ email });

    const user = await userRepository.findByEmail(applicationId, email);
    if (!user || user.deleted) {
      return { messageKey: "auth.otpLoginEmailSent" };
    }
  
    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, 10);  
    await authOtpRepository.create(
      applicationId,
      user.id,
      codeHash,
      otpExpiresAt()
    );
  
    await emailService.sendOtpLoginEmail(user.email, code);
  
    return { messageKey: "auth.otpLoginEmailSent" };
  }

  async verifyOtpLogin(
    applicationId: string,
    email: string,
    code: string
  ): Promise<{ token: string; user: UserModel }> {
    validateVerifyOtpInput({ email, code });

    const user = await userRepository.findByEmail(applicationId, email);
  
    if (!user || user.deleted) {
      throw new InvalidCredentialsError();
    }
  
    const otp = await authOtpRepository.findLatestValid(
      applicationId,
      user.id
    );
  
    if (!otp || otp.attempts >= 5) {
      throw new InvalidCredentialsError();
    }
  
    const isValid = await bcrypt.compare(code, otp.code_hash);
  
    if (!isValid) {
      await authOtpRepository.incrementAttempts(otp.id);
      throw new InvalidCredentialsError();
    }
  
    await authOtpRepository.markUsed(otp.id);
  
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        profile_id: user.profile_id,
        application_id: applicationId,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: JWT_EXPIRES_IN }
    );
  
    return {
      token,
      user: { ...user, password: "" },
    };
  }  
}

export default new AuthService();
