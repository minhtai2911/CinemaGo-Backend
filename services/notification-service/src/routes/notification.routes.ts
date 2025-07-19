import express from "express";
import * as NotificationController from "../controllers/notification.controller.js";
import { verifyToken, authorizeRole } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post(
  "/send-email",
  verifyToken,
  authorizeRole("ADMIN"),
  NotificationController.sendNotificationEmail
);

export default router;
