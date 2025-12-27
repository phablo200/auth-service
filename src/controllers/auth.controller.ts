import { Request, Response, NextFunction } from "express";
import authService from "../services/auth.service";
import { HttpStatus } from "../constants/http.constants";
import { getApplicationId } from "../middleware/application.middleware";
import { getAuthToken } from "../middleware/authorization.middleware";

class AuthController {
  async signIn(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const applicationId = getApplicationId(req)!;

      const result = await authService.signIn(
        applicationId,
        email,
        password
      );

      res.status(HttpStatus.OK).json(result);
    } catch (err) {
      next(err);
    }
  }

  async signUp(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password } = req.body;
      const applicationId = getApplicationId(req)!;

      const result = await authService.signUp(
        applicationId,
        name,
        email,
        password
      );

      res.status(HttpStatus.CREATED).json(result);
    } catch (err) {
      next(err);
    }
  }

  async validateToken(req: Request, res: Response, next: NextFunction) {
    try {
      const token = getAuthToken(req);
      const result = await authService.validateToken(token!);

      res.status(HttpStatus.OK).json(result);
    } catch (err) {
      next(err);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const token = getAuthToken(req);
      const result = await authService.refreshToken(token!);

      res.status(HttpStatus.OK).json(result);
    } catch (err) {
      next(err);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.forgotPassword();
      res.status(HttpStatus.OK).json(result);
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, new_password: newPassword } = req.body;
      const applicationId = getApplicationId(req)!;

      const result = await authService.resetPassword(
        applicationId,
        token,
        newPassword
      );

      res.status(HttpStatus.OK).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export default new AuthController();
