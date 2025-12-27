import express from "express";
import AuthController from "../controllers/auth.controller";
import requireAuthToken from "../middleware/authorization.middleware";
import requireApplicationId from "../middleware/application.middleware";

const router = express.Router();
router.post("/auth/login", requireApplicationId, AuthController.signIn.bind(AuthController));
router.patch("/auth/reset-password", requireApplicationId, AuthController.resetPassword.bind(AuthController));
router.get("/auth/refresh-token", requireApplicationId, requireAuthToken, AuthController.refreshToken.bind(AuthController));
router.post("/auth/validate-token", requireApplicationId, AuthController.validateToken.bind(AuthController));
router.get("/auth/validate-token", requireApplicationId, requireAuthToken, AuthController.validateToken.bind(AuthController));
router.post("/auth/signup", requireApplicationId, AuthController.signUp.bind(AuthController));
export default router;
