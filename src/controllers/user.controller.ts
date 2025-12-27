import { Request, Response, NextFunction } from "express";
import userService from "../services/user.service";
import { HttpStatus } from "../constants/http.constants";
import { getApplicationId } from "../middleware/application.middleware";

class UserController {
  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password, profile_id } = req.body;
      const applicationId = getApplicationId(req)!;

      const user = await userService.createUser(
        applicationId,
        name,
        email,
        password,
        profile_id
      );

      res.status(HttpStatus.CREATED).json(user);
    } catch (err) {
      next(err);
    }
  }

  async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const applicationId = getApplicationId(req)!;
      const users = await userService.getAllUsers(applicationId);

      res.status(HttpStatus.OK).json(users);
    } catch (err) {
      next(err);
    }
  }

  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const applicationId = getApplicationId(req)!;
      const user = await userService.getUserById(
        applicationId,
        req.params.id
      );

      res.status(HttpStatus.OK).json(user);
    } catch (err) {
      next(err);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const applicationId = getApplicationId(req)!;
      const updatedUser = await userService.updateUser(
        applicationId,
        req.params.id,
        req.body
      );

      res.status(HttpStatus.OK).json(updatedUser);
    } catch (err) {
      next(err);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const applicationId = getApplicationId(req)!;
      await userService.deleteUser(applicationId, req.params.id);

      res.status(HttpStatus.NO_CONTENT).send();
    } catch (err) {
      next(err);
    }
  }
}

export default new UserController();
