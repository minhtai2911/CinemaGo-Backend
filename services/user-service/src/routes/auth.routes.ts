import express from "express";
import * as AuthController from "../controllers/auth.controller.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/login", AuthController.login);
router.post("/signup", AuthController.signup);
router.post("/logout", verifyToken, AuthController.logout);
router.post("/refresh-token", verifyToken, AuthController.refreshAccessToken);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/verify-otp", AuthController.verifyOtp);
router.post("/reset-password", AuthController.resetPassword);
router.post("/send-verification-link", AuthController.sendVerificationLink);
router.post("/verify-account", AuthController.verifyAccountByLink);
router.post("/change-password", verifyToken, AuthController.changePassword);

export default router;
