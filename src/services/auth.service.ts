import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import userRepository from "../repositories/user.repository";
import { BCRYPT_SALT_ROUNDS, JWT_EXPIRES_IN } from "../constants/auth.constants";
import { UserModel } from "../models/user.model";
import { DEFAULT_USER_ID } from "../constants/user.constants";
import { DEFAULT_PROFILE_ID } from "../constants/profile.constants";
import { DecodedToken } from "../models/auth.model";

import {
  InvalidCredentialsError,
  InvalidTokenError,
  UserNotFoundError,
  EmailAlreadyInUseError,
} from "../errors/auth.error";

class AuthService {
  async login(
    applicationId: string,
    email: string,
    password: string
  ): Promise<{ token: string; user: UserModel }> {
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

  async forgotPassword(): Promise<{ message: string }> {
    return { message: "Password reset email sent" };
  }

  async resetPassword(
    applicationId: string,
    token: string,
    newPassword: string
  ): Promise<{ message: string }> {
    let decodedToken: DecodedToken;

    try {
      decodedToken = jwt.verify(
        token,
        process.env.JWT_SECRET as string
      ) as DecodedToken;
    } catch {
      throw new InvalidTokenError();
    }

    const user = await userRepository.findById(
      applicationId,
      decodedToken.sub
    );

    if (!user) {
      throw new UserNotFoundError();
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      BCRYPT_SALT_ROUNDS
    );

    await userRepository.updatePassword(
      applicationId,
      user.id,
      hashedPassword
    );

    return {
      message: "Password reset successfully",
    };
  }
}

export default new AuthService();
