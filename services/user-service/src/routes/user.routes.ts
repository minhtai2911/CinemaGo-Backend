import express from "express";
import * as UserController from "../controllers/user.controller.js";
import {
  authenticateRequest,
  authorizeRole,
} from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/upload.js";

const router = express.Router();

router.get("/profile", authenticateRequest, UserController.getProfile);
router.put(
  "/profile",
  authenticateRequest,
  upload.single("avatar"),
  UserController.updateProfile
);
router.get(
  "/",
  authenticateRequest,
  authorizeRole("ADMIN", "EMPLOYEE"),
  UserController.getUsers
);
router.get(
  "/:id",
  authenticateRequest,
  authorizeRole("ADMIN", "EMPLOYEE"),
  UserController.getUserById
);
router.post(
  "/",
  authenticateRequest,
  authorizeRole("ADMIN"),
  UserController.createUser
);
router.put(
  "/:id",
  authenticateRequest,
  authorizeRole("ADMIN"),
  UserController.updateUserById
);
router.put(
  "/:id/archive",
  authenticateRequest,
  authorizeRole("ADMIN"),
  UserController.archiveUserById
);
router.put(
  "/:id/restore",
  authenticateRequest,
  authorizeRole("ADMIN"),
  UserController.restoreUserById
);

export default router;
