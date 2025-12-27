import { UserModel } from "../models/user.model";
import userRepository from "../repositories/user.repository";
import { BCRYPT_SALT_ROUNDS } from "../constants/auth.constants";
import bcrypt from "bcrypt";
import { DEFAULT_PROFILE_ID } from "../constants/profile.constants";
import { DEFAULT_USER_ID } from "../constants/user.constants";

import {
  EmailAlreadyInUseError,
  UserNotFoundError,
} from "../errors/user.error";
import { validateCreateUserInput, validateUpdateUserInput } from "../validators/user.validator";

class UserService {
  async createUser(
    applicationId: string,
    name: string,
    email: string,
    password: string,
    profile_id: string = DEFAULT_PROFILE_ID,
    created_by: string = DEFAULT_USER_ID
  ): Promise<UserModel> {
    validateCreateUserInput({ name, email, password });

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

  async getAllUsers(applicationId: string): Promise<UserModel[]> {
    return userRepository.findAll(applicationId);
  }

  async getUserById(
    applicationId: string,
    id: string
  ): Promise<UserModel> {
    const user = await userRepository.findById(applicationId, id);

    if (!user) {
      throw new UserNotFoundError();
    }

    return user;
  }

  async updateUser(
    applicationId: string,
    id: string,
    data: Partial<Omit<UserModel, "id" | "created_at" | "application_id">>
  ): Promise<UserModel> {
    validateUpdateUserInput(data);
    const updatedUser = await userRepository.update(
      applicationId,
      id,
      data
    );

    if (!updatedUser) {
      throw new UserNotFoundError();
    }

    return updatedUser;
  }

  async deleteUser(
    applicationId: string,
    id: string,
    deletedBy?: string
  ): Promise<boolean> {
    const deleted = await userRepository.delete(
      applicationId,
      id,
      deletedBy
    );

    if (!deleted) {
      throw new UserNotFoundError();
    }

    return true;
  }
}

export default new UserService();
