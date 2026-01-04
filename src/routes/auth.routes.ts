import express from "express";
import AuthController from "../controllers/auth.controller";
import requireAuthToken from "../middleware/authorization.middleware";
import requireApplicationId from "../middleware/application.middleware";
import requireApiKey from "../middleware/apikey.middleware";

const router = express.Router();

router.post(
  "/auth/signin",
  requireApiKey,
  requireApplicationId,
  AuthController.signIn.bind(AuthController)
);

router.post(
  "/auth/signup",
  requireApiKey,
  requireApplicationId,
  AuthController.signUp.bind(AuthController)
);

router.post(
  "/auth/forgot-password",
  requireApiKey,
  requireApplicationId,
  AuthController.forgotPassword.bind(AuthController)
);

router.patch(
  "/auth/reset-password",
  requireApiKey,
  requireApplicationId,
  AuthController.resetPassword.bind(AuthController)
);

router.post(
  "/auth/request-otp-login",
  requireApiKey,
  requireApplicationId,
  AuthController.requestOtpLogin.bind(AuthController)
);

router.post(
  "/auth/verify-otp-login",
  requireApiKey,
  requireApplicationId,
  AuthController.verifyOtpLogin.bind(AuthController)
);

router.post(
  "/auth/validate-token",
  requireApiKey,
  requireApplicationId,
  AuthController.validateToken.bind(AuthController)
);

// Token-authenticated routes
router.get(
  "/auth/refresh-token",
  requireApplicationId,
  requireAuthToken,
  AuthController.refreshToken.bind(AuthController)
);

router.get(
  "/auth/validate-token",
  requireApplicationId,
  requireAuthToken,
  AuthController.validateToken.bind(AuthController)
);

export default router;
