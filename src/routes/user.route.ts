import express from "express";
import UserController from "../controllers/user.controller";
import requireApplicationId from "../middleware/application.middleware";

const router = express.Router();

router.post("/users", requireApplicationId, UserController.createUser.bind(UserController));
router.get("/users", requireApplicationId, UserController.getAllUsers.bind(UserController));
router.get("/users/:id", requireApplicationId, UserController.getUserById.bind(UserController));
router.put("/users/:id", requireApplicationId, UserController.updateUser.bind(UserController));
router.delete("/users/:id", requireApplicationId, UserController.deleteUser.bind(UserController));

export default router;
