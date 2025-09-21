import express from "express";
import * as NotificationController from "../controllers/notification.controller.js";

const router = express.Router();

router.post(
  "/public/send-email",
  NotificationController.sendNotificationEmail
);

export default router;
