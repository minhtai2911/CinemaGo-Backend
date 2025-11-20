import express from "express";
import * as AuthController from "../controllers/auth.controller.js";
import { authenticateRequest } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/login", AuthController.login);
router.post("/signup", AuthController.signup);
router.post("/logout", authenticateRequest, AuthController.logout);
router.post("/refresh-token", AuthController.refreshAccessToken);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);
router.post("/send-verification-link", AuthController.sendVerificationLink);
router.post("/verify-account", AuthController.verifyAccountByLink);
router.post(
  "/change-password",
  authenticateRequest,
  AuthController.changePassword
);
router.post("/verify-otp", AuthController.verifyAccountByOtp);

export default router;
