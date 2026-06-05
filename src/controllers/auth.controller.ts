import { Request, Response, NextFunction } from "express";
import authService from "../services/auth.service";
import oauthService from "../services/oauth/oauth.service";
import { HttpStatus } from "../constants/http.constants";
import { getApplicationId } from "../middleware/application.middleware";
import { getAuthToken } from "../middleware/authorization.middleware";
import {
  validateOAuthAuthorizeInput,
  validateOAuthExchangeInput,
  validateOAuthProvider,
} from "../validators/auth.validator";

class AuthController {
  async getOAuthProviders(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = oauthService.getProviders();
      res.status(HttpStatus.OK).json(result);
    } catch (err) {
      next(err);
    }
  }

  async authorizeOAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const { provider } = validateOAuthProvider(req.params);
      const { redirect_uri: redirectUri } = validateOAuthAuthorizeInput(req.body);
      const applicationId = getApplicationId(req)!;

      const result = await oauthService.authorize(
        applicationId,
        provider,
        redirectUri
      );

      res.status(HttpStatus.OK).json(result);
    } catch (err) {
      next(err);
    }
  }

  async handleOAuthCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { provider } = validateOAuthProvider(req.params);
      const { code, state, error } = req.query;

      if (typeof state !== "string") {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: req.t("errors.oauthStateInvalid"),
        });
      }

      if (typeof error === "string") {
        const redirectUrl = await oauthService.providerErrorCallback(
          provider,
          state,
          error
        );
        return res.redirect(redirectUrl);
      }

      if (typeof code !== "string") {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: req.t("errors.oauthCodeExchangeFailed"),
        });
      }

      const redirectUrl = await oauthService.callback(provider, code, state);
      return res.redirect(redirectUrl);
    } catch (err) {
      next(err);
    }
  }

  async exchangeOAuthCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = validateOAuthExchangeInput(req.body);
      const applicationId = getApplicationId(req)!;

      const result = await oauthService.exchange(applicationId, code);

      res.status(HttpStatus.OK).json(result);
    } catch (err) {
      next(err);
    }
  }

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
      const { email } = req.body;
      const result = await authService.forgotPassword(email);
      res.status(HttpStatus.OK).json({ message: req.t(result.messageKey) });
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, new_password: newPassword } = req.body;


      const result = await authService.resetPassword(
        token,
        newPassword
      );

      res.status(HttpStatus.OK).json({ message: req.t(result.messageKey) });
    } catch (err) {
      next(err);
    }
  }

  async requestOtpLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const applicationId = getApplicationId(req)!;

      const result = await authService.requestOtpLogin(
        applicationId,
        email
      );

      // Enumeration-safe message
      res
        .status(HttpStatus.OK)
        .json({ message: req.t(result.messageKey) });
    } catch (err) {
      console.log('err', err);
      next(err);
    }
  }

  async verifyOtpLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, code } = req.body;
      const applicationId = getApplicationId(req)!;

      const result = await authService.verifyOtpLogin(
        applicationId,
        email,
        code
      );

      res.status(HttpStatus.OK).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export default new AuthController();
