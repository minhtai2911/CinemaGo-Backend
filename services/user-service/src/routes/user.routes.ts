import express from "express";
import * as UserController from "../controllers/user.controller.js";
import { verifyToken, authorizeRole } from "../middlewares/authMiddleware.js";
import { upload } from "~/middlewares/upload.js";

const router = express.Router();

router.get("/profile", verifyToken, UserController.getProfile);
router.put("/profile", verifyToken, upload.single("avatar"), UserController.updateProfile);
router.get("/", verifyToken, authorizeRole("ADMIN"), UserController.getUsers);
router.get(
  "/:id",
  verifyToken,
  authorizeRole("ADMIN"),
  UserController.getUserById
);
router.post(
  "/",
  verifyToken,
  authorizeRole("ADMIN"),
  UserController.createUser
);
router.put(
  "/:id",
  verifyToken,
  authorizeRole("ADMIN"),
  UserController.updateUserById
);
router.put(
  "/:id/archive",
  verifyToken,
  authorizeRole("ADMIN"),
  UserController.archiveUserById
);
router.put(
  "/:id/unarchive",
  verifyToken,
  authorizeRole("ADMIN"),
  UserController.unarchiveUserById
);

export default router;
