import express from "express";
import UserController from "../controllers/user.controller";
import requireApplicationId from "../middleware/application.middleware";
import requireApiKey from "../middleware/apikey.middleware";

const router = express.Router();

router.post(
  "/users",
  requireApiKey,
  requireApplicationId,
  UserController.createUser.bind(UserController)
);

router.get(
  "/users",
  requireApiKey,
  requireApplicationId,
  UserController.getAllUsers.bind(UserController)
);

router.get(
  "/users/:id",
  requireApiKey,
  requireApplicationId,
  UserController.getUserById.bind(UserController)
);

router.put(
  "/users/:id",
  requireApiKey,
  requireApplicationId,
  UserController.updateUser.bind(UserController)
);

router.delete(
  "/users/:id",
  requireApiKey,
  requireApplicationId,
  UserController.deleteUser.bind(UserController)
);

export default router;
